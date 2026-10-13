/* ==========================================================================
   SPOCART Wholesale — home page
   ========================================================================== */
CATALOG_READY.then(async () => {
const { state, toast, addToCart, openDrawer, productCard } = window.Spocart;

let dealFilter = 'all';

function renderCategories() {
  $('#catGrid').innerHTML = CATEGORIES.filter((c) => c.home).map((c) => `
    <a href="catalog.html?cat=${c.id}" class="cat">
      <div class="cat__img"><img src="${c.img}" alt="${c.name}" loading="lazy" onerror="this.onerror=null;this.src='assets/images/footballs_stack.jpg'" /></div>
      <div class="cat__body"><strong>${c.name}</strong><span>${c.skus} SKUs</span></div>
    </a>`).join('');
}

function renderDeals() {
  const list = PRODUCTS.filter((p) => p.deal && (dealFilter === 'all' || p.audience.includes(dealFilter)));
  $('#productGrid').innerHTML = list.map((p) => productCard(p)).join('');
}

function setDealFilter(filter) {
  dealFilter = filter;
  $$('#dealTabs button').forEach((b) => b.classList.toggle('is-active', b.dataset.filter === filter));
  $$('.segment').forEach((s) => s.classList.toggle('is-active', s.dataset.audience === filter || (filter === 'all' && s.dataset.audience === 'shops')));
  renderDeals();
}

function renderServices() {
  $('#serviceGrid').innerHTML = SERVICES.map((s) => `
    <div class="service">
      <span class="service__icon">${icon(s.icon)}</span>
      <strong>${s.name}</strong>
      <p>${s.desc}</p>
      <div class="service__foot"><span>${s.price}</span><a href="partner.html?topic=service&item=${encodeURIComponent(s.name)}" class="btn btn--outline btn--sm">Enquire</a></div>
    </div>`).join('');
}

// ---------- price check widget ----------
function renderPriceCheck() {
  const sel = $('#pcProduct');
  const avail = PRODUCTS.filter((p) => p.stock > 0);
  sel.innerHTML = avail.map((p) => `<option value="${p.id}">${p.name}</option>`).join('');
  sel.value = (avail.find((p) => p.id === 'fb-pro-5') || avail.find((p) => p.deal) || avail[0])?.id || '';
  if (!sel.value) return;
  updateSlabs();
}

function updateSlabs() {
  const p = byId($('#pcProduct').value);
  const qty = Number($('#pcQty').value);
  let activeIdx = 0;
  p.slabs.forEach(([min], i) => { if (qty >= min) activeIdx = i; });
  $('#pcSlabs').innerHTML = p.slabs.map(([min, price], i) => `
    <button type="button" class="slab ${i === activeIdx ? 'is-active' : ''}" data-min="${min}">
      ${i === activeIdx ? `<span class="slab__flag">${min}+</span>` : ''}
      <small>${min}+ ${plural(p)}</small><b>${inr(price)}</b>
    </button>`).join('');
  $('#pcAdd').innerHTML = `Add ${qty} to cart ${icon('i-arrow')}`;
  const sizeWrap = $('#pcSizeWrap');
  if (sizeWrap) { sizeWrap.hidden = !p.sizes?.length; if (p.sizes?.length) $('#pcSize').innerHTML = p.sizes.map((s) => `<option>${s}</option>`).join(''); }
}

function bind() {
  $('#dealTabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setDealFilter(b.dataset.filter); });

  $('#pcProduct').addEventListener('change', updateSlabs);
  $('#pcQty').addEventListener('change', updateSlabs);
  $('#pcSlabs').addEventListener('click', (e) => {
    const slab = e.target.closest('.slab');
    if (!slab) return;
    const min = Number(slab.dataset.min);
    const qtySel = $('#pcQty');
    const opt = [...qtySel.options].map((o) => Number(o.value)).find((v) => v >= min) ?? min;
    if (![...qtySel.options].some((o) => Number(o.value) === opt)) qtySel.add(new Option(`Qty: ${opt}`, opt));
    qtySel.value = opt;
    updateSlabs();
  });
  $('#pcAdd').addEventListener('click', () => {
    const p = byId($('#pcProduct').value);
    const size = p.sizes?.length ? ($('#pcSize')?.value || p.sizes[0]) : null;
    addToCart(p.id, Number($('#pcQty').value), size);
    if (Object.keys(state.cart).length) openDrawer('#cartDrawer');
  });

  $('#claimCoupon')?.addEventListener('click', async () => {
    const code = $('#couponCode').textContent;
    try { await navigator.clipboard.writeText(code); toast(`Code ${code} copied and saved — it applies automatically in your cart.`); }
    catch { toast(`Code ${code} saved — it applies automatically in your cart.`); }
    save('spocart.coupon', code);
    $('#claimCoupon').textContent = 'Claimed ✓';
  });
}

if (!CONFIG.DEMO_MODE) $('.coupon')?.remove();   // coupons have no backend yet
renderCategories();
renderDeals();
renderServices();
renderPriceCheck();
bind();
});
