/* ==========================================================================
   SPOCART Wholesale — authentication (mobile number + OTP)
   Endpoints mirror the mobile app: POST /auth/otp/send, POST /auth/otp/verify,
   GET /auth/me, PUT /auth/profile. In DEMO_MODE the OTP is generated locally
   and shown on screen because no SMS gateway is connected.
   Session lives in localStorage ('spocart.session'); registered demo users
   live in 'spocart.users' keyed by mobile number.
   ========================================================================== */
const Auth = (() => {
  const SESSION_KEY = 'spocart.session';
  const ADMIN_KEY = 'spocart.admin';
  const USERS_KEY = 'spocart.users';

  const normalise = (mobile) => String(mobile || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  const validMobile = (mobile) => /^[6-9]\d{9}$/.test(normalise(mobile));
  const formatMobile = (mobile) => { const m = normalise(mobile); return m ? `+91 ${m.slice(0, 5)} ${m.slice(5)}` : ''; };

  const users = () => load(USERS_KEY, {});
  const saveUsers = (u) => save(USERS_KEY, u);
  const session = () => load(SESSION_KEY, null);
  const isLoggedIn = () => !!session();

  /** Sends an OTP. Resolves { demoOtp } in demo mode so the page can display it. */
  async function sendOtp(mobile) {
    const m = normalise(mobile);
    if (!validMobile(m)) throw new Error('Enter a valid 10-digit Indian mobile number.');
    if (!CONFIG.DEMO_MODE) { await Api.sendOtp(m); return {}; }
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    try { sessionStorage.setItem(`spocart.otp.${m}`, JSON.stringify({ otp, at: Date.now() })); } catch { /* ignore */ }
    return { demoOtp: otp };
  }

  /** Verifies the OTP and returns { registered, user }. Starts a session when the user exists. */
  async function verifyOtp(mobile, code) {
    const m = normalise(mobile);
    if (!CONFIG.DEMO_MODE) {
      const data = await Api.verifyOtp(m, code);
      const registered = !!data.user?.profile;
      if (registered) { await startRemoteSession(m, data.user, data.token); }
      else { try { sessionStorage.setItem('spocart.pendingToken', data.token); } catch { /* ignore */ } }
      return { registered, user: data.user, token: data.token, verifiedMobile: m };
    }
    let stored = null;
    try { stored = JSON.parse(sessionStorage.getItem(`spocart.otp.${m}`)); } catch { /* ignore */ }
    if (!stored || Date.now() - stored.at > 10 * 60e3) throw new Error('This OTP has expired — request a new one.');
    if (String(code) !== stored.otp) throw new Error('Incorrect OTP. Check the code and try again.');
    try { sessionStorage.removeItem(`spocart.otp.${m}`); } catch { /* ignore */ }
    const user = users()[m] || (m === CONFIG.DEMO_ACCOUNT.mobile ? { profile: DEFAULT_PROFILE, addresses: [{ ...DEFAULT_ADDRESS, id: 'a1', label: 'Shop', isDefault: true }] } : null);
    if (user) { if (!users()[m]) { const u = users(); u[m] = user; saveUsers(u); } startSession(m, user); }
    return { registered: !!user, user, verifiedMobile: m };
  }

  /** Completes registration after OTP verification. */
  async function register(mobile, profile, address) {
    const m = normalise(mobile);
    if (!CONFIG.DEMO_MODE) {
      let pending = null; try { pending = sessionStorage.getItem('spocart.pendingToken'); } catch { /* ignore */ }
      if (!pending) throw new Error('Your OTP session expired — please verify your number again.');
      save(SESSION_KEY, { mobile: m, token: pending, name: profile.contact, business: profile.business, buyer: profile.buyerType || 'shops', at: Date.now() });
      const user = await Api.saveProfile({ ...profile, phone: m });
      await Api.saveAddress({ contactName: profile.contact, businessName: profile.business, line1: address.line1 || address.line, line2: address.line2 || '', cityOnly: address.cityOnly || address.city, state: address.state, pincode: address.pincode, mobile: m, label: 'office', isDefault: true });
      try { sessionStorage.removeItem('spocart.pendingToken'); } catch { /* ignore */ }
      await startRemoteSession(m, user, pending);
      return user;
    }
    const user = { profile: { ...profile, phone: formatMobile(m), memberSince: new Date().toISOString().slice(0, 10), creditLimit: 100000 }, addresses: [{ ...address, id: 'a' + Date.now(), label: 'Default', isDefault: true }] };
    const u = users(); u[m] = user; saveUsers(u);
    startSession(m, user);
    return user;
  }

  /** API mode: map the server user + addresses into the shapes the pages read. */
  async function startRemoteSession(mobile, apiUser, token) {
    const profile = Api.mapProfile(apiUser);
    save(SESSION_KEY, { mobile, token, name: profile.contact, business: profile.business, buyer: profile.buyerType, role: apiUser.role, userId: apiUser.id, at: Date.now() });
    save('spocart.profile', profile);
    save('spocart.buyer', profile.buyerType);
    try {
      const addresses = await Api.listAddresses();
      save('spocart.addresses', addresses);
      const def = addresses.find((x) => x.isDefault) || addresses[0];
      if (def) save('spocart.address', def); else localStorage.removeItem('spocart.address');
    } catch { save('spocart.addresses', []); }
  }

  function startSession(mobile, user, token) {
    save(SESSION_KEY, { mobile, token: token || null, name: user.profile.contact, business: user.profile.business, buyer: user.profile.buyerType || 'shops', at: Date.now() });
    save('spocart.profile', user.profile);
    save('spocart.addresses', user.addresses || []);
    const def = (user.addresses || []).find((a) => a.isDefault) || (user.addresses || [])[0];
    if (def) save('spocart.address', def);
    if (user.profile.buyerType) save('spocart.buyer', user.profile.buyerType);
  }

  /** Persists profile / address edits made on the account page back to the user record. */
  async function updateUser(patch) {
    const s = session(); if (!s) return;
    if (!CONFIG.DEMO_MODE) {
      if (patch.profile) { const user = await Api.saveProfile(patch.profile); const p = { ...patch.profile, ...Api.mapProfile(user) }; save('spocart.profile', p); save(SESSION_KEY, { ...s, name: p.contact, business: p.business }); }
      return;
    }
    const u = users();
    const cur = u[s.mobile] || { profile: load('spocart.profile', DEFAULT_PROFILE), addresses: load('spocart.addresses', []) };
    u[s.mobile] = { ...cur, ...patch };
    saveUsers(u);
    if (patch.profile) save(SESSION_KEY, { ...s, name: patch.profile.contact, business: patch.profile.business });
  }

  function signOut() {
    ['spocart.session', 'spocart.profile', 'spocart.addresses', 'spocart.address', 'spocart.cart', 'spocart.quotes', 'spocart.coupon', 'spocart.buyer'].forEach((k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } });
  }

  // ---------- admin ----------
  const adminSession = () => load(ADMIN_KEY, null);
  const isAdmin = () => !!adminSession();

  /**
   * Admin sign-in, step 1: the password. A correct one triggers the OTP; a
   * wrong one gets nothing at all. Two factors, because an admin can issue
   * refunds, move credit limits and read every customer.
   *
   * Its own route, deliberately: the customer OTP route refuses admins
   * outright, and that is what stops an admin session ever existing on the
   * mobile app.
   */
  async function sendAdminOtp(mobile, password) {
    const m = normalise(mobile);
    if (!validMobile(m)) throw new Error('Enter a valid 10-digit mobile number.');
    if (!password) throw new Error('Enter your password.');
    if (CONFIG.DEMO_MODE) {
      if (!CONFIG.ADMIN_MOBILES.includes(m)) throw new Error('This number is not an admin. Contact the SPOCART owner to be added.');
      return sendOtp(m);
    }
    const data = await Api.adminLogin(m, password);
    return { demoOtp: data.devCode || null };
  }

  /** Admin sign-in, step 2: the code the password unlocked. */
  async function verifyAdminOtp(mobile, code) {
    const m = normalise(mobile);
    if (!CONFIG.DEMO_MODE) {
      const data = await Api.adminVerify(m, code);
      if (data.user?.role !== 'admin') throw new Error('This number does not have admin access.');
      save(ADMIN_KEY, { mobile: m, name: data.user.profile?.contactName || 'SPOCART Admin', token: data.token, at: Date.now() });
      return true;
    }
    let stored = null;
    try { stored = JSON.parse(sessionStorage.getItem(`spocart.otp.${m}`)); } catch { /* ignore */ }
    if (!stored || Date.now() - stored.at > 10 * 60e3) throw new Error('This OTP has expired — request a new one.');
    if (String(code) !== stored.otp) throw new Error('Incorrect OTP. Check the code and try again.');
    if (!CONFIG.ADMIN_MOBILES.includes(m)) throw new Error('This number is not an admin.');
    try { sessionStorage.removeItem(`spocart.otp.${m}`); } catch { /* ignore */ }
    save(ADMIN_KEY, { mobile: m, name: 'SPOCART Admin', token: null, at: Date.now() });
    return true;
  }
  function adminSignOut() { try { localStorage.removeItem(ADMIN_KEY); } catch { /* ignore */ } }
  function requireAdmin() {
    if (isAdmin()) return true;
    location.replace('admin-login.html');
    return false;
  }

  /** Redirects to login (remembering where to come back to) when there is no session. */
  function requireAuth() {
    if (isLoggedIn()) return true;
    const next = location.pathname.split('/').pop() + location.search + location.hash;
    location.replace(`login.html?next=${encodeURIComponent(next)}`);
    return false;
  }

  /** Safe "next" target after login — only same-site pages. */
  function nextUrl(fallback = 'account.html') {
    const n = new URLSearchParams(location.search).get('next') || '';
    return /^[a-z0-9-]+\.html([?#].*)?$/i.test(n) ? n : fallback;
  }

  return { normalise, validMobile, formatMobile, session, isLoggedIn, sendOtp, verifyOtp, register, updateUser, signOut, requireAuth, nextUrl, adminSession, isAdmin, sendAdminOtp, verifyAdminOtp, adminSignOut, requireAdmin };
})();
