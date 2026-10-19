/* ==========================================================================
   SPOCART Wholesale — login & signup pages (mobile number + OTP)
   ========================================================================== */
// Sign-in needs nothing from the catalogue, so it does not wait for it.
Promise.resolve().then(async () => {
const { toast } = window.Spocart;
const page = document.body.dataset.page;                // login | signup
const next = Auth.nextUrl(page === 'login' ? 'account.html' : 'account.html');
const state = { mobile: '', timer: null };

// Already signed in → nowhere to go but onwards.
if (Auth.isLoggedIn()) { location.replace(next); return; }

// Carry ?next= across login ↔ signup links.
const params = new URLSearchParams(location.search);
if (params.get('next')) $$('#toSignup, #toLogin').forEach((a) => { a.href += `?next=${encodeURIComponent(params.get('next'))}`; });

const show = (id) => { $$('.auth__step').forEach((s) => { s.hidden = s.id !== id; }); $(`#${id}`).querySelector('input:not([type=radio]):not([type=checkbox])')?.focus(); setStep(id); };
const err = (id, msg) => { const el = $(`#${id}`); el.textContent = msg || ''; el.hidden = !msg; };
function setStep(id) {
  const steps = $('#signupSteps'); if (!steps) return;
  const idx = { stepMobile: 0, stepOtp: 0, stepDetails: 1 }[id] ?? 0;
  [...steps.children].forEach((li, i) => { li.classList.toggle('is-current', i === idx); li.classList.toggle('is-done', i < idx); });
}

// ---------- step 1: mobile ----------
$('#mobile').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10); err('mobileError'); });
$('#stepMobile').addEventListener('submit', async (e) => {
  e.preventDefault();
  const m = Auth.normalise($('#mobile').value);
  if (!Auth.validMobile(m)) { err('mobileError', 'Enter a valid 10-digit Indian mobile number.'); return; }
  await sendOtp(m);
});
$('#useDemo')?.addEventListener('click', () => { $('#mobile').value = CONFIG.DEMO_ACCOUNT.mobile; $('#stepMobile').requestSubmit(); });

async function sendOtp(m) {
  const btn = $('#sendOtp'); btn.disabled = true; btn.textContent = 'Sending…';
  try {
    const { demoOtp } = await Auth.sendOtp(m);
    state.mobile = m;
    $('#otpTo').textContent = Auth.formatMobile(m);
    $('#demoOtp').hidden = !demoOtp;
    if (demoOtp) $('#demoOtpCode').textContent = demoOtp;
    $$('#otpBoxes input').forEach((i) => { i.value = ''; });
    err('otpError');
    show('stepOtp');
    startResendTimer();
    if (!demoOtp && /localhost|127\.0\.0\.1/.test(CONFIG.API_BASE_URL)) { $('#demoOtp').hidden = false; $('#demoOtp span').innerHTML = 'Local API with <code>SMS_DRIVER=console</code> — the OTP is printed in the API server terminal.'; }
    toast(demoOtp ? 'Demo OTP generated — see the box above the input.' : `OTP sent to ${Auth.formatMobile(m)}`);
  } catch (ex) { err('mobileError', ex.message); }
  finally { btn.disabled = false; btn.innerHTML = `Send OTP ${icon('i-arrow')}`; }
}

// ---------- step 2: OTP ----------
const boxes = $$('#otpBoxes input');
boxes.forEach((box, i) => {
  box.addEventListener('input', (e) => {
    const v = e.target.value.replace(/\D/g, '');
    if (v.length > 1) { // pasted / autofilled full code
      v.split('').slice(0, boxes.length - i).forEach((ch, k) => { boxes[i + k].value = ch; });
      boxes[Math.min(i + v.length, boxes.length - 1)].focus();
    } else { e.target.value = v; if (v && boxes[i + 1]) boxes[i + 1].focus(); }
    err('otpError');
    if (boxes.every((b) => b.value)) $('#stepOtp').requestSubmit();
  });
  box.addEventListener('keydown', (e) => { if (e.key === 'Backspace' && !box.value && boxes[i - 1]) boxes[i - 1].focus(); });
  box.addEventListener('paste', (e) => { const t = (e.clipboardData.getData('text') || '').replace(/\D/g, ''); if (t.length >= 4) { e.preventDefault(); boxes.forEach((b, k) => { b.value = t[k] || ''; }); boxes[Math.min(t.length, boxes.length) - 1].focus(); if (t.length >= boxes.length) $('#stepOtp').requestSubmit(); } });
});
$('#changeMobile').addEventListener('click', () => { clearInterval(state.timer); show('stepMobile'); });
$('#resendOtp').addEventListener('click', () => sendOtp(state.mobile));

