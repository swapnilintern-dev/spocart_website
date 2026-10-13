/* ==========================================================================
   SPOCART Wholesale — admin panel
   Reads everything the storefront stores locally (orders, enquiries,
   customers, notify-me requests, product overrides). Each save function is
   the place to call the API (PATCH /orders/:id, PATCH /products/:id …).
   ========================================================================== */
CATALOG_READY.then(async () => {
if (!Auth.requireAdmin()) return;
mountSprite();

// Migrate the earlier stock/deal/slab overrides into the catalogue-edits store.
(() => { const old = load('spocart.productOverrides', null); if (old) { Object.entries(old).forEach(([id, ov]) => { CATALOG_EDITS.overrides[id] = { ...(CATALOG_EDITS.overrides[id] || {}), ...ov }; }); saveCatalogEdits(); localStorage.removeItem('spocart.productOverrides'); location.reload(); } })();

const admin = Auth.adminSession();
const toast = (msg) => { const el = $('#toast'); el.textContent = msg; el.classList.add('is-show'); clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('is-show'), 2400); };
const LOW_STOCK = 50;
const NEXT_STATUS = { paymentPending: 'placed', placed: 'packed', packed: 'dispatched', dispatched: 'outForDelivery', outForDelivery: 'delivered' };
const fmtMoney = (n) => inr(n);

// ---------- data ----------
// API mode caches; refreshed after every action.
const REMOTE = { orders: [], leads: [], quotes: [], users: [] };
async function reloadRemote() {
  if (CONFIG.DEMO_MODE) return;
  const [orders, leads, quotes, users] = await Promise.all([Api.admin.orders(), Api.admin.leads(), Api.admin.quotes(), Api.admin.users()]);
  REMOTE.orders = orders; REMOTE.leads = leads; REMOTE.quotes = quotes; REMOTE.users = users;
}
const handledLeads = () => new Set(load('spocart.leadsHandled', []));

function allOrdersAdmin() {
  if (!CONFIG.DEMO_MODE) return REMOTE.orders.slice().sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt));
  const stored = load('spocart.orders', []);
  const ids = new Set(stored.map((o) => o.id));
  return [...stored, ...ORDER_SEED.filter((o) => !ids.has(o.id))].sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt));
}
function saveOrderAdmin(o) {
  if (!CONFIG.DEMO_MODE) { const i = REMOTE.orders.findIndex((x) => x.id === o.id); if (i >= 0) REMOTE.orders[i] = o; else REMOTE.orders.unshift(o); return; }
  const stored = load('spocart.orders', []);
  const i = stored.findIndex((x) => x.id === o.id);
  if (i >= 0) stored[i] = o; else stored.unshift(o);
  save('spocart.orders', stored);
}
const enquiries = () => {
  if (CONFIG.DEMO_MODE) return load('spocart.enquiries', []);
  const done = handledLeads();
  const leads = REMOTE.leads.map((l) => ({ ref: `LEAD-${l.id.slice(0, 8)}`, id: l.id, kind: 'lead', topic: (l.message.match(/^\[(.+?)\]/) || [, 'enquiry'])[1].toLowerCase(), name: l.name, business: l.business || '', mobile: l.mobile, email: l.email || '', message: l.message.replace(/^\[.+?\]\s*/, ''), at: l.createdAt, handled: done.has(l.id) }));
  const quotes = REMOTE.quotes.map((q) => ({ ref: q.id, id: q.id, kind: 'quote', topic: `quote · ${q.status}`, name: q.contactName || '—', business: q.businessName || '', mobile: q.contactMobile || '', email: '', message: `${(q.items || []).map((i) => `${i.quantity} × ${i.description}`).join(', ')}${q.notes ? `\n${q.notes}` : ''}${q.quotedTotal ? `\nQuoted: ${inr(q.quotedTotal)}` : ''}`, file: q.designFileName || null, fileUrl: q.designFileUrl || null, at: q.createdAt, handled: ['quoted', 'accepted', 'declined'].includes(q.status), status: q.status }));
  return [...leads, ...quotes].sort((x, y) => new Date(y.at) - new Date(x.at));
};
const customers = () => (CONFIG.DEMO_MODE
  ? Object.entries(load('spocart.users', {})).map(([mobile, u]) => ({ mobile, ...u }))
  : REMOTE.users.map((u) => ({ mobile: u.mobile, id: u.id, ordersCount: u.orders, profile: { business: u.businessName || '(no profile yet)', contact: '', email: '', gstin: u.gstin || '', buyerType: 'shops', memberSince: u.createdAt, creditLimit: u.creditLimit }, addresses: [] })));
const customerFor = (o) => { if (o.buyerInfo) return o.buyerInfo.businessName || o.buyerInfo.contactName || o.address?.name || '—'; const u = load('spocart.users', {})[o.mobile]; return u?.profile?.business || o.address?.name || '—'; };
const lowStock = () => ALL_PRODUCTS.filter((p) => !p.hidden && p.stock <= LOW_STOCK);

// ---------- nav ----------
function goto(view) {
  $$('.admin-view').forEach((v) => { v.hidden = v.dataset.view !== view; });
  if (view === 'database') loadDbTables().then(loadDbRows);
  // Analytics costs three API calls, so it is fetched when opened rather than
  // on every render of every other view.
  if (view === 'analytics') loadAnalytics();
  $$('#adminNav [data-view]').forEach((b) => b.classList.toggle('is-active', b.dataset.view === view));
  if (location.hash !== `#${view}`) history.replaceState(null, '', `#${view}`);
  $('#adminNav').classList.remove('is-open');
  render();
}
$('#adminNav').addEventListener('click', (e) => { const b = e.target.closest('[data-view]'); if (b) goto(b.dataset.view); });
document.addEventListener('click', (e) => { const b = e.target.closest('[data-goto]'); if (b) goto(b.dataset.goto); });
$('#adminBurger').addEventListener('click', () => $('#adminNav').classList.toggle('is-open'));
$('#adminSignOut').addEventListener('click', () => { Auth.adminSignOut(); location.href = 'admin-login.html'; });

// ---------- overview ----------
function renderOverview() {
  const orders = allOrdersAdmin();
  const today = new Date().toDateString();
  const month = new Date().getMonth();
  const pending = orders.filter((o) => o.status === 'paymentPending');
  const revenue = orders.filter((o) => o.paid && o.status !== 'cancelled' && new Date(o.placedAt).getMonth() === month).reduce((n, o) => n + o.total, 0);
  const openEnq = enquiries().filter((e) => !e.handled).length;
  $('#today').textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  $('#adminStats').innerHTML = `
    <div class="stat"><b>${orders.filter((o) => new Date(o.placedAt).toDateString() === today).length}</b><span>Orders today</span></div>
    <div class="stat"><b>${fmtMoney(revenue)}</b><span>Paid this month</span></div>
    <div class="stat ${pending.length ? 'stat--alert' : ''}"><b>${pending.length}</b><span>Awaiting payment · ${fmtMoney(pending.reduce((n, o) => n + o.total, 0))}</span></div>
    <div class="stat"><b>${orders.filter((o) => ['placed', 'packed'].includes(o.status)).length}</b><span>To dispatch</span></div>
    <div class="stat ${openEnq ? 'stat--alert' : ''}"><b>${openEnq}</b><span>Open enquiries</span></div>
    <div class="stat ${lowStock().length ? 'stat--alert' : ''}"><b>${lowStock().length}</b><span>Low / out of stock</span></div>`;
  const todo = [];
  orders.filter((o) => o.status === 'placed').forEach((o) => todo.push({ t: `Pack ${o.id} — ${customerFor(o)} (${pcs(o)} pcs)`, v: 'orders' }));
  orders.filter((o) => o.status === 'packed').forEach((o) => todo.push({ t: `Dispatch ${o.id} — add courier tracking`, v: 'orders' }));
  enquiries().filter((e) => !e.handled).slice(0, 5).forEach((e) => todo.push({ t: `Reply to ${e.name} (${e.topic}) — ${Auth.formatMobile(e.mobile)}`, v: 'enquiries' }));
  PRODUCTS.filter((p) => p.stock === 0).forEach((p) => todo.push({ t: `Restock ${p.name} (out of stock)`, v: 'products' }));
  $('#todoList').innerHTML = todo.length ? todo.slice(0, 8).map((x) => `<li><button class="link" data-goto="${x.v}">${x.t}</button></li>`).join('') : '<li class="muted">All clear — nothing pending.</li>';
  $('#recentOrdersTable').innerHTML = `<thead><tr><th>Order</th><th>Customer</th><th>Status</th><th class="r">Total</th></tr></thead><tbody>${orders.slice(0, 6).map((o) => `<tr><td><b>${o.id}</b><small>${fmtDate(o.placedAt)}</small></td><td>${customerFor(o)}</td><td>${statusPill(o.status)}</td><td class="r"><b>${fmtMoney(o.total)}</b></td></tr>`).join('')}</tbody>`;
  $('#navOrders').textContent = pending.length + orders.filter((o) => ['placed', 'packed'].includes(o.status)).length || '';
  $('#navEnquiries').textContent = openEnq || '';
  $('#navLow').textContent = lowStock().length || '';
  $('#navAlerts').textContent = load('spocart.notify', []).length || '';
  $('#modeNote').innerHTML = CONFIG.DEMO_MODE ? '<b>Demo mode</b> — data is stored in this browser. Set DEMO_MODE=false in js/config.js to use the API.' : `<b>Live</b> — ${CONFIG.API_BASE_URL}${API_STATUS.error ? `<br><span style="color:var(--red)">${API_STATUS.error}</span>` : ''}`;
}
const statusPill = (s) => { const st = STATUS[s]; return `<span class="status status--${st.tone}">${st.label}</span>`; };

