/* ==========================================================================
   SPOCART Wholesale — account page
   Overview stats, the "My orders" section (latest orders, linked to
   orders.html), quote requests, editable default address (used at checkout),
   business / GST details, buyer type and payment options.
   ========================================================================== */
CATALOG_READY.then(async () => {
if (!Auth.requireAuth()) return;
const { state, toast, setBuyer, addAllToQuote, toggleQuote, signOut } = window.Spocart;

let profile = load('spocart.profile', DEFAULT_PROFILE);
const addresses = () => load('spocart.addresses', []);
const address = () => load('spocart.address', addresses().find((a) => a.isDefault) || addresses()[0] || DEFAULT_ADDRESS);
const initials = (name) => name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

// ---------- profile hero ----------
function renderProfile() {
  $('#avatar').textContent = initials(profile.business);
  $('#profileName').textContent = profile.business;
  const since = new Date(profile.memberSince).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  $('#profileMeta').innerHTML = `
    <span class="tag tag--dark">${BUYER_TYPES[state.buyer].label}</span>
    <span>${profile.contact} • ${profile.phone}</span>
    ${profile.gstin ? `<span>GSTIN ${profile.gstin}</span>` : '<a href="#business" class="link">Add GSTIN for input credit</a>'}
    <span>Member since ${since}</span>`;
}

// ---------- overview ----------
function renderOverview(orders) {
  const open = orders.filter((o) => !['delivered', 'cancelled'].includes(o.status));
  const pending = orders.filter((o) => o.status === 'paymentPending');
  const due = pending.reduce((n, o) => n + o.total, 0);
  const shipped = orders.filter((o) => ['dispatched', 'outForDelivery'].includes(o.status)).length;
  const spent = orders.filter((o) => o.status !== 'cancelled' && o.status !== 'paymentPending').reduce((n, o) => n + o.total, 0);
  $('#overviewStats').innerHTML = `
    <a href="orders.html" class="stat stat--link"><b>${open.length}</b><span>Open orders</span></a>
    <a href="orders.html?tab=shipped" class="stat stat--link"><b>${shipped}</b><span>On the way</span></a>
    <a href="orders.html?tab=pending" class="stat stat--link ${due ? 'stat--alert' : ''}"><b>${inr(due)}</b><span>Payment due</span></a>
    <a href="#quotes" class="stat stat--link"><b>${state.quotes.length}</b><span>Quote requests</span></a>
    <div class="stat"><b>${inr(spent)}</b><span>Ordered this year</span></div>`;
  const banner = $('#dueBanner');
  banner.hidden = !pending.length;
  if (pending.length) {
    $('#dueTitle').textContent = `${pending.length} order${pending.length > 1 ? 's' : ''} waiting for payment — ${inr(due)}`;
    $('#dueText').textContent = `Stock is held for 24 hours after placing. Pay to confirm ${pending.map((o) => o.id).join(', ')}.`;
  }
  $('#navOrders').textContent = open.length || '';
  $('#navQuotes').textContent = state.quotes.length || '';
}

// ---------- my orders ----------
function primaryAction(o) {
  if (o.status === 'paymentPending') return `<a href="orders.html?open=${o.id}" class="btn btn--red btn--sm">Pay now</a>`;
  if (['delivered', 'cancelled'].includes(o.status)) return `<a href="orders.html?open=${o.id}" class="btn btn--outline btn--sm">Reorder</a>`;
  return `<a href="orders.html?open=${o.id}" class="btn btn--dark btn--sm">Track</a>`;
}

function renderRecentOrders(orders) {
  const recent = orders.slice(0, 4);
  $('#recentOrders').innerHTML = recent.length ? recent.map((o) => {
    const st = STATUS[o.status];
    const thumbs = o.lines.slice(0, 3).map((l) => `<img src="${l.image}" alt="" />`).join('');
    const names = o.lines.map((l) => l.name).slice(0, 2).join(', ') + (o.lines.length > 2 ? ` +${o.lines.length - 2} more` : '');
    return `
      <div class="order-row" data-href="orders.html?open=${o.id}" role="link" tabindex="0">
        <div class="order-row__thumbs">${thumbs}</div>
        <div class="order-row__info">
          <strong>${o.id}</strong>
          <span>${names}</span>
          <small>Placed ${fmtDate(o.placedAt)} • ${pcs(o).toLocaleString('en-IN')} pcs${st.step > 0 && st.step < 4 ? ` • Expected ${fmtEta(o)}` : ''}</small>
        </div>
        <span class="status status--${st.tone}">${icon(st.icon)} ${st.label}</span>
        <b class="order-row__total">${inr(o.total)}</b>
        <span class="order-row__action">${primaryAction(o)}</span>
      </div>`;
  }).join('') : `<div class="empty-orders"><h3>No orders yet</h3><p>Your bulk orders will show up here.</p><a href="catalog.html" class="btn btn--red btn--sm">Browse catalog</a></div>`;
}

// ---------- quotes ----------
function renderQuotes() {
  const items = state.quotes.map(byId).filter(Boolean);
  $('#quoteList').innerHTML = items.length ? items.map((p) => `
    <div class="quote-row" data-id="${p.id}">
      <img src="${p.img}" alt="" />
      <div><strong>${p.name}</strong><span>${p.brand} • MOQ ${p.moq} ${plural(p, p.moq)} • from ${inr(unitPriceFor(p, 500, state.buyer))}/${p.unit} at 500+</span></div>
      <a href="catalog.html?cat=${p.cat}" class="btn btn--outline btn--sm">View</a>
      <button class="icon-btn" data-remove-quote="${p.id}" aria-label="Remove">${icon('i-trash')}</button>
    </div>`).join('')
    : `<p class="empty">No quote requests yet. Tap the document icon on any product in the <a class="link" href="catalog.html">catalog</a>.</p>`;
  $('#sendQuotes').disabled = !items.length;
}

// ---------- quote history & notifications (API mode) ----------
const QUOTE_STATUS = { submitted: ['Submitted', 'grey'], underReview: ['Under review', 'amber'], quoted: ['Quoted', 'blue'], accepted: ['Accepted', 'green'], declined: ['Declined', 'red'] };
async function renderQuoteHistory() {
  if (CONFIG.DEMO_MODE) return;
  let list = [];
  try { list = await Api.listQuotes(); } catch { return; }
  $('#quoteHistoryWrap').hidden = !list.length;
  $('#quoteHistory').innerHTML = list.map((q) => {
    const [label, tone] = QUOTE_STATUS[q.status] || [q.status, 'grey'];
    return `<div class="quote-row quote-row--history" data-id="${q.id}">
      <div class="brand-mark">${q.kind === 'csv' ? 'BOQ' : q.kind === 'custom' ? 'CUS' : 'Q'}</div>
      <div><strong>${q.id} <span class="status status--${tone}">${label}</span></strong>
        <span>${(q.items || []).map((i) => `${i.quantity} × ${i.description}`).join(', ').slice(0, 120)}${q.designFileName ? ` · <a class="link" href="${q.designFileUrl}" target="_blank" rel="noopener">${q.designFileName}</a>` : ''}</span>
        ${q.quotedTotal ? `<span><b>Quoted ${inr(q.quotedTotal)}</b> incl. GST${q.adminNote ? ` — ${q.adminNote}` : ''}</span>` : q.adminNote ? `<span>${q.adminNote}</span>` : ''}
      </div>
      <span class="muted" style="font-size:12px">${fmtDate(q.createdAt)}</span>
      ${q.status === 'quoted' ? `<button class="btn btn--red btn--sm" data-accept-quote="${q.id}">Accept &amp; pay</button>` : '<span></span>'}
    </div>`;
  }).join('');
}
async function acceptQuote(id) {
  const addr = load('spocart.address', null);
  if (!addr?.id) return toast('Add a delivery address first.');
  try {
    const { order, checkout } = await Api.acceptQuote(id, addr.id);
    toast(`Order ${order.id} created from the quote — opening payment…`);
    try { await Api.payWithRazorpay(checkout); } catch (ex) { toast(ex.message); }
    location.href = `orders.html?new=${encodeURIComponent(order.id)}`;
  } catch (ex) { toast(ex.message); }
}
async function renderNotifications() {
  if (CONFIG.DEMO_MODE) { $('#navNotifLink').hidden = true; return; }
  $('#notifications').hidden = false;
  let data = { items: [], unreadCount: 0 };
  try { data = await Api.notifications(); } catch { /* keep empty */ }
  $('#navNotif').textContent = data.unreadCount || '';
  $('#notifList').innerHTML = data.items.length ? data.items.map((n) => `
    <li class="notif ${n.read ? '' : 'is-unread'}" data-id="${n.id}">
      <span class="notif__dot"></span>
      <div><strong>${n.title}</strong><p>${n.body}</p><small>${fmtDateTime(n.createdAt)}${n.orderId ? ` · <a class="link" href="orders.html?open=${n.orderId}">View order</a>` : ''}</small></div>
      ${n.read ? '' : `<button class="link link--muted" data-read-notif="${n.id}">Mark read</button>`}
    </li>`).join('') : '<li class="muted" style="padding:12px 0">No notifications yet.</li>';
}

// ---------- addresses ----------
async function syncAddressesFromApi() {
  const list = await Api.listAddresses();
  save('spocart.addresses', list);
  const def = list.find((x) => x.isDefault) || list[0];
  if (def) save('spocart.address', def); else localStorage.removeItem('spocart.address');
}
function saveAddresses(list) {
  if (list.length && !list.some((a) => a.isDefault)) list[0].isDefault = true;
  save('spocart.addresses', list);
  const def = list.find((a) => a.isDefault);
  if (def) save('spocart.address', def); else localStorage.removeItem('spocart.address');
  Auth.updateUser({ addresses: list });
}

function renderAddress() {
  const list = addresses();
  $('#addressGrid').innerHTML = list.map((a) => `
    <div class="address ${a.isDefault ? 'address--default' : ''}" data-id="${a.id}">
      <span class="tag ${a.isDefault ? 'tag--red' : 'tag--grey'}">${a.isDefault ? 'Default' : (a.label || 'Address')}</span>
      <strong>${a.name}</strong>
      <p>${a.line}<br>${a.city}${a.phone ? `<br>${a.phone}` : ''}</p>
      ${a.gstin ? `<span class="muted">GSTIN ${a.gstin}</span>` : ''}
      <div class="address__actions">
        <button class="link" data-edit-address="${a.id}">Edit</button>
        ${a.isDefault ? '' : `<button class="link" data-default-address="${a.id}">Set default</button><button class="link link--muted" data-delete-address="${a.id}">Delete</button>`}
      </div>
    </div>`).join('') + `<button class="address address--add" id="addAddress2">${icon('i-plus')} Add new address</button>`;
}

function openAddressForm(a = null) {
  const form = $('#addressForm');
  form.reset();
  const src = a || { name: profile.business, phone: profile.phone, gstin: profile.gstin, isDefault: !addresses().length };
  ['id', 'label', 'name', 'phone', 'line', 'gstin', 'state', 'pincode'].forEach((k) => { form.elements[k].value = src[k] || ''; });
  form.elements.city.value = src.cityOnly || (src.city || '').replace(/,?\s*[A-Za-z &]+\s*\d{6}$/, '').replace(/\s*\d{6}$/, '');
  if (!form.elements.pincode.value) form.elements.pincode.value = ((src.city || '').match(/\d{6}/) || [''])[0];
  form.elements.isDefault.checked = !!src.isDefault;
  form.hidden = false;
  form.elements.line.focus();
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ---------- business ----------
function renderBusiness() {
  $('#businessDetails').innerHTML = [
    ['Business name', profile.business], ['Contact person', profile.contact], ['Phone', profile.phone],
    ['Email', profile.email], ['GSTIN', profile.gstin || '—'], CONFIG.DEMO_MODE ? ['PAN', profile.pan || '—'] : ['Business type', profile.businessType || '—'],
  ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  const verified = $('#business .tag--green');
  if (verified) verified.innerHTML = profile.gstin ? `${icon('i-check-circle')} GST registered` : 'GSTIN not added';
  $('#buyerChips').innerHTML = Object.entries(BUYER_TYPES).map(([id, t]) => `<button class="chip-btn ${state.buyer === id ? 'is-active' : ''}" data-buyer="${id}">${t.label}</button>`).join('');
  const used = allOrders().filter((o) => o.paymentMethod?.startsWith('Pay later') && o.status !== 'cancelled').reduce((n, o) => n + o.total, 0);
  const limit = profile.creditLimit;
  $('#creditText').textContent = `${inr(Math.max(limit - used, 0))} available of ${inr(limit)}`;
  $('#creditBar').style.width = `${Math.min((used / limit) * 100, 100)}%`;
}

// ---------- events ----------
function bind() {
  // side nav highlight on scroll
  const links = $$('#accountNav a');
  const sections = links.map((a) => $(a.getAttribute('href')));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) links.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${en.target.id}`)); });
  }, { rootMargin: '-40% 0px -55% 0px' });
  sections.forEach((s) => s && io.observe(s));

  $('#recentOrders').addEventListener('click', (e) => {
    const row = e.target.closest('.order-row');
    if (row && !e.target.closest('a')) location.href = row.dataset.href;
  });
  $('#recentOrders').addEventListener('keydown', (e) => {
    const row = e.target.closest('.order-row');
    if (row && e.key === 'Enter') location.href = row.dataset.href;
  });

  $('#quoteHistory').addEventListener('click', (e) => { const b = e.target.closest('[data-accept-quote]'); if (b) acceptQuote(b.dataset.acceptQuote); });
  $('#notifList').addEventListener('click', async (e) => { const b = e.target.closest('[data-read-notif]'); if (b) { try { await Api.readNotification(b.dataset.readNotif); renderNotifications(); } catch (ex) { toast(ex.message); } } });
  $('#readAllNotif').addEventListener('click', async () => { try { await Api.readAllNotifications(); renderNotifications(); toast('All notifications marked read.'); } catch (ex) { toast(ex.message); } });
  $('#quoteList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-remove-quote]');
    if (b) { toggleQuote(b.dataset.removeQuote); renderQuotes(); renderOverview(allOrders()); }
  });
  $('#sendQuotes').addEventListener('click', async () => {
    if (!CONFIG.DEMO_MODE) {
      try {
        const items = state.quotes.map(byId).filter(Boolean).map((p) => ({ productId: p.id, description: p.name, quantity: Math.max(p.moq, 100) }));
        await Api.submitQuote(items, 'Sealed quote request from the website account page.');
        state.quotes.length = 0; save('spocart.quotes', []); renderQuotes(); renderOverview(allOrders()); renderQuoteHistory();
        toast('Quote request sent — our team replies within 2 hours.');
      } catch (ex) { toast(ex.message); }
      return;
    }
    addAllToQuote(state.quotes);
    toast(`Sealed quote requested for ${state.quotes.length} product${state.quotes.length > 1 ? 's' : ''} — reply on ${profile.email} within 2 hrs.`);
  });

  $('#addAddress').addEventListener('click', () => openAddressForm());
  $('#addressGrid').addEventListener('click', (e) => {
    const list = addresses();
    if (e.target.closest('#addAddress2')) return openAddressForm();
    const ed = e.target.closest('[data-edit-address]');
    if (ed) return openAddressForm(list.find((a) => a.id === ed.dataset.editAddress));
    const def = e.target.closest('[data-default-address]');
    if (def) {
      if (!CONFIG.DEMO_MODE) return Api.setDefaultAddress(def.dataset.defaultAddress).then(syncAddressesFromApi).then(() => { renderAddress(); toast('Default address updated.'); }).catch((ex) => toast(ex.message));
      list.forEach((a) => { a.isDefault = a.id === def.dataset.defaultAddress; }); saveAddresses(list); renderAddress(); toast('Default address updated.'); return;
    }
    const del = e.target.closest('[data-delete-address]');
    if (del && confirm('Delete this address?')) {
      if (!CONFIG.DEMO_MODE) return Api.deleteAddress(del.dataset.deleteAddress).then(syncAddressesFromApi).then(() => { renderAddress(); toast('Address deleted.'); }).catch((ex) => toast(ex.message));
      saveAddresses(list.filter((a) => a.id !== del.dataset.deleteAddress)); renderAddress(); toast('Address deleted.');
    }
  });
  $('#cancelAddress').addEventListener('click', () => { $('#addressForm').hidden = true; });
  $('#addressForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const a = Object.fromEntries(['id', 'label', 'name', 'phone', 'line', 'city', 'gstin', 'state', 'pincode'].map((k) => [k, String(fd.get(k) || '').trim()]));
    a.gstin = a.gstin.toUpperCase();
    if (!a.name || !a.line || !a.city || !a.phone) { toast('Name, address, city and phone are required.'); return; }
    if (!CONFIG.DEMO_MODE && (!a.state || !/^[1-9]\d{5}$/.test(a.pincode))) { toast('State and a 6-digit PIN code are required.'); return; }
    if (a.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(a.gstin)) { toast('That GSTIN doesn’t look right — 15 characters, e.g. 07AABCR1234F1Z5.'); return; }
    a.isDefault = fd.get('isDefault') === 'on';
    a.cityOnly = a.city; a.line1 = a.line; a.city = [a.city, a.state, a.pincode].filter(Boolean).join(a.state ? ', ' : ' ').replace(', ', ', ');
    if (!CONFIG.DEMO_MODE) {
      const labelMap = { shop: 'office', godown: 'warehouse', warehouse: 'warehouse', ground: 'ground', school: 'office', home: 'home', office: 'office' };
      (async () => {
        try {
          await Api.saveAddress({ ...a, label: labelMap[(a.label || '').toLowerCase()] || 'other', contactName: profile.contact || a.name, businessName: a.name, mobile: Auth.normalise(a.phone) });
          await syncAddressesFromApi(); e.target.hidden = true; renderAddress(); toast('Address saved.');
        } catch (ex) { toast(ex.message); }
      })();
      return;
    }
    const list = addresses();
    if (!a.id) { a.id = 'a' + Date.now(); list.push(a); }
    else { const i = list.findIndex((x) => x.id === a.id); list[i] = { ...list[i], ...a }; }
    if (a.isDefault) list.forEach((x) => { x.isDefault = x.id === a.id; });
    saveAddresses(list);
    e.target.hidden = true;
    renderAddress();
    toast(a.isDefault ? 'Address saved and set as default for checkout and invoices.' : 'Address saved.');
  });

  // Profile edit
  const pf = $('#profileForm');
  if (!CONFIG.DEMO_MODE) { $('#panField').hidden = true; $('#btypeField').hidden = false; }
  $('#editProfile').addEventListener('click', () => {
    ['business', 'contact', 'email', 'phone', 'gstin', 'pan'].forEach((k) => { pf.elements[k].value = profile[k] || ''; });
    pf.elements.businessType.value = profile.businessType || 'retailer';
    pf.hidden = false; $('#business').scrollIntoView({ behavior: 'smooth', block: 'start' }); pf.elements.business.focus();
  });
  $('#cancelProfile').addEventListener('click', () => { pf.hidden = true; });
  pf.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(pf);
    const p = { ...profile, business: String(fd.get('business')).trim(), contact: String(fd.get('contact')).trim(), email: String(fd.get('email')).trim(), gstin: String(fd.get('gstin')).trim().toUpperCase(), pan: String(fd.get('pan') || '').trim().toUpperCase(), businessType: String(fd.get('businessType') || profile.businessType || 'retailer') };
    if (!p.business || !p.contact) return toast('Business name and contact person are required.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) return toast('Enter a valid email address.');
    if (p.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(p.gstin)) return toast('GSTIN should be 15 characters, e.g. 07AABCR1234F1Z5.');
    if (p.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(p.pan)) return toast('PAN should be 10 characters, e.g. AABCR1234F.');
    if (!CONFIG.DEMO_MODE && !p.gstin) return toast('GSTIN is required for your wholesale profile.');
    Promise.resolve(Auth.updateUser({ profile: p })).then(() => {
      profile = load('spocart.profile', p); pf.hidden = true; renderProfile(); renderBusiness(); toast('Profile saved.');
    }).catch((ex) => toast(ex.message));
  });

  $('#buyerChips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-buyer]');
    if (!b) return;
    setBuyer(b.dataset.buyer);
    profile = { ...profile, buyerType: b.dataset.buyer }; save('spocart.profile', profile); Auth.updateUser({ profile });
    renderProfile(); renderBusiness(); renderQuotes();
    toast(`${BUYER_TYPES[b.dataset.buyer].label} pricing applied across the catalog.`);
  });

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-copy]');
    if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.copy); toast(`Copied ${b.dataset.copy}`); } catch { toast(b.dataset.copy); }
  });

  $('#signOut').addEventListener('click', signOut);
}

// ---------- init ----------
if (!CONFIG.DEMO_MODE) { try { await refreshOrders(); const list = await Api.listAddresses(); save('spocart.addresses', list); const def = list.find((x) => x.isDefault) || list[0]; if (def) save('spocart.address', def); } catch (ex) { toast(ex.message); } }
const orders = allOrders();
renderProfile();
renderOverview(orders);
renderRecentOrders(orders);
renderQuotes();
renderAddress();
renderBusiness();
renderQuoteHistory();
renderNotifications();
$('#addrState').innerHTML += INDIAN_STATES.map((st) => `<option>${st}</option>`).join('');
bind();
});