function startResendTimer() {
  clearInterval(state.timer);
  let left = CONFIG.OTP_RESEND_SECONDS;
  const btn = $('#resendOtp'), t = $('#resendTimer');
  btn.disabled = true; t.textContent = `(${left}s)`;
  state.timer = setInterval(() => { left--; t.textContent = left > 0 ? `(${left}s)` : ''; if (left <= 0) { clearInterval(state.timer); btn.disabled = false; } }, 1000);
}

$('#stepOtp').addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = boxes.map((b) => b.value).join('');
  if (code.length !== CONFIG.OTP_LENGTH) { err('otpError', 'Enter all 6 digits.'); return; }
  const btn = $('#verifyOtp'); btn.disabled = true; btn.textContent = 'Verifying…';
  try {
    const { registered } = await Auth.verifyOtp(state.mobile, code);
    clearInterval(state.timer);
    if (registered) { toast(`Welcome back, ${Auth.session().name.split(' ')[0]}!`); location.href = next; return; }
    // Not registered yet → collect details (signup) or hand over to signup page (login)
    if (page === 'signup') { $('#verifiedMobile').textContent = Auth.formatMobile(state.mobile); show('stepDetails'); }
    else { try { sessionStorage.setItem('spocart.verified', state.mobile); } catch { /* ignore */ } location.href = `signup.html?verified=1${params.get('next') ? `&next=${encodeURIComponent(params.get('next'))}` : ''}`; }
  } catch (ex) { err('otpError', ex.message); boxes.forEach((b) => { b.value = ''; }); boxes[0].focus(); }
  finally { btn.disabled = false; btn.textContent = page === 'login' ? 'Verify & login' : 'Verify & continue'; }
});

// ---------- step 3: details (signup) ----------
if (page === 'signup') {
  $('#stateSelect').innerHTML += INDIAN_STATES.map((st) => `<option>${st}</option>`).join('');
  if (!CONFIG.DEMO_MODE) { $('#gstinHint').textContent = '(required for GST invoices)'; $('#stepDetails').elements.gstin.required = true; $('#panWrap').hidden = true; $('#buyerRadioWrap').hidden = true; $('#btypeSelectWrap').hidden = false; }
  // Arriving from login with a freshly verified number skips straight to details.
  let verified = null; try { verified = sessionStorage.getItem('spocart.verified'); } catch { /* ignore */ }
  if (params.get('verified') && verified) { state.mobile = verified; $('#verifiedMobile').textContent = Auth.formatMobile(verified); show('stepDetails'); }

  $('#stepDetails').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const v = (k) => String(fd.get(k) || '').trim();
    const businessType = CONFIG.DEMO_MODE ? null : v('businessTypeSel') || 'retailer';
    const profile = { contact: v('contact'), business: v('business'), email: v('email'), gstin: v('gstin').toUpperCase(), pan: v('pan').toUpperCase(), buyerType: businessType ? (Api.BUYER_FROM_TYPE[businessType] || 'shops') : (v('buyerType') || 'shops'), ...(businessType ? { businessType } : {}) };
    const address = { name: profile.business, line: v('line'), line1: v('line'), cityOnly: v('city'), state: v('state'), pincode: v('pin'), city: `${v('city')}, ${v('state')} ${v('pin')}`.trim(), phone: Auth.formatMobile(state.mobile), gstin: profile.gstin };
    if (!profile.contact || !profile.business) return err('detailsError', 'Please enter your name and business name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) return err('detailsError', 'Enter a valid email address.');
    if (!CONFIG.DEMO_MODE && !profile.gstin) return err('detailsError', 'GSTIN is required for a wholesale account (it goes on your GST invoices).');
    if (profile.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(profile.gstin)) return err('detailsError', 'GSTIN should be 15 characters, e.g. 07AABCR1234F1Z5.');
    if (profile.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(profile.pan)) return err('detailsError', 'PAN should be 10 characters, e.g. AABCR1234F.');
    if (!v('line') || !v('city') || !v('state') || !/^[1-9]\d{5}$/.test(v('pin'))) return err('detailsError', 'Enter your delivery address, city, state and a 6-digit PIN code.');
    if (!$('#agree').checked) return err('detailsError', 'Please accept the Terms and Privacy policy to continue.');
    err('detailsError');
    const btn = $('#createAccount'); btn.disabled = true; btn.textContent = 'Creating account…';
    try {
      await Auth.register(state.mobile, profile, address);
      try { sessionStorage.removeItem('spocart.verified'); } catch { /* ignore */ }
      $('#signupSteps')?.querySelectorAll('li').forEach((li, i) => { li.classList.toggle('is-done', i < 2); li.classList.toggle('is-current', i === 2); });
      toast(`Account created — welcome to SPOCART, ${profile.contact.split(' ')[0]}!`);
      location.href = Auth.nextUrl('account.html');
    } catch (ex) { err('detailsError', ex.message); btn.disabled = false; btn.innerHTML = `Create account ${icon('i-arrow')}`; }
  });
}
});
