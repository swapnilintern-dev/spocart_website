/* ==========================================================================
   SPOCART Wholesale — order data shared by the orders and account pages
   Orders placed on the site live in localStorage ('spocart.orders'); the
   demo seed below fills the list on first visit. Swap ORDER_SEED for
   GET /orders when wiring to the API.
   ========================================================================== */

const DAY = 864e5;
const today = new Date('2026-09-18T10:00:00');
const ago = (days, hour = 11) => { const d = new Date(today.getTime() - days * DAY); d.setHours(hour, 0, 0, 0); return d.toISOString(); };
const line = (id, quantity, unitPrice) => { const p = byId(id); return { productId: id, name: p.name, image: p.img, unit: p.unit, quantity, unitPrice, mrp: p.mrp }; };
const totals = (lines, freight = 0) => { const subtotal = lines.reduce((n, l) => n + l.quantity * l.unitPrice, 0); return { subtotal, gst: subtotal * GST_RATE, total: subtotal * (1 + GST_RATE) + freight, freight }; };

const ADDRESS = DEFAULT_ADDRESS;

const ORDER_SEED = [
  { id: 'SPO-260916-118', placedAt: ago(2), status: 'packed', buyer: 'shops', address: ADDRESS, paymentMethod: 'UPI', paid: true, etaStart: ago(-2), etaEnd: ago(-4), invoiceId: 'INV-26-0918', trackingId: null,
    lines: [line('fb-pro-5', 100, 749), line('fb-train-4', 100, 549)],
    history: [{ status: 'placed', at: ago(2, 11) }, { status: 'packed', at: ago(1, 16) }] },
  { id: 'SPO-260913-112', placedAt: ago(5), status: 'outForDelivery', buyer: 'shops', address: ADDRESS, paymentMethod: 'Net banking', paid: true, etaStart: ago(0), etaEnd: ago(0), invoiceId: 'INV-26-0904', trackingId: 'DTDC 7788 4412 90',
    lines: [line('gym-hex-10', 40, 1799), line('gym-mat', 100, 499), line('gym-band', 20, 799)],
    history: [{ status: 'placed', at: ago(5, 10) }, { status: 'packed', at: ago(4, 15) }, { status: 'dispatched', at: ago(3, 9) }, { status: 'outForDelivery', at: ago(0, 8) }] },
  { id: 'SPO-260905-097', placedAt: ago(13), status: 'delivered', buyer: 'shops', address: ADDRESS, paymentMethod: 'UPI', paid: true, etaStart: ago(9), etaEnd: ago(8), invoiceId: 'INV-26-0871', trackingId: 'Delhivery 3391 0027 55',
    lines: [line('cr-bat-sh', 20, 3499), line('cr-ball-lt', 100, 949)],
    history: [{ status: 'placed', at: ago(13, 12) }, { status: 'packed', at: ago(12, 17) }, { status: 'dispatched', at: ago(11, 9) }, { status: 'outForDelivery', at: ago(9, 8) }, { status: 'delivered', at: ago(9, 14) }] },
  { id: 'SPO-260828-081', placedAt: ago(21), status: 'delivered', buyer: 'shops', address: ADDRESS, paymentMethod: 'Pay later (30 days)', paid: true, etaStart: ago(17), etaEnd: ago(16), invoiceId: 'INV-26-0812', trackingId: 'DTDC 7788 3120 44',
    lines: [line('fw-runner', 24, 1899), line('ap-track', 10, 1699)],
    history: [{ status: 'placed', at: ago(21, 10) }, { status: 'packed', at: ago(20, 13) }, { status: 'dispatched', at: ago(19, 9) }, { status: 'outForDelivery', at: ago(17, 8) }, { status: 'delivered', at: ago(17, 12) }] },
  { id: 'SPO-260820-074', placedAt: ago(29), status: 'cancelled', buyer: 'shops', address: ADDRESS, paymentMethod: 'UPI', paid: false, etaStart: ago(25), etaEnd: ago(23), invoiceId: null, trackingId: null,
    lines: [line('bd-racket', 10, 1499)],
    history: [{ status: 'placed', at: ago(29, 11) }, { status: 'cancelled', at: ago(29, 15) }] },
].map((o) => ({ ...o, mobile: CONFIG.DEMO_ACCOUNT.mobile, ...totals(o.lines) }));

// Status → how it is shown. `step` drives the 4-step progress bar.
const STATUS = {
  paymentPending: { label: 'Awaiting payment', tone: 'red',   step: 0, icon: 'i-clock',        tab: 'pending' },
  placed:         { label: 'Processing',       tone: 'amber', step: 1, icon: 'i-receipt',      tab: 'processing' },
  packed:         { label: 'Packed',           tone: 'blue',  step: 2, icon: 'i-box',          tab: 'processing' },
  dispatched:     { label: 'Shipped',          tone: 'blue',  step: 3, icon: 'i-truck',        tab: 'shipped' },
  outForDelivery: { label: 'Out for delivery', tone: 'blue',  step: 3, icon: 'i-truck',        tab: 'shipped' },
  delivered:      { label: 'Delivered',        tone: 'green', step: 4, icon: 'i-check-circle', tab: 'delivered' },
  cancelled:      { label: 'Cancelled',        tone: 'grey',  step: -1, icon: 'i-close',       tab: 'cancelled' },
};
const STEPS = ['Placed', 'Packed', 'Shipped', 'Delivered'];
// ---------- data ----------
// API mode: orders come from GET /orders and are cached here for the page's lifetime.
let REMOTE_ORDERS = null;
async function refreshOrders() { if (!CONFIG.DEMO_MODE) REMOTE_ORDERS = await Api.fetchOrders(); return allOrders(); }

// Orders belong to the signed-in mobile number; the demo seed only shows for the demo account.
function allOrders() {
  if (!CONFIG.DEMO_MODE) return (REMOTE_ORDERS || []).slice().sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt));
  const me = Auth.session()?.mobile;
  const mine = load('spocart.orders', []).filter((o) => !o.mobile || o.mobile === me);
  const storedIds = new Set(mine.map((o) => o.id));
  const seed = me === CONFIG.DEMO_ACCOUNT.mobile ? ORDER_SEED.filter((o) => !storedIds.has(o.id)) : [];
  return [...mine, ...seed].sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt));
}
function saveOrder(order) {
  if (!CONFIG.DEMO_MODE) { const i = (REMOTE_ORDERS || []).findIndex((o) => o.id === order.id); if (i >= 0) REMOTE_ORDERS[i] = order; else (REMOTE_ORDERS ||= []).unshift(order); return; }
  const mine = load('spocart.orders', []);
  const i = mine.findIndex((o) => o.id === order.id);
  if (i >= 0) mine[i] = order; else mine.unshift(order);
  save('spocart.orders', mine);
}
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const fmtDateTime = (iso) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const fmtEta = (o) => fmtDate(o.etaStart) === fmtDate(o.etaEnd) ? fmtDate(o.etaStart) : `${fmtDate(o.etaStart)} – ${fmtDate(o.etaEnd)}`;
const pcs = (o) => o.lines.reduce((n, l) => n + l.quantity, 0);