// ---------- orders ----------
function renderOrders() {
  const sel = $('#orderStatusFilter');
  if (sel.options.length === 1) Object.entries(STATUS).forEach(([k, v]) => sel.add(new Option(v.label, k)));
  const q = $('#orderSearch').value.trim().toLowerCase();
  const list = allOrdersAdmin().filter((o) => (!sel.value || o.status === sel.value) && (!q || [o.id, customerFor(o), o.mobile, o.address?.city].join(' ').toLowerCase().includes(q)));
  $('#ordersEmpty').hidden = list.length > 0;
  $('#ordersTable').innerHTML = `<thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Payment</th><th>Status</th><th class="r">Total</th><th>Actions</th></tr></thead><tbody>${list.map((o) => `
    <tr data-id="${o.id}">
      <td><b>${o.id}</b><small>${fmtDateTime(o.placedAt)}${o.staggered ? ' · staggered' : ''}</small></td>
      <td>${customerFor(o)}<small>${Auth.formatMobile(o.mobile) || '—'} · ${o.address?.city || ''}</small></td>
      <td>${o.lines.length} item${o.lines.length > 1 ? 's' : ''}<small>${pcs(o).toLocaleString('en-IN')} pcs</small></td>
      <td>${o.paid ? `<span class="tag tag--green">Paid</span><small>${o.paymentMethod || ''}</small>` : '<span class="tag tag--red">Unpaid</span>'}</td>
      <td>${statusPill(o.status)}${o.trackingId ? `<small>${o.trackingId}</small>` : ''}</td>
      <td class="r"><b>${fmtMoney(o.total)}</b></td>
      <td class="admin-actions-cell"><div class="admin-actions">
        <button class="btn btn--outline btn--sm" data-view-order="${o.id}">View</button>
        ${NEXT_STATUS[o.status] && o.status !== 'paymentPending' ? `<button class="btn btn--dark btn--sm" data-advance="${o.id}">→ ${STATUS[NEXT_STATUS[o.status]].label}</button>` : ''}
        ${!o.paid && o.status !== 'cancelled' ? `<button class="btn btn--outline btn--sm" data-mark-paid="${o.id}">${!CONFIG.DEMO_MODE && !o.paymentMethod.startsWith('Pay later') ? 'Check payment' : 'Mark paid'}</button>` : ''}
        ${['paymentPending', 'placed', 'packed'].includes(o.status) ? `<button class="link link--muted" data-cancel-order="${o.id}">Cancel</button>` : ''}
      </div></td>
    </tr>`).join('')}</tbody>`;
}

async function advance(o) {
  const next = NEXT_STATUS[o.status];
  if (!next) return;
  if (!CONFIG.DEMO_MODE) {
    if (next === 'placed') return toast('This order confirms when the customer pays (or you settle its invoice).');
    let trackingId;
    if (next === 'dispatched') { const t = prompt('Courier & tracking number:', o.trackingId || ''); if (t === null) return; trackingId = t.trim() || undefined; }
    try { saveOrderAdmin(await Api.admin.setStatus(o.id, next, trackingId)); render(); toast(`${o.id} → ${STATUS[next].label}`); } catch (ex) { toast(ex.message); }
    return;
  }
  if (next === 'dispatched' && !o.trackingId) {
    const t = prompt('Courier & tracking number (e.g. DTDC 7788 1234 90):', o.trackingId || '');
    if (t === null) return;
    o.trackingId = t.trim() || null;
  }
  o.status = next;
  o.history.push({ status: next, at: new Date().toISOString() });
  saveOrderAdmin(o); render();
  toast(`${o.id} → ${STATUS[next].label}${o.mobile ? ` · customer ${Auth.formatMobile(o.mobile)} notified` : ''}`);
}
async function markPaid(o) {
  if (!CONFIG.DEMO_MODE) {
    if (o.paymentMethod.startsWith('Pay later')) {
      const ref = prompt('Payment reference (UTR / cheque no.):'); if (!ref || ref.trim().length < 2) return;
      try { saveOrderAdmin(await Api.admin.settleInvoice(o.invoiceId, ref.trim())); render(); toast(`Invoice ${o.invoiceId} settled.`); } catch (ex) { toast(ex.message); }
    } else {
      try { const r = await Api.post(`/admin/orders/${o.id}/reconcile`); saveOrderAdmin(Api.mapOrder(r)); render(); toast(r.paid ? 'Payment found on Razorpay — order confirmed.' : 'Razorpay shows no captured payment yet.'); } catch (ex) { toast(ex.message); }
    }
    return;
  }
  const m = prompt('Payment received via (UPI / Net banking / Cash):', 'UPI');
  if (m === null) return;
  o.paid = true; o.paymentMethod = m.trim() || 'UPI';
  if (!o.invoiceId) o.invoiceId = `INV-26-${String(Math.floor(Math.random() * 9000) + 1000)}`;
  if (o.status === 'paymentPending') { o.status = 'placed'; o.history.push({ status: 'placed', at: new Date().toISOString() }); }
  saveOrderAdmin(o); render(); toast(`${o.id} marked paid · invoice ${o.invoiceId}`);
}
async function cancelOrder(o) {
  if (!CONFIG.DEMO_MODE) {
    if (!confirm(`Cancel ${o.id}?${o.paid ? ' A captured payment will be refunded automatically.' : ''}`)) return;
    try { saveOrderAdmin(await Api.admin.cancel(o.id)); render(); toast(`${o.id} cancelled.`); } catch (ex) { toast(ex.message); }
    return;
  }
  if (!confirm(`Cancel ${o.id}?${o.paid ? ' Remember to refund ' + fmtMoney(o.total) + '.' : ''}`)) return;
  o.status = 'cancelled'; o.history.push({ status: 'cancelled', at: new Date().toISOString() });
  saveOrderAdmin(o); render(); toast(`${o.id} cancelled.`);
}
function viewOrder(o) {
  $('#orderModalTitle').textContent = `${o.id} · ${customerFor(o)}`;
  $('#orderModalBody').innerHTML = `
    <div class="details-grid">
      <div>
        <h5>Items</h5>
        <table class="lines">${o.lines.map((l) => `<tr><td><img src="${l.image}" alt="" /></td><td><strong>${l.name}</strong><small>${fmtMoney(l.unitPrice)}/${l.unit}</small></td><td>${l.quantity}</td><td><b>${fmtMoney(l.quantity * l.unitPrice)}</b></td></tr>`).join('')}</table>
        <div class="totals totals--card">
          <div><span>Subtotal</span><b>${fmtMoney(o.subtotal)}</b></div>
          ${o.discount ? `<div><span>Coupon ${o.coupon}</span><b>−${fmtMoney(o.discount)}</b></div>` : ''}
          <div><span>GST</span><b>${fmtMoney(o.gst)}</b></div><div><span>Freight</span><b>${o.freight ? fmtMoney(o.freight) : 'Free'}</b></div>
          <div class="totals__grand"><span>Total</span><b>${fmtMoney(o.total)}</b></div>
        </div>
      </div>
      <div class="details-side">
        <h5>${icon('i-pin')} Deliver to</h5><p><strong>${o.address?.name || ''}</strong><br>${o.address?.line || ''}<br>${o.address?.city || ''}<br>${o.address?.phone || Auth.formatMobile(o.mobile) || ''}${o.address?.gstin ? `<br><small>GSTIN ${o.address.gstin}</small>` : ''}</p>
        <h5>${icon('i-card')} Payment</h5><p>${o.paid ? `Paid via ${o.paymentMethod}` : 'Unpaid'}${o.invoiceId ? `<br><small>${o.invoiceId}</small>` : ''}</p>
        <h5>${icon('i-truck')} Tracking</h5><p>${CONFIG.DEMO_MODE ? `<input class="admin-inline" id="trackingInput" value="${o.trackingId || ''}" placeholder="Courier + tracking no." /> <button class="btn btn--dark btn--sm" id="saveTracking">Save</button>` : (o.trackingId || '<span class="muted">Set when you mark the order dispatched</span>')}</p>
        <h5>${icon('i-clock')} Timeline</h5>
        <ul class="timeline">${[...o.history].reverse().map((h, i) => `<li class="${i === 0 ? 'is-latest' : ''}"><b>${STATUS[h.status].label}</b><span>${fmtDateTime(h.at)}</span></li>`).join('')}</ul>
        ${o.mobile ? `<a class="btn btn--outline btn--sm" target="_blank" rel="noopener" href="https://wa.me/91${o.mobile}?text=${encodeURIComponent(`Hi, this is SPOCART about order ${o.id}.`)}">${icon('i-whatsapp')} WhatsApp customer</a>` : ''}
      </div>
    </div>`;
  $('#orderModal').hidden = false;
  $('#saveTracking')?.addEventListener('click', () => { o.trackingId = $('#trackingInput').value.trim() || null; saveOrderAdmin(o); render(); toast('Tracking saved.'); });
}
$('#closeOrderModal').addEventListener('click', () => { $('#orderModal').hidden = true; });
$('#orderModal').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.hidden = true; });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('#orderModal').hidden = true; });

