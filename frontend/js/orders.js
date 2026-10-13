/* ==========================================================================
   SPOCART Wholesale — orders page
   Plain-language order tracking: status tabs, one card per order with a
   4-step progress bar, expandable details, Pay now / Track / Reorder /
   Invoice actions. Orders placed on the site (localStorage) are listed
   above the demo seed; swap ORDER_SEED for GET /orders when wiring the API.
   ========================================================================== */
CATALOG_READY.then(async () => {
if (!Auth.requireAuth()) return;
const { state, toast, openDrawer } = window.Spocart;

const TABS = [
  { id: 'all', label: 'All' }, { id: 'pending', label: 'Awaiting payment' }, { id: 'processing', label: 'Processing' },
  { id: 'shipped', label: 'Shipped' }, { id: 'delivered', label: 'Delivered' }, { id: 'cancelled', label: 'Cancelled' },
];

const ui = { tab: 'all', q: '', open: new Set() };

/** One plain sentence telling the customer what happens next. */
function nextStepText(o) {
  const last = o.history[o.history.length - 1];
  switch (o.status) {
    case 'paymentPending': return `Pay ${inr(o.total)} to confirm. Unpaid orders are released after ${CONFIG.DEMO_MODE ? '24 hours' : '30 minutes'}.`;
    case 'placed':         return `We're preparing your order. It ships within 48 hours from our Delhi warehouse.`;
    case 'packed':         return `Packed and ready for pickup. Expected delivery ${fmtEta(o)}.`;
    case 'dispatched':     return `On its way${o.trackingId ? ` with ${o.trackingId.split(' ')[0]}` : ''}. Expected delivery ${fmtEta(o)}.`;
    case 'outForDelivery': return `Out for delivery today. Please keep the GST copy ready for the receiver.`;
    case 'delivered':      return `Delivered on ${fmtDateTime(last.at)}. Your GST invoice is ready to download.`;
    case 'cancelled':      return `Cancelled on ${fmtDate(last.at)}. Any payment is refunded within 5–7 working days.`;
    default: return '';
  }
}

// ---------- render ----------
function renderStats(orders) {
  const open = orders.filter((o) => !['delivered', 'cancelled'].includes(o.status)).length;
  const pending = orders.filter((o) => o.status === 'paymentPending');
  const due = pending.reduce((n, o) => n + o.total, 0);
  const spent = orders.filter((o) => o.status !== 'cancelled' && o.status !== 'paymentPending').reduce((n, o) => n + o.total, 0);
  $('#orderStats').innerHTML = `
    <div class="stat"><b>${open}</b><span>Open orders</span></div>
    <div class="stat ${pending.length ? 'stat--alert' : ''}"><b>${inr(due)}</b><span>Payment due</span></div>
    <div class="stat"><b>${inr(spent)}</b><span>Ordered this year</span></div>`;
}

function renderTabs(orders) {
  $('#statusTabs').innerHTML = TABS.map((t) => {
    const n = t.id === 'all' ? orders.length : orders.filter((o) => STATUS[o.status].tab === t.id).length;
    return `<button class="${ui.tab === t.id ? 'is-active' : ''}" data-tab="${t.id}" role="tab">${t.label}${n ? ` <em>${n}</em>` : ''}</button>`;
  }).join('');
}

function progressBar(o) {
  const st = STATUS[o.status];
  if (st.step < 0) return `<div class="progress progress--cancelled">${icon('i-close')} This order was cancelled</div>`;
  return `<ol class="progress" aria-label="Order progress">
    ${STEPS.map((label, i) => {
      const n = i + 1;
      const cls = n < st.step ? 'is-done' : n === st.step ? 'is-current' : n === st.step + 1 && st.step === 0 ? 'is-next' : '';
      const sub = n === 1 && st.step === 0 ? 'after payment' : n === 4 && st.step < 4 ? fmtEta(o) : n <= st.step ? fmtDate(o.history.find((h) => STATUS[h.status].step === n || (n === 3 && ['dispatched', 'outForDelivery'].includes(h.status)))?.at || o.placedAt) : '';
      return `<li class="${cls}"><i>${n <= st.step ? icon('i-check') : ''}</i><span>${label}</span><small>${sub}</small></li>`;
    }).join('')}
  </ol>`;
}

function actions(o) {
  const btns = [];
  if (o.status === 'paymentPending') btns.push(`<button class="btn btn--red btn--sm" data-act="pay" data-id="${o.id}">${icon('i-card')} Pay now · ${inr(o.total)}</button>`);
  else if (['dispatched', 'outForDelivery', 'packed', 'placed'].includes(o.status)) btns.push(`<button class="btn btn--dark btn--sm" data-act="track" data-id="${o.id}">${icon('i-truck')} Track order</button>`);
  else btns.push(`<button class="btn btn--dark btn--sm" data-act="reorder" data-id="${o.id}">${icon('i-refresh')} Reorder</button>`);
  if (o.invoiceId) btns.push(`<button class="btn btn--outline btn--sm" data-act="invoice" data-id="${o.id}">${icon('i-download')} GST invoice</button>`);
  if (CONFIG.DEMO_MODE && ['paymentPending', 'placed'].includes(o.status)) btns.push(`<button class="btn btn--outline btn--sm" data-act="cancel" data-id="${o.id}">Cancel order</button>`);
  btns.push(`<a class="btn btn--outline btn--sm" href="partner.html?topic=support&order=${o.id}">Need help</a>`);
  return btns.join('');
}

function orderCard(o) {
  const st = STATUS[o.status];
  const open = ui.open.has(o.id);
  const thumbs = o.lines.slice(0, 3);
  return `
  <article class="order ${open ? 'is-open' : ''} ${o.status === 'paymentPending' ? 'order--pending' : ''}" data-id="${o.id}">
    <header class="order__head">
      <div class="order__id">
        <strong>${o.id}</strong>
        <span>Placed ${fmtDate(o.placedAt)} • ${o.lines.length} item${o.lines.length > 1 ? 's' : ''} • ${pcs(o).toLocaleString('en-IN')} pcs</span>
      </div>
      <span class="status status--${st.tone}">${icon(st.icon)} ${st.label}</span>
      <div class="order__total"><span>Total incl. GST</span><b>${inr(o.total)}</b></div>
    </header>

    <div class="order__body">
      <div class="order__items">
        ${thumbs.map((l) => `<div class="order__item"><img src="${l.image}" alt="" onerror="this.onerror=null;this.src='assets/images/footballs_stack.jpg'" /><div><strong>${l.name}${l.size ? ` <span class="tag tag--grey">${l.size}</span>` : ''}</strong><span>${l.quantity} ${l.unit === 'pc' ? 'pcs' : l.unit + 's'} × ${inr(l.unitPrice)}</span></div></div>`).join('')}
        ${o.lines.length > 3 ? `<button class="order__more" data-act="toggle" data-id="${o.id}">+${o.lines.length - 3} more item${o.lines.length - 3 > 1 ? 's' : ''}</button>` : ''}
      </div>
      ${progressBar(o)}
      <p class="order__next ${o.status === 'paymentPending' ? 'is-alert' : ''}">${nextStepText(o)}</p>
    </div>

    <footer class="order__foot">
      <div class="order__actions">${actions(o)}</div>
      <button class="order__expand" data-act="toggle" data-id="${o.id}" aria-expanded="${open}">${open ? 'Hide details' : 'View details'} ${icon('i-chevron')}</button>
    </footer>

    <section class="order__details" ${open ? '' : 'hidden'}>
      <div class="details-grid">
        <div>
          <h5>Items</h5>
          <table class="lines">
            ${o.lines.map((l) => `<tr><td><img src="${l.image}" alt="" /></td><td><strong>${l.name}</strong><small>${inr(l.unitPrice)}/${l.unit}${l.mrp ? ` · MRP ${inr(l.mrp)}` : ''}${l.size ? ` · size ${l.size}` : ''}</small></td><td>${l.quantity}</td><td><b>${inr(l.quantity * l.unitPrice)}</b></td></tr>`).join('')}
          </table>
          <div class="totals totals--card">
            <div><span>Subtotal (${pcs(o).toLocaleString('en-IN')} pcs)</span><b>${inr(o.subtotal)}</b></div>
            ${o.discount ? `<div class="totals__save"><span>Coupon ${o.coupon}</span><b>−${inr(o.discount)}</b></div>` : ''}
            <div><span>GST (18%)</span><b>${inr(o.gst)}</b></div>
            <div><span>Freight</span><b>${o.freight ? inr(o.freight) : 'Free'}</b></div>
            <div class="totals__grand"><span>Total paid${o.paid ? '' : ' (due)'}</span><b>${inr(o.total)}</b></div>
          </div>
        </div>
        <div class="details-side">
          <h5>${icon('i-pin')} Delivering to</h5>
          <p><strong>${o.address.name}</strong><br>${o.address.line}${o.address.city ? `<br>${o.address.city}` : ''}${o.address.phone ? `<br>${o.address.phone}` : ''}${o.address.gstin ? `<br><small>GSTIN ${o.address.gstin}</small>` : ''}</p>
          <h5>${icon('i-card')} Payment</h5>
          <p>${o.paid ? `Paid via ${o.paymentMethod}` : 'Not paid yet'}${o.invoiceId ? `<br><small>Invoice ${o.invoiceId}</small>` : ''}</p>
          ${o.trackingId ? `<h5>${icon('i-truck')} Tracking</h5><p>${o.trackingId}</p>` : ''}
          <h5>${icon('i-clock')} Timeline</h5>
          <ul class="timeline">
            ${[...o.history].reverse().map((h, i) => `<li class="${i === 0 ? 'is-latest' : ''}"><b>${STATUS[h.status].label}</b><span>${fmtDateTime(h.at)}</span></li>`).join('')}
          </ul>
        </div>
      </div>
    </section>
  </article>`;
}

function render() {
  const orders = allOrders();
  renderStats(orders);
  renderTabs(orders);
  const q = ui.q.trim().toLowerCase();
  const list = orders.filter((o) =>
    (ui.tab === 'all' || STATUS[o.status].tab === ui.tab) &&
    (!q || o.id.toLowerCase().includes(q) || o.lines.some((l) => l.name.toLowerCase().includes(q))));
  $('#orderList').innerHTML = list.map(orderCard).join('');
  const empty = $('#ordersEmpty');
  empty.hidden = list.length > 0;
  if (!list.length) {
    $('#emptyTitle').textContent = q ? `No orders match “${ui.q}”` : ui.tab === 'all' ? 'No orders here yet' : `No ${TABS.find((t) => t.id === ui.tab).label.toLowerCase()} orders`;
    $('#emptyText').textContent = q || ui.tab !== 'all' ? 'Try another tab or clear the search.' : 'Bulk orders you place will show up here with live tracking.';
  }
}

// ---------- actions ----------
async function payNow(o) {
  if (!CONFIG.DEMO_MODE) {
    try {
      toast('Opening secure payment…');
      const { checkout } = await Api.retryPayment(o.id);
      const paid = await Api.payWithRazorpay(checkout);
      saveOrder(paid); await refreshOrders(); render();
      toast(`Payment received — order ${o.id} is confirmed.`);
    } catch (ex) { toast(ex.message); await refreshOrders(); render(); }
    return;
  }
  const now = new Date().toISOString();
  o.paid = true; o.paymentMethod = 'UPI'; o.status = 'placed';
  o.invoiceId = `INV-26-${String(Math.floor(Math.random() * 9000) + 1000)}`;
  o.history.push({ status: 'placed', at: now });
  saveOrder(o);
  render();
  toast(`Payment of ${inr(o.total)} received — order ${o.id} is now processing.`);
}

function cancelOrder(o) {
  if (!confirm(`Cancel order ${o.id}?${o.paid ? ' Your payment will be refunded in 5–7 working days.' : ''}`)) return;
  o.status = 'cancelled';
  o.history.push({ status: 'cancelled', at: new Date().toISOString() });
  saveOrder(o);
  render();
  toast(`Order ${o.id} cancelled.`);
}

function reorder(o) {
  o.lines.forEach((l) => { const p = byId(l.productId); if (!p?.stock) return; const key = window.Spocart.cartKey(l.productId, p.sizes?.length ? (l.size || p.sizes[0]) : null); state.cart[key] = (state.cart[key] || 0) + l.quantity; });
  save('spocart.cart', state.cart);
  window.Spocart.renderCart();
  openDrawer('#cartDrawer');
  toast(`${o.lines.length} item${o.lines.length > 1 ? 's' : ''} from ${o.id} added to your cart at today's slab prices.`);
}

/** Opens a printable GST invoice in a new tab. */
function invoice(o) {
  const rows = o.lines.map((l, i) => `<tr><td>${i + 1}</td><td>${l.name}</td><td>9506</td><td class="r">${l.quantity}</td><td class="r">${inr(l.unitPrice)}</td><td class="r">${inr(l.quantity * l.unitPrice)}</td></tr>`).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${o.invoiceId} — SPOCART</title>
  <style>body{font-family:Inter,system-ui,sans-serif;color:#141416;margin:40px;font-size:13px}h1{margin:0;font-size:22px}.head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px}.meta{text-align:right;color:#55555E}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{padding:9px 8px;border-bottom:1px solid #E2E2E5;text-align:left}th{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#7C7C86}.r{text-align:right}.tot td{border:0;padding:5px 8px}.grand td{font-weight:800;font-size:15px;border-top:2px solid #141416}.box{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:8px}.box h4{margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#7C7C86}.foot{margin-top:36px;color:#7C7C86;font-size:11px}@media print{body{margin:16px}}</style></head><body>
  <div class="head"><div><h1>SPOCART</h1><div>India's wholesale sports supplier<br>GSTIN 07AAECS9876K1ZP · sales@spocart.in · +91 70619 11575</div></div>
  <div class="meta"><b style="font-size:18px;color:#141416">TAX INVOICE</b><br>${o.invoiceId}<br>Order ${o.id}<br>Date ${fmtDate(o.history.find((h) => h.status === 'placed')?.at || o.placedAt)}</div></div>
  <div class="box"><div><h4>Billed to</h4><b>${o.address.name}</b><br>${o.address.line}<br>${o.address.city || ''}${o.address.gstin ? `<br>GSTIN ${o.address.gstin}` : ''}</div><div><h4>Payment</h4>${o.paid ? `Paid via ${o.paymentMethod}` : 'Unpaid'}<br>Place of supply: Delhi (07)</div></div>
  <table><thead><tr><th>#</th><th>Item</th><th>HSN</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead><tbody>${rows}</tbody>
  <tfoot><tr class="tot"><td colspan="5" class="r">Taxable value</td><td class="r">${inr(o.subtotal)}</td></tr><tr class="tot"><td colspan="5" class="r">CGST 9%</td><td class="r">${inr(o.gst / 2)}</td></tr><tr class="tot"><td colspan="5" class="r">SGST 9%</td><td class="r">${inr(o.gst / 2)}</td></tr>${o.freight ? `<tr class="tot"><td colspan="5" class="r">Freight</td><td class="r">${inr(o.freight)}</td></tr>` : ''}<tr class="grand"><td colspan="5" class="r">Total</td><td class="r">${inr(o.total)}</td></tr></tfoot></table>
  <p class="foot">Computer-generated invoice, no signature required. Goods once sold are returnable only for manufacturing defects within 7 days.</p>
  <script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`;
  const w = window.open('', '_blank');
  if (!w) { toast('Allow pop-ups to download the invoice.'); return; }
  w.document.write(html); w.document.close();
}

function toggle(id, force) {
  const open = force ?? !ui.open.has(id);
  open ? ui.open.add(id) : ui.open.delete(id);
  render();
}

function bind() {
  $('#statusTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) { ui.tab = b.dataset.tab; render(); } });
  $('#orderSearch').addEventListener('input', (e) => { ui.q = e.target.value; render(); });
  $('#orderList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const o = allOrders().find((x) => x.id === b.dataset.id);
    switch (b.dataset.act) {
      case 'toggle': toggle(o.id); break;
      case 'track': toggle(o.id, true); setTimeout(() => $(`.order[data-id="${o.id}"] .timeline`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); break;
      case 'pay': payNow(o); break;
      case 'cancel': cancelOrder(o); break;
      case 'reorder': reorder(o); break;
      case 'invoice': invoice(o); break;
    }
  });
}

// ---------- init ----------
if (!CONFIG.DEMO_MODE) { try { await refreshOrders(); } catch (ex) { toast(ex.message); } }
const params = new URLSearchParams(location.search);
const newId = params.get('new');
if (newId && allOrders().some((o) => o.id === newId)) {
  ui.open.add(newId);
  $('#newOrderBanner').hidden = false;
  const o = allOrders().find((x) => x.id === newId);
  $('#newOrderText').textContent = o.status !== 'paymentPending'
    ? ` ${newId} is confirmed${o.paymentMethod?.startsWith('Pay later') ? ' on pay-later credit' : ''}. We'll start packing within 48 hours.`
    : ` ${newId} is saved. Pay now to confirm — we hold your stock for 24 hours.`;
  history.replaceState(null, '', location.pathname);
}
if (params.get('tab') && TABS.some((t) => t.id === params.get('tab'))) ui.tab = params.get('tab');
const openId = params.get('open');
if (openId && allOrders().some((o) => o.id === openId)) {
  ui.open.add(openId);
  setTimeout(() => $(`.order[data-id="${openId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
}
bind();
render();
});
