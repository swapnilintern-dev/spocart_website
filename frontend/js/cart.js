/* ==========================================================================
   SPOCART Wholesale — cart & checkout page
   Line items with slab hints, buyer-type pricing, coupon, delivery address,
   payment method and the order summary. Place order → orders page.
   ========================================================================== */
CATALOG_READY.then(async () => {
const { state, toast, setQty, removeFromCart, cartLines, setBuyer, placeOrder, addAllToQuote, addToCart, productCard, onChange } = window.Spocart;

const COUPONS = { BULK5: { pct: 5, min: 10000, label: '5% off first bulk order' }, SCHOOL10: { pct: 10, min: 50000, label: '10% off school kits' } };
const FREIGHT = 1200;
const ui = { coupon: load('spocart.coupon', null) };
if (ui.coupon && !COUPONS[ui.coupon]) ui.coupon = null;

// ---------- pricing ----------
function summary() {
  const lines = cartLines();
  const hasMrp = lines.some((l) => l.p.mrp);
  const mrpTotal = hasMrp ? lines.reduce((n, l) => n + (l.p.mrp || l.unit) * l.qty, 0) : 0;
  const gross = lines.reduce((n, l) => n + l.total, 0);
  const c = CONFIG.DEMO_MODE && ui.coupon && COUPONS[ui.coupon];
  const discount = c && gross >= c.min ? Math.round(gross * c.pct / 100) : 0;
  const subtotal = gross - discount;
  const gst = subtotal * GST_RATE;
  const freight = !CONFIG.DEMO_MODE || !lines.length || subtotal >= FREE_FREIGHT_AT ? 0 : FREIGHT;
  return { lines, hasMrp, mrpTotal, gross, discount, subtotal, gst, freight, total: subtotal + gst + freight, savings: hasMrp ? mrpTotal - gross : 0, pcs: lines.reduce((n, l) => n + l.qty, 0) };
}

/** Next slab hint for a line: "Add 40 more → ₹649/pc, save ₹X". */
function slabHint(p, qty, key) {
  if (!BUYER_TYPES[state.buyer].slabs) return '';
  const next = p.slabs.find(([min]) => min > qty);
  if (!next) return `<span class="hint hint--best">${icon('i-check-circle')} Best slab price</span>`;
  const mult = BUYER_TYPES[state.buyer].multiplier;
  const save = Math.round((unitPriceFor(p, qty, state.buyer) - next[1] * mult) * next[0]);
  return `<button class="hint" data-bump="${key}" data-qty="${next[0]}">${icon('i-percent')} Add ${next[0] - qty} more → ${inr(next[1] * mult)}/${p.unit}, save ${inr(save)}</button>`;
}

// ---------- render ----------
function renderLines(s) {
  $('#cartLines').innerHTML = s.lines.map(({ p, size, key, qty, unit, total }) => `
    <div class="cart-line" data-id="${key}">
      <a href="catalog.html?cat=${p.cat}"><img src="${p.img}" alt="${p.name}" onerror="this.onerror=null;this.src='assets/images/footballs_stack.jpg'" /></a>
      <div class="cart-line__info">
        <span class="product__brand">${p.brand}</span>
        <strong>${p.name}${size ? ` <span class="tag tag--grey">Size ${size}</span>` : ''}</strong>
        <span class="cart-line__unit">${inr(unit)}/${p.unit} ${p.mrp ? `<s>${inr(p.mrp)}</s> <em class="tag tag--red">-${pct(p.mrp, unit)}%</em>` : ''}</span>
        ${slabHint(p, qty, key)}
      </div>
      <div class="cart-line__qty">
        <div class="qty">
          <button data-dec aria-label="Decrease">${icon('i-minus')}</button>
          <input type="number" min="1" step="1" value="${qty}" aria-label="Quantity" />
          <button data-inc aria-label="Increase">${icon('i-plus')}</button>
        </div>
        <small>MOQ ${state.buyer === 'individual' && BUYER_TYPES.individual.multiplier < 1 ? 1 : p.moq} ${plural(p, p.moq)}${p.stock && p.stock < 9999 ? ` • ${p.stock.toLocaleString('en-IN')} in stock` : p.stock ? ' • In stock' : ''}</small>
      </div>
      <div class="cart-line__total">
        <b>${inr(total)}</b>
        <small>excl. GST</small>
        <button class="cart-item__remove" data-remove aria-label="Remove">${icon('i-trash')} Remove</button>
      </div>
    </div>`).join('');
}

function renderSlabTip(s) {
  const tip = $('#slabTip');
  const t = BUYER_TYPES[state.buyer];
  if (!s.lines.length) { tip.hidden = true; return; }
  if (!t.slabs) { tip.hidden = false; $('#slabTipText').innerHTML = `<b>Individual pricing</b> — single pieces below MRP, no MOQ. Switch to <b>Retail shop</b> for slab discounts up to 45%.`; return; }
  // Biggest possible saving from bumping one line to its next slab
  let best = null;
  s.lines.forEach(({ p, qty }) => {
    const next = p.slabs.find(([min]) => min > qty);
    if (!next) return;
    const save = (unitPriceFor(p, qty, state.buyer) - next[1] * t.multiplier) * next[0];
    if (!best || save > best.save) best = { p, qty, next, save };
  });
  tip.hidden = !best;
  if (best) $('#slabTipText').innerHTML = `<b>Unlock a better slab:</b> add ${best.next[0] - best.qty} more ${best.p.name} to reach ${best.next[0]}+ and pay ${inr(best.next[1] * t.multiplier)}/${best.p.unit} — you'd save ${inr(best.save)} on that line.`;
}

function renderSummary(s) {
  $('#sumItems').textContent = `${s.lines.length} item${s.lines.length !== 1 ? 's' : ''} • ${s.pcs.toLocaleString('en-IN')} pcs${s.hasMrp ? ' at MRP' : ''}`;
  $('#sumMrp').textContent = inr(s.hasMrp ? s.mrpTotal : s.gross);
  $('#sumSavings').textContent = `−${inr(s.savings)}`;
  $('#sumSavings').parentElement.hidden = !s.hasMrp;
  $('#couponForm').hidden = !CONFIG.DEMO_MODE;
  $('#sumCouponRow').hidden = !s.discount;
  $('#sumCoupon').textContent = `−${inr(s.discount)}`;
  $('#sumSubtotal').textContent = inr(s.subtotal);
  $('#sumGst').textContent = inr(s.gst);
  $('#sumFreight').textContent = s.freight ? inr(s.freight) : 'Free';
  $('#sumTotal').textContent = inr(s.total);

  const note = $('#sumFreightNote');
  if (!s.lines.length) note.hidden = true;
  else if (!s.freight) { note.hidden = false; note.className = 'freight is-free'; note.innerHTML = `${icon('i-truck')} Free freight on this order`; }
  else { note.hidden = false; note.className = 'freight'; note.innerHTML = `Add ${inr(FREE_FREIGHT_AT - s.subtotal)} more for free freight<div class="freight__bar"><i style="width:${(s.subtotal / FREE_FREIGHT_AT) * 100}%"></i></div>`; }

  const ca = $('#couponApplied');
  if (ui.coupon) {
    const c = COUPONS[ui.coupon];
    ca.hidden = false;
    ca.innerHTML = s.discount
      ? `${icon('i-check-circle')} <b>${ui.coupon}</b> applied — ${c.label} <button id="removeCoupon" aria-label="Remove coupon">✕</button>`
      : `${icon('i-clock')} <b>${ui.coupon}</b> needs a subtotal of ${inr(c.min)} (${inr(c.min - s.gross)} more) <button id="removeCoupon" aria-label="Remove coupon">✕</button>`;
    ca.classList.toggle('is-pending', !s.discount);
  } else ca.hidden = true;

  const later = $('input[name="pay"][value^="Pay later"]');
  const profile = load('spocart.profile', DEFAULT_PROFILE);
  const overLimit = s.total > profile.creditLimit;
  later.disabled = overLimit;
  $('#payLaterNote').textContent = overLimit ? `Order exceeds your ${inr(profile.creditLimit)} credit limit — pay via UPI or bank.` : `Interest-free credit within your ${inr(profile.creditLimit)} limit. Confirms instantly.`;
  if (overLimit && later.checked) $('input[name="pay"][value="UPI"]').checked = true;

  $('#placeOrder').disabled = !s.lines.length;
  $('#quoteCart').disabled = !s.lines.length;
  $('#placeOrder').innerHTML = s.lines.length ? `Place order · ${inr(s.total)} ${icon('i-arrow')}` : 'Place order';
}

function renderBuyerChips() {
  $('#buyerChips').innerHTML = Object.entries(BUYER_TYPES).map(([id, t]) => `<button class="chip-btn ${state.buyer === id ? 'is-active' : ''}" data-buyer="${id}">${t.label}</button>`).join('');
}

function renderAddress() {
  if (!Auth.isLoggedIn()) {
    $('#deliverTo').innerHTML = `<strong>Login to use your saved address</strong><p>New here? Registration takes two minutes and asks for your delivery address.</p><div class="header__auth"><a href="login.html?next=cart.html" class="btn btn--dark btn--sm">Login</a><a href="signup.html?next=cart.html" class="btn btn--outline btn--sm">Sign up</a></div>`;
    $('#deliverNote').hidden = false;
    return;
  }
  const a = load('spocart.address', DEFAULT_ADDRESS);
  $('#deliverTo').innerHTML = `<span class="tag tag--red">Default</span><strong>${a.name}</strong><p>${a.line}<br>${a.city}${a.phone ? `<br>${a.phone}` : ''}</p>${a.gstin ? `<span class="muted">GSTIN ${a.gstin}</span>` : ''}`;
}

function renderRecommend(s) {
  const inCart = new Set(s.lines.map((l) => l.p.id));
  const cats = new Set(s.lines.map((l) => l.p.cat));
  const picks = PRODUCTS.filter((p) => !inCart.has(p.id) && p.stock > 0)
    .sort((a, b) => (cats.has(b.cat) - cats.has(a.cat)) || (b.deal - a.deal) || b.reviews - a.reviews)
    .slice(0, 4);
  $('#recommendGrid').innerHTML = picks.map((p) => productCard(p, { qty: 100 })).join('');
}

function render() {
  const s = summary();
  const empty = !s.lines.length;
  $('#cartEmptyPage').hidden = !empty;
  $('#checkoutCards').hidden = empty;
  $('#summary').hidden = empty;
  $('#cartBody').classList.toggle('is-empty', empty);
  $('#cartSub').textContent = empty ? 'Nothing here yet.' : `${s.lines.length} item${s.lines.length !== 1 ? 's' : ''} • ${s.pcs.toLocaleString('en-IN')} pcs${s.hasMrp ? ` • you save ${inr(s.savings)} vs MRP` : ' • slab prices applied'}`;
  renderLines(s);
  renderSlabTip(s);
  renderSummary(s);
  renderBuyerChips();
  renderRecommend(s);
}

// ---------- events ----------
function bind() {
  $('#cartLines').addEventListener('click', (e) => {
    const line = e.target.closest('.cart-line');
    if (!line) return;
    const id = line.dataset.id;
    const input = $('input', line);
    if (e.target.closest('[data-inc]')) setQty(id, Number(input.value) + 1);
    else if (e.target.closest('[data-dec]')) setQty(id, Number(input.value) - 1);
    else if (e.target.closest('[data-remove]')) { removeFromCart(id); toast('Item removed'); }
    else if (e.target.closest('[data-bump]')) { const b = e.target.closest('[data-bump]'); setQty(b.dataset.bump, Number(b.dataset.qty)); toast('Quantity updated to the next slab'); }
  });
  $('#cartLines').addEventListener('change', (e) => {
    const line = e.target.closest('.cart-line');
    if (line && e.target.matches('input')) setQty(line.dataset.id, Number(e.target.value) || 0);
  });
  $('#clearCart').addEventListener('click', () => {
    if (!cartLines().length || !confirm('Remove all items from your cart?')) return;
    Object.keys(state.cart).forEach(removeFromCart);
  });
  $('#buyerChips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-buyer]');
    if (b) { setBuyer(b.dataset.buyer); toast(`${BUYER_TYPES[b.dataset.buyer].label} pricing applied`); }
  });

  $('#couponForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const code = $('#couponInput').value.trim().toUpperCase();
    if (!COUPONS[code]) { toast('That code isn’t valid. Try BULK5 on your first bulk order.'); return; }
    ui.coupon = code; save('spocart.coupon', code);
    $('#couponInput').value = '';
    render();
    const s = summary();
    toast(s.discount ? `${code} applied — you save ${inr(s.discount)}` : `${code} saved — applies once your subtotal reaches ${inr(COUPONS[code].min)}`);
  });
  $('#couponApplied').addEventListener('click', (e) => {
    if (e.target.closest('#removeCoupon')) { ui.coupon = null; localStorage.removeItem('spocart.coupon'); render(); }
  });

  $('#quoteCart').addEventListener('click', () => window.Spocart.quoteFromCart());

  $('#placeOrder').addEventListener('click', () => {
    const s = summary();
    if (!s.lines.length) return;
    if (!Auth.isLoggedIn()) { toast('Login with your mobile number to place the order — your cart is saved.'); setTimeout(() => { location.href = 'login.html?next=cart.html'; }, 600); return; }
    const paymentMethod = $('input[name="pay"]:checked').value;
    if (!CONFIG.DEMO_MODE) return placeRemote(s, paymentMethod);
    const order = placeOrder({ paymentMethod, coupon: s.discount ? ui.coupon : null, discount: s.discount, staggered: $('#staggered').checked });
    if (s.discount) localStorage.removeItem('spocart.coupon');
    location.href = `orders.html?new=${encodeURIComponent(order.id)}`;
  });

  async function placeRemote(s, paymentMethod) {
    const addr = load('spocart.address', null);
    if (!addr?.id) { toast('Add a delivery address in your account first.'); setTimeout(() => { location.href = 'account.html#addresses'; }, 700); return; }
    const btn = $('#placeOrder'); btn.disabled = true; btn.textContent = 'Placing order…';
    try {
      const method = paymentMethod.startsWith('Pay later') ? 'payLater' : 'razorpay';
      const { order, checkout } = await Api.placeOrder({ lines: s.lines.map((l) => ({ productId: l.p.id, quantity: l.qty, ...(l.size ? { size: l.size } : {}) })), addressId: addr.id, paymentMethod: method });
      state.cart = {}; save('spocart.cart', state.cart);
      if (checkout) {
        try { await Api.payWithRazorpay(checkout); }
        catch (ex) { toast(ex.message); }   // order stays awaiting payment; Pay now on the orders page
      }
      location.href = `orders.html?new=${encodeURIComponent(order.id)}`;
    } catch (ex) { toast(ex.message); btn.disabled = false; render(); }
  }

  onChange(render);
}

if (!CONFIG.DEMO_MODE) {
  $('.buyer-inline').hidden = true;
  // The server takes payments through Razorpay (UPI / cards / net banking) or pay-later credit.
  const upi = $('input[name="pay"][value="UPI"]').closest('.pay-option');
  upi.querySelector('strong').textContent = 'Pay online — UPI, cards, net banking';
  upi.querySelector('span').textContent = 'Secure Razorpay checkout opens after you place the order.';
  $('input[name="pay"][value="Net banking"]').closest('.pay-option').hidden = true;
  $('#staggered').closest('label').hidden = true;
}
renderAddress();
bind();
render();
});