function exportOrders() {
  const rows = [['Order', 'Date', 'Customer', 'Mobile', 'City', 'Items', 'Pcs', 'Subtotal', 'GST', 'Freight', 'Total', 'Paid', 'Payment', 'Status', 'Tracking']];
  allOrdersAdmin().forEach((o) => rows.push([o.id, new Date(o.placedAt).toISOString().slice(0, 10), customerFor(o), o.mobile || '', o.address?.city || '', o.lines.length, pcs(o), Math.round(o.subtotal), Math.round(o.gst), o.freight || 0, Math.round(o.total), o.paid ? 'yes' : 'no', o.paymentMethod || '', STATUS[o.status].label, o.trackingId || '']));
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `spocart-orders-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
}

// ---------- enquiries ----------
function renderEnquiries() {
  const list = enquiries().filter((e) => $('#showHandled').checked || !e.handled);
  $('#enquiriesEmpty').hidden = list.length > 0;
  $('#enquiriesTable').innerHTML = `<thead><tr><th>Ref</th><th>Topic</th><th>From</th><th>Requirement</th><th>Status</th><th>Actions</th></tr></thead><tbody>${list.map((e) => `
    <tr class="${e.handled ? 'is-muted' : ''}">
      <td><b>${e.ref}</b><small>${fmtDateTime(e.at)}</small></td>
      <td><span class="tag tag--grey">${e.topic}</span></td>
      <td>${e.name}<small>${e.business || ''} · ${Auth.formatMobile(e.mobile)}${e.email ? ` · ${e.email}` : ''}${e.city ? ` · ${e.city}` : ''}</small></td>
      <td class="wrap">${e.message}${e.file ? `<small>Attachment: ${e.fileUrl ? `<a class="link" href="${e.fileUrl}" target="_blank" rel="noopener">${e.file}</a>` : e.file}</small>` : ''}${e.volume ? `<small>Volume: ${e.volume}</small>` : ''}</td>
      <td>${e.handled ? '<span class="tag tag--green">Handled</span>' : '<span class="tag tag--red">New</span>'}</td>
      <td class="admin-actions-cell"><div class="admin-actions">
        ${e.mobile ? `<a class="btn btn--outline btn--sm" target="_blank" rel="noopener" href="https://wa.me/91${e.mobile}?text=${encodeURIComponent(`Hi ${e.name}, this is SPOCART about your request ${e.ref}.`)}">WhatsApp</a><a class="btn btn--outline btn--sm" href="tel:+91${e.mobile}">Call</a>` : ''}
        ${e.kind === 'quote' && !CONFIG.DEMO_MODE
          ? (e.handled ? '' : `<button class="btn btn--dark btn--sm" data-quote-respond="${e.id}">Send quote</button><button class="link link--muted" data-quote-decline="${e.id}">Decline</button>`)
          : (e.handled ? `<button class="link link--muted" data-reopen="${e.ref}">Reopen</button>` : `<button class="btn btn--dark btn--sm" data-handle="${e.ref}">Mark handled</button>`)}
      </div></td>
    </tr>`).join('')}</tbody>`;
}
function setHandled(ref, val) {
  if (!CONFIG.DEMO_MODE) { const e = enquiries().find((x) => x.ref === ref); if (!e) return; const s = handledLeads(); val ? s.add(e.id) : s.delete(e.id); save('spocart.leadsHandled', [...s]); render(); toast(val ? `${ref} marked handled.` : `${ref} reopened.`); return; }
  const list = enquiries(); const e = list.find((x) => x.ref === ref); if (e) { e.handled = val; save('spocart.enquiries', list); render(); toast(val ? `${ref} marked handled.` : `${ref} reopened.`); }
}
async function respondQuote(id) {
  const total = Number(prompt('Quoted total in ₹ (incl. GST):')); if (!(total > 0)) return;
  const note = prompt('Note to the buyer (optional):') || undefined;
  try { await Api.admin.respondQuote(id, total, note); await reloadRemote(); render(); toast('Quote sent to the buyer.'); } catch (ex) { toast(ex.message); }
}
async function declineQuote(id) {
  if (!confirm('Decline this quote request?')) return;
  try { await Api.admin.declineQuote(id, prompt('Reason (optional):') || undefined); await reloadRemote(); render(); toast('Quote declined.'); } catch (ex) { toast(ex.message); }
}

// ---------- products ----------
const IMAGE_CHOICES = Object.entries(IMG);
const isBase = (id) => PRODUCT_BASE_IDS.has(id);

function renderProducts() {
  const sel = $('#productCatFilter');
  if (sel.options.length === 1) CATEGORIES.forEach((c) => sel.add(new Option(c.name, c.id)));
  const q = $('#productSearch').value.trim().toLowerCase();
  const list = ALL_PRODUCTS.filter((p) => (!sel.value || p.cat === sel.value) && (!$('#lowOnly').checked || p.stock <= LOW_STOCK) && (!q || [p.name, p.brand, catById(p.cat)?.name].join(' ').toLowerCase().includes(q)));
  $('#productCount').textContent = `${ALL_PRODUCTS.length} products · ${ALL_PRODUCTS.filter((p) => p.hidden).length} hidden`;
  // The row shows; it does not edit. The two switches are the exceptions,
  // because stock and deal are the things that change daily — they save the
  // moment they are flipped, so there is nothing to remember to press.
  // Everything else lives in one place: the Edit sheet.
  $('#productsTable').innerHTML = `<thead><tr><th>Product</th><th>Category</th><th>Price</th><th>In stock</th><th>On deal</th><th></th></tr></thead><tbody>${list.map((p) => {
    const prices = p.slabs.map(([, price]) => price);
    const top = Math.max(...prices), best = Math.min(...prices);
    return `
    <tr data-id="${p.id}" class="${p.hidden ? 'is-muted' : p.stock === 0 ? 'is-out' : p.stock <= LOW_STOCK ? 'is-low' : ''}">
      <td><div class="admin-product"><img src="${p.img}" alt="" /><div><b>${p.name}</b> ${p.hidden ? '<span class="tag tag--grey">Hidden</span>' : ''}${!isBase(p.id) ? '<span class="tag tag--dark">Custom</span>' : ''}<small>${p.brand} · MOQ ${p.moq} ${plural(p, p.moq)}</small></div></div></td>
      <td>${catById(p.cat)?.name || p.cat}</td>
      <td class="prow-price">${top === best ? fmtMoney(top) : `${fmtMoney(top)} <span>→</span> ${fmtMoney(best)}`}<small>${p.slabs.length} price slab${p.slabs.length === 1 ? '' : 's'}</small></td>
      <td>${CONFIG.DEMO_MODE
        ? `<input class="admin-inline admin-inline--num" type="number" min="0" data-stock value="${p.stock}" />`
        : `<div class="admin-toggle"><label class="switch"><input type="checkbox" data-stock-flag ${p.stock > 0 ? 'checked' : ''} /><i></i></label><small>${p.stock > 0 ? 'Yes' : 'No'}</small></div>`}</td>
      <td><div class="admin-toggle"><label class="switch"><input type="checkbox" data-deal ${p.deal ? 'checked' : ''} /><i></i></label><small>${p.deal ? 'Yes' : 'No'}</small></div></td>
      <td class="admin-actions-cell"><div class="admin-actions"><button class="btn btn--outline btn--sm" data-edit-product="${p.id}">Edit</button></div></td>
    </tr>`; }).join('')}</tbody>`;
}

/** A switch in the product table saves itself — there is no Save button now. */
function toggleProductFlag(input) {
  const row = input.closest('tr');
  const p = byId(row.dataset.id);
  if (!p) return;
  const isStock = input.hasAttribute('data-stock-flag');
  const patch = isStock ? { stock: input.checked ? 9999 : 0 } : { deal: input.checked };
  const what = isStock
    ? (input.checked ? 'back in stock' : 'marked out of stock')
    : (input.checked ? 'added to deals' : 'removed from deals');
  commitProduct(p, patch, `${p.name} ${what}.`);
}

/** Persist a full or partial product change; `wasOut` handles notify-me clearing. */
async function commitProduct(p, patch, msg) {
  const wasOut = p.stock === 0;
  Object.assign(p, patch);
  if (!CONFIG.DEMO_MODE) {
    try { const saved = await Api.admin.saveProduct(p, false); Object.assign(p, saved); } catch (ex) { toast(ex.message); return; }
  }
  if (isBase(p.id)) { CATALOG_EDITS.overrides[p.id] = { ...(CATALOG_EDITS.overrides[p.id] || {}), ...patch }; }
  else { const i = CATALOG_EDITS.added.findIndex((x) => x.id === p.id); if (i >= 0) CATALOG_EDITS.added[i] = { ...CATALOG_EDITS.added[i], ...patch }; }
  saveCatalogEdits();
  // keep the storefront list (PRODUCTS) in sync with hidden flag
  const inStore = PRODUCTS.findIndex((x) => x.id === p.id);
  if (p.hidden && inStore >= 0) PRODUCTS.splice(inStore, 1);
  if (!p.hidden && inStore < 0) PRODUCTS.push(p);
  if (wasOut && p.stock > 0) {
    const notify = load('spocart.notify', []);
    if (notify.includes(p.id)) { save('spocart.notify', notify.filter((x) => x !== p.id)); msg += ' Back-in-stock requests notified.'; }
  }
  render(); toast(msg);
}
/** Demo mode keeps a numeric stock box, so it still needs a commit on change. */
function saveStockCount(input) {
  const p = byId(input.closest('tr').dataset.id);
  if (!p) return;
  const stock = Math.max(0, Number(input.value) || 0);
  if (stock === p.stock) return;
  commitProduct(p, { stock }, `${p.name} stock set to ${stock}.`);
}

// ----- full editor (add / edit) -----
function openProductEditor(p = null) {
  const f = $('#productForm');
  f.reset();
  $('#productModalTitle').textContent = p ? `Edit — ${p.name}` : 'Add product';
  f.elements.id.value = p?.id || '';
  f.elements.name.value = p?.name || '';
  f.elements.desc.value = p?.desc || '';
  const brandSel = f.elements.brand; brandSel.innerHTML = BRANDS.map((b) => `<option>${b}</option>`).join('') + '<option value="__new">+ New brand…</option>';
  brandSel.value = p?.brand && BRANDS.includes(p.brand) ? p.brand : (p?.brand ? '__new' : BRANDS[0]);
  f.elements.newBrand.value = p?.brand && !BRANDS.includes(p.brand) ? p.brand : '';
  f.elements.newBrand.parentElement.hidden = brandSel.value !== '__new';
  const catSel = f.elements.cat; catSel.innerHTML = CATEGORIES.map((c) => `<option value="${c.id}">${c.name}</option>`).join(''); catSel.value = p?.cat || 'football';
  f.elements.unit.value = p?.unit || 'pc';
  f.elements.moq.value = p?.moq ?? 10;
  f.elements.mrp.value = p?.mrp ?? '';
  renderSlabRows(p?.slabs || [[10, ''], [100, ''], [500, '']]);
  f.elements.stock.value = p?.stock ?? 100;
  f.elements.inStock.value = (p ? p.stock > 0 : true) ? '1' : '0';
  f.elements.rating.value = p?.rating ?? 4.5;
  f.elements.reviews.value = p?.reviews ?? 0;
  f.elements.audShops.checked = p ? p.audience.includes('shops') : true;
  f.elements.audSchools.checked = p ? p.audience.includes('schools') : true;
  f.elements.deal.checked = !!p?.deal;
  f.elements.hidden.checked = !!p?.hidden;
  const imgSel = f.elements.imgChoice; imgSel.innerHTML = IMAGE_CHOICES.map(([k, v]) => `<option value="${v}">${k}</option>`).join('') + '<option value="__custom">Uploaded / custom URL</option>';
  const known = IMAGE_CHOICES.find(([, v]) => v === p?.img);
  imgSel.value = known ? known[1] : (p ? '__custom' : IMAGE_CHOICES[0][1]);
  f.elements.imgUrl.value = known ? '' : (p?.img || '');
  $('#imgPreview').src = p?.img || IMAGE_CHOICES[0][1];
  $('#productFormError').hidden = true;
  $('#resetProduct').hidden = !(CONFIG.DEMO_MODE && p && isBase(p.id) && CATALOG_EDITS.overrides[p.id]);
  $('#deleteProduct').hidden = !p || (!CONFIG.DEMO_MODE && p.hidden);
  $('#deleteProduct').textContent = !CONFIG.DEMO_MODE ? 'Hide from store' : p && isBase(p.id) ? 'Remove from store' : 'Delete product';
  // The server tracks availability as a yes/no flag, not a count.
  f.elements.mrp.required = CONFIG.DEMO_MODE;
  f.elements.mrp.closest('label').hidden = !CONFIG.DEMO_MODE;
  $('#stockNumField').hidden = !CONFIG.DEMO_MODE;
  $('#stockFlagField').hidden = CONFIG.DEMO_MODE;
  $('#productModal').hidden = false;
}

/** Slab rows are built from the product — the API allows any number of tiers. */
function renderSlabRows(slabs) {
  $('#slabRows').innerHTML = slabs.map(([min, price], i) => `
    <div class="slab-editor__row" data-slab-row>
      <span>${i === 0 ? 'Slab 1 (MOQ)' : i === slabs.length - 1 ? `Slab ${i + 1} (best)` : `Slab ${i + 1}`}</span>
      <input type="number" min="1" data-slab-min value="${min}" />
      <input type="number" min="1" data-slab-price value="${price}" />
      <button type="button" class="icon-btn" data-remove-slab aria-label="Remove slab" ${slabs.length < 2 ? 'disabled' : ''}>${icon('i-close')}</button>
    </div>`).join('');
}
function readSlabRows() {
  return $$('#slabRows [data-slab-row]').map((row) => [Number(row.querySelector('[data-slab-min]').value), Number(row.querySelector('[data-slab-price]').value)]);
}

function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40); }

function submitProductEditor(e) {
  e.preventDefault();
  const f = e.target; const fd = new FormData(f);
  const v = (k) => String(fd.get(k) || '').trim();
  const fail = (m) => { const el = $('#productFormError'); el.textContent = m; el.hidden = false; };
  const brand = v('brand') === '__new' ? v('newBrand') : v('brand');
  if (!v('name') || !brand) return fail('Product name and brand are required.');
  const mrp = CONFIG.DEMO_MODE ? Number(v('mrp')) : null, moq = Number(v('moq'));
  const stock = CONFIG.DEMO_MODE ? Number(v('stock')) : (v('inStock') === '1' ? 9999 : 0);
  if (CONFIG.DEMO_MODE && !(mrp > 0)) return fail('Enter the MRP.');
  if (!(moq >= 1)) return fail('MOQ must be at least 1.');
  const slabs = readSlabRows();
  if (!slabs.length) return fail('Add at least one price slab.');
  if (slabs.some(([m, price]) => !(m >= 1) || !(price > 0))) return fail('Every slab needs a minimum quantity and a price.');
  if (slabs.some(([m], i) => i > 0 && m <= slabs[i - 1][0])) return fail('Slab quantities must increase (e.g. 10, 100, 500).');
  if (slabs.some(([, price], i) => i > 0 && price > slabs[i - 1][1])) return fail('Slab prices should fall as quantity rises.');
  if (mrp && slabs[slabs.length - 1][1] > mrp) return fail('Slab prices must be below MRP.');
  if (slabs[0][0] < moq) slabs[0][0] = moq;
  const audience = [f.elements.audShops.checked && 'shops', f.elements.audSchools.checked && 'schools'].filter(Boolean);
  if (!audience.length) return fail('Pick at least one buyer type.');
  const img = v('imgChoice') === '__custom' ? (v('imgUrl') || $('#imgPreview').src) : v('imgChoice');
  if (!img) return fail('Choose or upload a product image.');
  if (!CONFIG.DEMO_MODE && img.startsWith('data:')) return fail('Use the upload button (or paste an image URL) — the server stores images, not inline data.');
  if (brand && !BRANDS.includes(brand)) BRANDS.push(brand);
  const patch = { name: v('name'), desc: v('desc'), brand, cat: v('cat'), unit: v('unit') || 'pc', moq, mrp, slabs, images: CONFIG.DEMO_MODE ? undefined : (img.startsWith('http') || img.startsWith('/') ? [img, ...(byId(v('id'))?.images || []).filter((x) => x !== img)] : (byId(v('id'))?.images || [])), stock: Math.max(0, stock || 0), rating: Math.min(5, Math.max(0, Number(v('rating')) || 0)), reviews: Math.max(0, Number(v('reviews')) || 0), audience, deal: f.elements.deal.checked, hidden: f.elements.hidden.checked, img };
  const id = v('id');
  if (id) { commitProduct(byId(id), patch, `${patch.name} updated.`); }
  else {
    let newId = slug(patch.name) || 'product'; let n = 1; while (byId(newId)) newId = `${slug(patch.name)}-${++n}`;
    const p = { id: newId, ...patch };
    if (!CONFIG.DEMO_MODE) {
      Api.admin.saveProduct(p, true).then((saved) => { ALL_PRODUCTS.push(saved); if (!saved.hidden) PRODUCTS.push(saved); PRODUCT_BASE_IDS.add(saved.id); render(); toast(`${saved.name} added to the catalogue.`); $('#productModal').hidden = true; })
        .catch((ex) => fail(ex.message));
      return;
    }
    ALL_PRODUCTS.push(p); if (!p.hidden) PRODUCTS.push(p);
    CATALOG_EDITS.added.push(p); saveCatalogEdits();
    render(); toast(`${p.name} added to the catalogue.`);
  }
  $('#productModal').hidden = true;
}

function deleteProduct(id) {
  const p = byId(id);
  if (!CONFIG.DEMO_MODE) {
    if (!p || !confirm(`Hide ${p.name} from the store? (Products are never deleted on the server; untick "Hide from store" to bring it back.)`)) return;
    commitProduct(p, { hidden: true }, `${p.name} hidden from the store.`); $('#productModal').hidden = true; return;
  }
  if (!p || !confirm(isBase(id) ? `Remove ${p.name} from the store? (You can restore it with "Reset to default" later — it stays in the default catalogue.)` : `Delete ${p.name} permanently?`)) return;
  if (isBase(id)) { if (!CATALOG_EDITS.removed.includes(id)) CATALOG_EDITS.removed.push(id); delete CATALOG_EDITS.overrides[id]; }
  else CATALOG_EDITS.added = CATALOG_EDITS.added.filter((x) => x.id !== id);
  saveCatalogEdits();
  [PRODUCTS, ALL_PRODUCTS].forEach((arr) => { const i = arr.findIndex((x) => x.id === id); if (i >= 0) arr.splice(i, 1); });
  $('#productModal').hidden = true; render(); toast(`${p.name} removed.`);
}
function resetProduct(id) {
  if (!confirm('Discard all admin edits for this product and restore the default catalogue values?')) return;
  delete CATALOG_EDITS.overrides[id]; CATALOG_EDITS.removed = CATALOG_EDITS.removed.filter((x) => x !== id); saveCatalogEdits();
  location.reload();
}
function restoreRemoved() {
  if (!CATALOG_EDITS.removed.length) return toast('Nothing removed from the default catalogue.');
  if (!confirm(`Restore ${CATALOG_EDITS.removed.length} removed default product(s)?`)) return;
  CATALOG_EDITS.removed = []; saveCatalogEdits(); location.reload();
}

// ---------- customers ----------
function renderCustomers() {
  const list = customers();
  const orders = allOrdersAdmin();
  $('#customerCount').textContent = `${list.length} registered`;
  $('#customersEmpty').hidden = list.length > 0;
  $('#customersTable').innerHTML = `<thead><tr><th>Business</th><th>Contact</th><th>Type</th><th>GSTIN</th><th>City</th><th class="r">Orders</th><th class="r">Lifetime value</th><th>Joined</th></tr></thead><tbody>${list.map((c) => {
    const mine = orders.filter((o) => o.mobile === c.mobile && o.status !== 'cancelled');
    const def = (c.addresses || []).find((a) => a.isDefault) || (c.addresses || [])[0];
    const credit = !CONFIG.DEMO_MODE ? `<small>Credit ${fmtMoney(c.profile.creditLimit || 0)} · <button class="link" data-credit="${c.id}" data-current="${c.profile.creditLimit || 0}">change</button></small>` : '';
    return `<tr><td><b>${c.profile.business}</b>${credit}</td><td>${c.profile.contact}<small>${Auth.formatMobile(c.mobile)} · ${c.profile.email || ''}</small></td><td>${BUYER_TYPES[c.profile.buyerType || 'shops'].label}</td><td>${c.profile.gstin || '—'}</td><td>${def?.city || '—'}</td><td class="r">${c.ordersCount ?? mine.length}</td><td class="r"><b>${fmtMoney(mine.reduce((n, o) => n + o.total, 0))}</b></td><td>${c.profile.memberSince ? fmtDate(c.profile.memberSince) : '—'}</td></tr>`;
  }).join('')}</tbody>`;
}

// ---------- stock alerts ----------
function renderAlerts() {
  const ids = load('spocart.notify', []);
  $('#alertsEmpty').hidden = ids.length > 0;
  $('#alertsTable').innerHTML = `<thead><tr><th>Product</th><th>Brand</th><th>Stock now</th><th></th></tr></thead><tbody>${ids.map((id) => { const p = byId(id); return p ? `<tr><td><b>${p.name}</b></td><td>${p.brand}</td><td>${p.stock}</td><td><button class="btn btn--dark btn--sm" data-goto="products">Restock</button></td></tr>` : ''; }).join('')}</tbody>`;
}

// ---------- database console (API mode) ----------
const DB = { tables: [], table: null, rows: [], total: 0, offset: 0, limit: 50, q: '', stats: {} };
const dbApi = {
  tables: () => Api.get('/admin/db'), stats: () => Api.get('/admin/db/_meta/stats'),
  list: (t, q, offset, limit) => Api.get(`/admin/db/${t}?q=${encodeURIComponent(q)}&offset=${offset}&limit=${limit}`),
  create: (t, body) => Api.post(`/admin/db/${t}`, body), update: (t, id, body) => Api.put(`/admin/db/${t}/${encodeURIComponent(id)}`, body), remove: (t, id) => Api.del(`/admin/db/${t}/${encodeURIComponent(id)}`),
};
const dbMeta = () => DB.tables.find((t) => t.name === DB.table);
const cell = (v, f) => {
  if (v == null || v === '') return '<span class="muted">—</span>';
  if (f.type === 'bool') return v ? '<span class="tag tag--green">yes</span>' : '<span class="tag tag--grey">no</span>';
  if (f.type === 'money') return fmtMoney(v);
  if (f.type === 'tiers') return v.map((t) => `${t.minQty}+ ${fmtMoney(t.unitPrice)}`).join(' · ');
  if (f.type === 'list') return (v || []).join(', ');
  if (f.type === 'json') return `<code>${String(JSON.stringify(v)).slice(0, 60)}</code>`;
  if (/At$/.test(f.name) && /\d{4}-\d{2}-\d{2}T/.test(String(v))) return fmtDateTime(v);
  return String(v).length > 60 ? String(v).slice(0, 60) + '…' : String(v);
};

async function loadDbTables() {
  if (CONFIG.DEMO_MODE || DB.tables.length) return;
  try { [DB.tables, DB.stats] = await Promise.all([dbApi.tables(), dbApi.stats()]); DB.table = DB.table || 'products'; } catch (ex) { toast(ex.message); }
}
async function loadDbRows() {
  if (!DB.table) return;
  try { const r = await dbApi.list(DB.table, DB.q, DB.offset, DB.limit); DB.rows = r.rows; DB.total = r.total; } catch (ex) { toast(ex.message); DB.rows = []; DB.total = 0; }
  renderDb();
}
function renderDb() {
  if (CONFIG.DEMO_MODE) { $('#dbSummary').textContent = 'The database console needs the live API (DEMO_MODE is on).'; $('#dbTableEl').innerHTML = ''; return; }
  const sel = $('#dbTable');
  if (sel.options.length !== DB.tables.length) sel.innerHTML = DB.tables.map((t) => `<option value="${t.name}">${t.label}</option>`).join('');
  sel.value = DB.table;
  $('#dbTabs').innerHTML = DB.tables.map((t) => `<button class="chip-btn ${t.name === DB.table ? 'is-active' : ''}" data-db-table="${t.name}">${t.label} <em>${DB.stats[t.name] ?? ''}</em></button>`).join('');
  const meta = dbMeta(); if (!meta) return;
  $('#dbAdd').hidden = meta.noCreate;
  $('#dbSummary').textContent = `${DB.total.toLocaleString('en-IN')} row${DB.total === 1 ? '' : 's'} in ${meta.label}${DB.q ? ` matching “${DB.q}”` : ''}`;
  const cols = meta.fields.filter((f) => !['json', 'textarea'].includes(f.type)).slice(0, 9);
  $('#dbEmpty').hidden = DB.rows.length > 0;
  $('#dbTableEl').innerHTML = `<thead><tr>${cols.map((f) => `<th>${f.label}</th>`).join('')}<th></th></tr></thead><tbody>${DB.rows.map((row) => `
    <tr data-db-id="${row[meta.id]}">${cols.map((f) => `<td class="${f.type === 'money' || f.type === 'number' ? 'r' : ''}">${cell(row[f.name], f)}</td>`).join('')}
    <td class="admin-actions-cell"><div class="admin-actions"><button class="btn btn--outline btn--sm" data-db-edit="${row[meta.id]}">${meta.noUpdate ? 'View' : 'Edit'}</button></div></td></tr>`).join('')}</tbody>`;
  const pages = Math.ceil(DB.total / DB.limit), page = Math.floor(DB.offset / DB.limit) + 1;
  $('#dbPager').innerHTML = pages > 1 ? `<button class="page-btn" data-db-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>${icon('i-chevron-left')}</button><span class="page-gap">Page ${page} of ${pages}</span><button class="page-btn" data-db-page="${page + 1}" ${page === pages ? 'disabled' : ''}>${icon('i-chevron-right')}</button>` : '';
}
function dbField(f, value, isNew) {
  const ro = f.readonly || (f.key && !isNew) || dbMeta().noUpdate;
  const base = `name="${f.name}" ${ro ? 'disabled' : ''}`;
  const hint = f.hint ? `<em>(${f.hint})</em>` : '';
  let input;
  switch (f.type) {
    case 'bool': return `<label class="check check--inline" style="align-self:end"><input type="checkbox" ${base} ${value ? 'checked' : ''} /><i>${icon('i-check')}</i><span>${f.label}</span></label>`;
    case 'enum': input = `<select ${base}>${(f.options || []).map((o) => `<option ${o === value ? 'selected' : ''}>${o}</option>`).join('')}</select>`; break;
    case 'number': case 'money': input = `<input type="number" step="${f.type === 'money' ? '0.01' : 'any'}" ${base} value="${value ?? ''}" />`; break;
    case 'date': input = `<input type="date" ${base} value="${value ? String(value).slice(0, 10) : ''}" />`; break;
    case 'textarea': input = `<textarea rows="3" ${base}>${value ?? ''}</textarea>`; break;
    case 'list': input = `<input ${base} value="${(value || []).join(', ')}" placeholder="comma, separated" />`; break;
    case 'json': case 'tiers': input = `<textarea rows="4" ${base} data-json>${value == null ? '' : JSON.stringify(value, null, 1)}</textarea>`; break;
    default: input = `<input ${base} value="${value ?? ''}" />`;
  }
  const wide = ['textarea', 'json', 'tiers'].includes(f.type) || f.name === 'address' ? 'span-2' : '';
  return `<label class="field ${wide}"><span>${f.label} ${hint}${f.ref ? `<em>(→ ${f.ref})</em>` : ''}</span>${input}</label>`;
}
function openDbEditor(row = null) {
  const meta = dbMeta(); const isNew = !row;
  $('#dbModalTitle').textContent = isNew ? `Add to ${meta.label}` : `${meta.label} · ${row[meta.id]}`;
  $('#dbFields').innerHTML = meta.fields.filter((f) => isNew ? (!f.readonly && (!f.key || f.create)) : true).map((f) => dbField(f, row ? row[f.name] : (f.type === 'bool' ? (f.name === 'active' || f.name === 'inStock') : ''), isNew)).join('');
  $('#dbForm').dataset.id = row ? row[meta.id] : '';
  $('#dbDelete').hidden = isNew;
  $('#dbSave').hidden = meta.noUpdate && !isNew;
  $('#dbFormError').hidden = true;
  $('#dbModal').hidden = false;
}
async function submitDb(e) {
  e.preventDefault();
  const meta = dbMeta(); const form = e.target; const id = form.dataset.id; const body = {};
  const fail = (m) => { const el = $('#dbFormError'); el.textContent = m; el.hidden = false; };
  for (const f of meta.fields) {
    const el = form.elements[f.name]; if (!el || el.disabled) continue;
    let v;
    if (f.type === 'bool') v = el.checked;
    else if (f.type === 'number' || f.type === 'money') v = el.value === '' ? null : Number(el.value);
    else if (f.type === 'list') v = el.value.split(',').map((s) => s.trim()).filter(Boolean);
    else if (f.type === 'json' || f.type === 'tiers') { if (!el.value.trim()) continue; try { v = JSON.parse(el.value); } catch { return fail(`${f.label}: invalid JSON`); } }
    else v = el.value.trim() === '' ? (id ? null : undefined) : el.value.trim();
    if (v === undefined) continue;
    if (v === null && !id) continue;
    body[f.name] = v;
  }
  try {
    if (id) await dbApi.update(meta.name, id, body); else await dbApi.create(meta.name, body);
    $('#dbModal').hidden = true; toast(id ? 'Row updated.' : 'Row created.');
    DB.stats = await dbApi.stats(); await loadDbRows();
    if (meta.name === 'products' || meta.name === 'categories') { toast('Saved — reload the page to refresh the storefront catalogue.'); }
  } catch (ex) { fail(ex.message); }
}
async function deleteDbRow() {
  const meta = dbMeta(); const id = $('#dbForm').dataset.id;
  if (!confirm(`Delete this row from ${meta.label}? This cannot be undone.`)) return;
  try { await dbApi.remove(meta.name, id); $('#dbModal').hidden = true; toast('Row deleted.'); DB.stats = await dbApi.stats(); await loadDbRows(); } catch (ex) { toast(ex.message); }
}

// ---------- master ----------
// ---------- analytics ----------
// Everything here is read from the orders themselves, so the numbers are the
// books rather than an estimate. One series per chart, one y-scale, and a
// table view beside it — see the note on the chart markup below.

const ANALYTICS = { sales: null, products: null, metric: 'total', days: 30, loading: false };

const dayKey = (d) => d.toISOString().slice(0, 10);

async function loadAnalytics() {
  if (CONFIG.DEMO_MODE || ANALYTICS.loading) return;
  ANALYTICS.loading = true;
  $('#analyticsRange').textContent = 'Loading…';
  const days = ANALYTICS.days;
  const from = dayKey(new Date(Date.now() - days * 864e5));
  const to = dayKey(new Date());
  try {
    const [sales, products] = await Promise.all([
      Api.admin.salesReport(from, to),
      Api.admin.productInterest(days, 10).catch(() => null),
    ]);
    ANALYTICS.sales = sales;
    ANALYTICS.products = products;
    renderAnalytics();
  } catch (ex) {
    $('#analyticsRange').textContent = '';
    $('#analyticsStats').innerHTML = `<p class="muted">Could not load analytics: ${ex.message}</p>`;
  } finally {
    ANALYTICS.loading = false;
  }
}

function renderAnalytics() {
  const s = ANALYTICS.sales;
  if (!s) return;

  $('#analyticsRange').textContent =
    `${new Date(s.from).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${new Date(s.to).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  // Headline numbers: a KPI row, not a chart — each is a single value.
  $('#analyticsStats').innerHTML = [
    ['Revenue', fmtMoney(s.total)],
    ['Orders', s.orders],
    ['Buyers', s.buyers],
    ['Average order', fmtMoney(s.averageOrder)],
    ['GST collected', fmtMoney(s.gst)],
    ['Ex-GST', fmtMoney(s.subtotal)],
  ].map(([label, value]) => `<div class="stat"><small>${label}</small><b>${value}</b></div>`).join('');

  renderSalesChart();
  renderMonthly();
  renderStockSummary();
  renderProductInterest();
}

/**
 * One series, one y-scale. Bars are HTML rather than SVG so the hover target is
 * the bar itself and the whole thing reflows with the card; only the tallest
 * bar is labelled, because a number on every column is noise.
 */
function renderSalesChart() {
  const s = ANALYTICS.sales;
  const metric = ANALYTICS.metric;
  const rows = s.byDay;
  const el = $('#salesChart');

  $('#salesChartTitle').textContent = metric === 'total' ? 'Revenue per day' : 'Orders per day';
  $('#salesToggle').textContent = metric === 'total' ? 'Show orders instead' : 'Show revenue instead';

  if (!rows.length) {
    el.innerHTML = '<p class="muted">No orders in this period yet.</p>';
    $('#salesTable').innerHTML = '';
    return;
  }

  const peak = Math.max(...rows.map((r) => r[metric]));
  const peakDay = rows.find((r) => r[metric] === peak);
  const fmt = (v) => (metric === 'total' ? fmtMoney(v) : v);

  el.innerHTML = `<div class="chart__plot">${rows.map((r) => {
    const h = peak === 0 ? 0 : Math.round((r[metric] / peak) * 100);
    const isPeak = r === peakDay;
    return `<div class="chart__col" tabindex="0" aria-label="${fmtDayLabel(r.day)}: ${fmt(r[metric])}">
      ${isPeak ? `<em class="chart__peak">${fmt(r[metric])}</em>` : ''}
      <div class="chart__bar" style="height:${Math.max(h, r[metric] > 0 ? 2 : 0)}%"></div>
      <span class="chart__tip">${fmtDayLabel(r.day)}<b>${fmt(r[metric])}</b>${metric === 'total' ? `<i>${r.orders} order${r.orders === 1 ? '' : 's'}</i>` : ''}</span>
    </div>`;
  }).join('')}</div>
  <div class="chart__axis"><span>${fmtDayLabel(rows[0].day)}</span><span>${fmtDayLabel(rows[rows.length - 1].day)}</span></div>`;

  $('#salesTable').innerHTML = `<thead><tr><th>Day</th><th class="r">Orders</th><th class="r">Revenue</th></tr></thead><tbody>${
    rows.slice().reverse().map((r) => `<tr><td>${fmtDayLabel(r.day)}</td><td class="r">${r.orders}</td><td class="r">${fmtMoney(r.total)}</td></tr>`).join('')
  }</tbody>`;
}

const fmtDayLabel = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/** Daily rows rolled up by calendar month — the view the accounts side asks for. */
function renderMonthly() {
  const rows = ANALYTICS.sales.byDay;
  const months = new Map();
  for (const r of rows) {
    const key = r.day.slice(0, 7);
    const m = months.get(key) || { orders: 0, total: 0 };
    m.orders += r.orders; m.total += r.total;
    months.set(key, m);
  }
  const list = [...months.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  $('#monthlyTable').innerHTML = list.length
    ? `<thead><tr><th>Month</th><th class="r">Orders</th><th class="r">Revenue</th><th class="r">Avg order</th></tr></thead><tbody>${
        list.map(([key, m]) => `<tr>
          <td>${new Date(key + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</td>
          <td class="r">${m.orders}</td>
          <td class="r"><b>${fmtMoney(m.total)}</b></td>
          <td class="r">${fmtMoney(m.orders ? m.total / m.orders : 0)}</td>
        </tr>`).join('')
      }</tbody>`
    : '<tbody><tr><td class="muted">No orders in this period yet.</td></tr></tbody>';
}

/**
 * Stock state. Colour is an accent on a labelled row, never the only signal —
 * red and amber are hard to tell apart with deuteranopia, so the words carry it.
 */
function renderStockSummary() {
  const live = ALL_PRODUCTS.filter((p) => !p.hidden);
  const out = live.filter((p) => p.stock === 0);
  const low = live.filter((p) => p.stock > 0 && p.stock <= LOW_STOCK);
  const ok = live.length - out.length - low.length;

  $('#stockSummary').innerHTML = `
    <ul class="stock-list">
      <li><span class="dot dot--ok"></span><span>In stock</span><b>${ok}</b></li>
      <li><span class="dot dot--low"></span><span>Running low <small>(${LOW_STOCK} or fewer)</small></span><b>${low.length}</b></li>
      <li><span class="dot dot--out"></span><span>Out of stock</span><b>${out.length}</b></li>
      <li class="stock-list__total"><span></span><span>Live products</span><b>${live.length}</b></li>
    </ul>
    ${out.length || low.length ? `<p class="muted stock-list__note">${[...out, ...low].slice(0, 4).map((p) => p.name).join(' · ')}${out.length + low.length > 4 ? ` and ${out.length + low.length - 4} more` : ''}</p>` : ''}`;
}

function renderProductInterest() {
  const data = ANALYTICS.products;
  const el = $('#productInterestTable');
  if (!data || !data.products?.length) {
    el.innerHTML = '<tbody><tr><td class="muted">No product views recorded in this period.</td></tr></tbody>';
    return;
  }
  el.innerHTML = `<thead><tr><th>Product</th><th class="r">Views</th><th class="r">Added to cart</th><th class="r">Add rate</th><th>Stock</th></tr></thead><tbody>${
    data.products.map((p) => `<tr>
      <td>${p.name}</td>
      <td class="r">${p.views}</td>
      <td class="r">${p.addedToCart}</td>
      <td class="r">${Math.round(p.addRate * 100)}%</td>
      <td>${p.inStock ? 'In stock' : '<b class="stock--out">Out of stock</b>'}</td>
    </tr>`).join('')
  }</tbody>`;
}

function render() {
  $('#adminName').textContent = admin.name || Auth.formatMobile(admin.mobile);
  renderOverview(); renderOrders(); renderEnquiries(); renderProducts(); renderCustomers(); renderAlerts(); renderDb();
}

// ---------- events ----------
['orderSearch', 'orderStatusFilter', 'showHandled', 'productSearch', 'productCatFilter', 'lowOnly'].forEach((id) => $(`#${id}`).addEventListener('input', render));
$('#exportOrders').addEventListener('click', exportOrders);
$('#analyticsPeriod').addEventListener('change', (e) => { ANALYTICS.days = Number(e.target.value); loadAnalytics(); });
$('#analyticsRefresh').addEventListener('click', () => loadAnalytics());
// Two measures of different scale never share a y-axis; they swap.
$('#salesToggle').addEventListener('click', () => {
  ANALYTICS.metric = ANALYTICS.metric === 'total' ? 'orders' : 'total';
  renderSalesChart();
});
document.addEventListener('click', (e) => {
  const by = (attr) => e.target.closest(`[${attr}]`)?.getAttribute(attr);
  const oid = by('data-view-order') || by('data-advance') || by('data-mark-paid') || by('data-cancel-order');
  if (oid) {
    const o = allOrdersAdmin().find((x) => x.id === oid);
    if (by('data-view-order')) viewOrder(o); else if (by('data-advance')) advance(o); else if (by('data-mark-paid')) markPaid(o); else cancelOrder(o);
    return;
  }
  if (by('data-handle')) return setHandled(by('data-handle'), true);
  if (by('data-reopen')) return setHandled(by('data-reopen'), false);
  if (by('data-quote-respond')) return respondQuote(by('data-quote-respond'));
  if (by('data-quote-decline')) return declineQuote(by('data-quote-decline'));
  if (by('data-credit')) { const el = e.target.closest('[data-credit]'); const v = Number(prompt('New pay-later credit limit (₹):', el.dataset.current)); if (v >= 0) Api.admin.setCredit(el.dataset.credit, v).then(reloadRemote).then(render).then(() => toast('Credit limit updated.')).catch((ex) => toast(ex.message)); return; }
  const ep = e.target.closest('[data-edit-product]');
  if (ep) openProductEditor(byId(ep.dataset.editProduct));
});
// The two switches in the product table commit themselves.
$('#productsTable').addEventListener('change', (e) => {
  const flag = e.target.closest('[data-stock-flag], [data-deal]');
  if (flag) return toggleProductFlag(flag);
  const count = e.target.closest('[data-stock]');
  if (count) return saveStockCount(count);
});
$('#addProduct').addEventListener('click', () => openProductEditor());
$('#addSlab').addEventListener('click', () => {
  const rows = readSlabRows();
  const last = rows[rows.length - 1] || [10, ''];
  renderSlabRows([...rows, [Number(last[0]) * 5 || 100, '']]);
});
$('#slabRows').addEventListener('click', (e) => {
  if (!e.target.closest('[data-remove-slab]')) return;
  const rows = readSlabRows();
  const i = [...$$('#slabRows [data-slab-row]')].indexOf(e.target.closest('[data-slab-row]'));
  if (rows.length > 1) renderSlabRows(rows.filter((_, k) => k !== i));
});
$('#restoreRemoved').addEventListener('click', restoreRemoved);
if (!CONFIG.DEMO_MODE) {
  $('#restoreRemoved').hidden = true;
  $('#adminNav [data-view="alerts"]').hidden = true;
  $('#lowOnlyLabel').textContent = 'Out of stock only';   // the server has no stock count
}
$('#productForm').addEventListener('submit', submitProductEditor);
$('#closeProductModal').addEventListener('click', () => { $('#productModal').hidden = true; });
$('#productModal').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.hidden = true; });
$('#deleteProduct').addEventListener('click', () => deleteProduct($('#productForm').elements.id.value));
$('#resetProduct').addEventListener('click', () => resetProduct($('#productForm').elements.id.value));
$('#productForm').elements.brand.addEventListener('change', (e) => { e.target.form.elements.newBrand.parentElement.hidden = e.target.value !== '__new'; });
$('#productForm').elements.imgChoice.addEventListener('change', (e) => { const custom = e.target.value === '__custom'; $('#customImageRow').hidden = !custom; if (!custom) $('#imgPreview').src = e.target.value; });
$('#productForm').elements.imgUrl.addEventListener('input', (e) => { if (e.target.value) $('#imgPreview').src = e.target.value; });
$('#productForm').elements.imgFile.addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return;
  if (!CONFIG.DEMO_MODE) {
    if (file.size > 5 * 1024 * 1024) { toast('Keep product photos under 5 MB.'); e.target.value = ''; return; }
    try { toast('Uploading image…'); const up = await Api.admin.uploadCatalogImage(file); $('#imgPreview').src = up.url; $('#productForm').elements.imgUrl.value = up.url; toast('Image uploaded.'); }
    catch (ex) { toast(ex.message); e.target.value = ''; }
    return;
  }
  if (file.size > 400 * 1024) { toast('Keep product photos under 400 KB (resize to ~800px wide).'); e.target.value = ''; return; }
  const r = new FileReader(); r.onload = () => { $('#imgPreview').src = r.result; $('#productForm').elements.imgUrl.value = r.result; }; r.readAsDataURL(file);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { $('#productModal').hidden = true; $('#dbModal').hidden = true; } });

if (!CONFIG.DEMO_MODE) { try { await reloadRemote(); } catch (ex) { toast(ex.message); } }
$('#broadcastForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  if (CONFIG.DEMO_MODE) return toast('Broadcasts need the live API.');
  try { const r = await Api.admin.broadcast({ type: fd.get('type'), title: String(fd.get('title')).trim(), body: String(fd.get('body')).trim() }); e.target.reset(); toast(`Sent to ${r.sent} buyer${r.sent === 1 ? '' : 's'}.`); }
  catch (ex) { toast(ex.message); }
});
$('#dbTable').addEventListener('change', (e) => { DB.table = e.target.value; DB.offset = 0; DB.q = ''; $('#dbSearch').value = ''; loadDbRows(); });
$('#dbTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-db-table]'); if (b) { DB.table = b.dataset.dbTable; DB.offset = 0; DB.q = ''; $('#dbSearch').value = ''; loadDbRows(); } });
let dbTimer; $('#dbSearch').addEventListener('input', (e) => { clearTimeout(dbTimer); dbTimer = setTimeout(() => { DB.q = e.target.value.trim(); DB.offset = 0; loadDbRows(); }, 300); });
$('#dbPager').addEventListener('click', (e) => { const b = e.target.closest('[data-db-page]'); if (b && !b.disabled) { DB.offset = (Number(b.dataset.dbPage) - 1) * DB.limit; loadDbRows(); } });
$('#dbAdd').addEventListener('click', () => openDbEditor());
$('#dbTableEl').addEventListener('click', (e) => { const b = e.target.closest('[data-db-edit]'); if (b) openDbEditor(DB.rows.find((r) => String(r[dbMeta().id]) === b.dataset.dbEdit)); });
$('#dbForm').addEventListener('submit', submitDb);
$('#dbDelete').addEventListener('click', deleteDbRow);
$('#closeDbModal').addEventListener('click', () => { $('#dbModal').hidden = true; });
$('#dbModal').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.hidden = true; });
$('#dbExport').addEventListener('click', () => { const a2 = document.createElement('a'); a2.href = URL.createObjectURL(new Blob([JSON.stringify(DB.rows, null, 2)], { type: 'application/json' })); a2.download = `spocart-${DB.table}-${new Date().toISOString().slice(0, 10)}.json`; a2.click(); });
if (CONFIG.DEMO_MODE) $('#navDb').hidden = true;

const VIEWS = ['overview', 'orders', 'enquiries', 'products', 'customers', 'alerts', 'database'];
const fromHash = () => { const v = location.hash.slice(1); goto(VIEWS.includes(v) ? v : 'overview'); };
window.addEventListener('hashchange', fromHash);
fromHash();
});
