/* ==========================================================================
   SPOCART Wholesale — catalog page
   Filters, sort, pagination, slab banner, slab table and the sticky cart bar.
   Filter state round-trips through the URL so category / search / buyer
   links from the home page and header land on the right view.
   ========================================================================== */
CATALOG_READY.then(async () => {
const { state, toast, setBuyer, cartLines, addAllToQuote, openDrawer, productCard, onChange } = window.Spocart;

const PER_PAGE = 9;
const SLAB_MINS = [10, 100, 500];

const f = {
  cats: new Set(),
  brands: new Set(),
  slab: 100,
  inStock: true,
  gst: true,
  sort: 'saving',
  view: 'grid',
  group: true,
  page: 1,
  q: '',
};

// ---------- URL <-> state ----------
function readUrl() {
  const p = new URLSearchParams(location.search);
  if (p.get('cat')) p.get('cat').split(',').forEach((c) => catById(c) && f.cats.add(c));
  if (p.get('brand')) p.get('brand').split(',').forEach((b) => BRANDS.includes(b) && f.brands.add(b));
  if (p.get('slab') && SLAB_MINS.includes(Number(p.get('slab')))) f.slab = Number(p.get('slab'));
  if (p.get('sort')) f.sort = p.get('sort');
  if (p.get('view') === 'list') f.view = 'list';
  if (p.get('group') === 'none') f.group = false;
  if (p.get('page')) f.page = Math.max(1, Number(p.get('page')) || 1);
  if (p.get('q')) f.q = p.get('q');
  if (p.get('stock') === 'all') f.inStock = false;
  if (p.get('buyer') && BUYER_TYPES[p.get('buyer')]) setBuyer(p.get('buyer'));
}

function writeUrl() {
  const p = new URLSearchParams();
  if (f.cats.size) p.set('cat', [...f.cats].join(','));
  if (f.brands.size) p.set('brand', [...f.brands].join(','));
  if (f.slab !== 100) p.set('slab', f.slab);
  if (f.sort !== 'saving') p.set('sort', f.sort);
  if (f.view === 'list') p.set('view', 'list');
  if (!f.group) p.set('group', 'none');
  if (f.page > 1) p.set('page', f.page);
  if (f.q) p.set('q', f.q);
  if (!f.inStock) p.set('stock', 'all');
  if (state.buyer !== 'shops') p.set('buyer', state.buyer);
  history.replaceState(null, '', p.toString() ? `?${p}` : location.pathname);
}

// ---------- derived ----------
function filtered() {
  const q = f.q.trim().toLowerCase();
  return PRODUCTS.filter((p) =>
    (!f.cats.size || f.cats.has(p.cat)) &&
    (!f.brands.size || f.brands.has(p.brand)) &&
    (!f.inStock || p.stock > 0) &&
    (!q || [p.name, p.brand, p.cat, catById(p.cat)?.name].join(' ').toLowerCase().includes(q)));
}

function sorted(list) {
  const price = (p) => unitPriceFor(p, f.slab, state.buyer);
  const s = [...list];
  switch (f.sort) {
    case 'price-asc':  return s.sort((a, b) => price(a) - price(b));
    case 'price-desc': return s.sort((a, b) => price(b) - price(a));
    case 'rating':     return s.sort((a, b) => b.rating - a.rating);
    case 'popular':    return s.sort((a, b) => b.reviews - a.reviews);
    default:           return s.sort((a, b) => pct(b.mrp, price(b)) - pct(a.mrp, price(a)));
  }
}

// ---------- sidebar ----------
function renderBuyerList() {
  $('#buyerList').innerHTML = Object.entries(BUYER_TYPES).map(([id, t]) => `
    <button class="buyer-btn ${state.buyer === id ? 'is-active' : ''}" data-buyer="${id}">${icon(t.icon)} ${t.label}</button>`).join('');
  $('#slabChips').classList.toggle('is-disabled', !BUYER_TYPES[state.buyer].slabs);
}

function renderCatList() {
  $('#catList').innerHTML = CATEGORIES.map((c) => {
    const n = PRODUCTS.filter((p) => p.cat === c.id && (!f.inStock || p.stock > 0)).length;
    return `<label class="check"><input type="checkbox" value="${c.id}" ${f.cats.has(c.id) ? 'checked' : ''} /><i>${icon('i-check')}</i><span>${c.name}</span><em>${n}</em></label>`;
  }).join('');
}

function renderBrandList() {
  const q = ($('#brandSearch').value || '').trim().toLowerCase();
  const inScope = PRODUCTS.filter((p) => (!f.cats.size || f.cats.has(p.cat)) && (!f.inStock || p.stock > 0));
  $('#brandChecks').innerHTML = BRANDS
    .filter((b) => !q || b.toLowerCase().includes(q))
    .map((b) => {
      const n = inScope.filter((p) => p.brand === b).length;
      return `<label class="check ${n ? '' : 'is-muted'}"><input type="checkbox" value="${b}" ${f.brands.has(b) ? 'checked' : ''} /><i>${icon('i-check')}</i><span>${b}</span><em>${n}</em></label>`;
    }).join('') || '<p class="filter-note">No brand matches.</p>';
}

function renderSlabChips() {
  $$('#slabChips .chip-btn').forEach((b) => b.classList.toggle('is-active', Number(b.dataset.slab) === f.slab));
}

function renderActiveFilters() {
  const chips = [];
  if (f.q) chips.push({ k: 'q', label: `“${f.q}”` });
  f.cats.forEach((c) => chips.push({ k: 'cat', v: c, label: catById(c).name }));
  f.brands.forEach((b) => chips.push({ k: 'brand', v: b, label: b }));
  if (!f.inStock) chips.push({ k: 'stock', label: 'Incl. out of stock' });
  $('#activeFilters').innerHTML = chips.map((c) => `<span class="chip"><span>${c.label}</span><button data-remove-filter="${c.k}" data-value="${c.v ?? ''}" aria-label="Remove filter">✕</button></span>`).join('');
}

// ---------- results ----------
function renderHead(list) {
  const titleCat = f.cats.size === 1 ? catById([...f.cats][0]).name : f.cats.size > 1 ? `${f.cats.size} categories` : f.q ? `“${f.q}”` : 'All products';
  $('#pageTitle').textContent = `Bulk catalog — ${titleCat}`;
  $('#crumbCurrent').textContent = titleCat;
  document.title = `${titleCat} — Bulk catalog — SPOCART Wholesale`;
  const stock = list.reduce((n, p) => n + p.stock, 0);
  $('#stockPill').textContent = CONFIG.DEMO_MODE ? `${stock.toLocaleString('en-IN')} pcs ready stock` : `${list.filter((p) => p.stock > 0).length} products in stock`;
  const start = list.length ? (f.page - 1) * PER_PAGE + 1 : 0;
  const end = Math.min(f.page * PER_PAGE, list.length);
  const slabText = BUYER_TYPES[state.buyer].slabs ? `Slab: ${f.slab}+ pcs` : 'Single-piece pricing';
  const brandCount = new Set(list.map((p) => p.brand)).size;
  $('#showingText').textContent = f.group
    ? `${list.length} products from ${brandCount} brand${brandCount !== 1 ? 's' : ''} • ${slabText}`
    : `Showing ${start}${end > start ? `–${end}` : ''} of ${list.length} products • ${slabText}`;
}

function renderGrid(list) {
  const grid = $('#productGrid');
  const groups = $('#brandGroups');
  const jump = $('#brandJump');
  $('#productEmpty').hidden = list.length > 0;
  if (f.group) {
    grid.hidden = true; groups.hidden = false;
    // Brand order follows BRANDS (the order SPOCART lists them); only brands with products in view appear.
    const byBrand = BRANDS.map((b) => [b, list.filter((p) => p.brand === b)]).filter(([, ps]) => ps.length);
    groups.innerHTML = byBrand.map(([b, ps]) => `
      <section class="brand-group" id="brand-${b.replace(/\s+/g, '-').toLowerCase()}">
        <header class="brand-group__head">
          <h3><span class="brand-mark">${b.slice(0, 2).toUpperCase()}</span> ${b} <small>${ps.length} product${ps.length > 1 ? 's' : ''}</small></h3>
          ${f.brands.size === 1 && f.brands.has(b) ? '' : `<button class="link" data-only-brand="${b}">Only ${b}</button>`}
        </header>
        <div class="product-grid product-grid--3 ${f.view === 'list' ? 'is-list' : ''}">${ps.map((p) => productCard(p, { qty: f.slab })).join('')}</div>
      </section>`).join('');
    jump.hidden = byBrand.length < 2;
    jump.innerHTML = `<span>Brands in view:</span>` + byBrand.map(([b, ps]) => `<a href="#brand-${b.replace(/\s+/g, '-').toLowerCase()}" class="chip-btn">${b} <em>${ps.length}</em></a>`).join('');
    return list;
  }
  grid.hidden = false; groups.hidden = true; jump.hidden = true;
  const pageItems = list.slice((f.page - 1) * PER_PAGE, f.page * PER_PAGE);
  grid.classList.toggle('is-list', f.view === 'list');
  grid.innerHTML = pageItems.map((p) => productCard(p, { qty: f.slab })).join('');
  return pageItems;
}

function renderPagination(total) {
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  if (f.page > pages) f.page = pages;
  const nav = $('#pagination');
  if (pages <= 1 || f.group) { nav.innerHTML = ''; return; }
  const nums = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - f.page) <= 1) nums.push(i);
    else if (nums[nums.length - 1] !== '…') nums.push('…');
  }
  nav.innerHTML = `
    <button class="page-btn" data-page="${f.page - 1}" ${f.page === 1 ? 'disabled' : ''} aria-label="Previous">${icon('i-chevron-left')}</button>
    ${nums.map((n) => n === '…' ? '<span class="page-gap">…</span>' : `<button class="page-btn ${n === f.page ? 'is-active' : ''}" data-page="${n}">${n}</button>`).join('')}
    <button class="page-btn" data-page="${f.page + 1}" ${f.page === pages ? 'disabled' : ''} aria-label="Next">${icon('i-chevron-right')}</button>`;
}

// ---------- slab banner ----------
function renderSlabBanner(list) {
  const el = $('#slabText');
  if (!BUYER_TYPES[state.buyer].slabs) {
    el.innerHTML = `<b>Individual pricing:</b> single pieces at ~8% below MRP, no MOQ. Switch to <b>Retail shop</b> or <b>School / Academy</b> for slab discounts up to 45%.`;
    return;
  }
  // Reference product: the biggest cart line inside the current view, else the first product in view.
  const lines = cartLines().filter((l) => list.includes(l.p)).sort((a, b) => b.qty - a.qty);
  const ref = lines[0] || (list[0] ? { p: list[0], qty: 0 } : null);
  if (!ref) { el.textContent = 'Slab pricing: order 100+ pcs for an extra discount, 500+ for the best price.'; return; }
  const { p, qty } = ref;
  let cur = -1;
  p.slabs.forEach(([min], i) => { if (qty >= min) cur = i; });
  const next = p.slabs[cur + 1];
  const unitLabel = plural(p);
  if (cur < 0) {
    const [min, price] = p.slabs[1] || p.slabs[0];
    el.innerHTML = `<b>Slab pricing on ${p.name}:</b> ${min}+ ${unitLabel} = extra ${pct(p.slabs[0][1], price)}% off. Add ${min} ${unitLabel} to unlock ${inr(price)}/${p.unit}.`;
  } else if (next) {
    const extra = pct(p.slabs[0][1], p.slabs[cur][1]);
    const more = next[0] - qty;
    const saveMore = (p.slabs[cur][1] - next[1]) * next[0];
    el.innerHTML = `<b>Slab unlocked: ${p.slabs[cur][0]}+ ${unitLabel}${extra ? ` = extra ${extra}% off` : ''}.</b> Add ${more} more ${unitLabel} of ${p.name} to reach ${next[0]}+ slab and save ${inr(saveMore)} more.`;
  } else {
    el.innerHTML = `<b>Top slab unlocked on ${p.name}:</b> ${p.slabs[cur][0]}+ ${unitLabel} at ${inr(unitPriceFor(p, qty, state.buyer))}/${p.unit} — the best wholesale price we offer.`;
  }
}

function renderSlabTable(list) {
  const rows = f.group ? list.slice(0, 40) : list.slice((f.page - 1) * PER_PAGE, f.page * PER_PAGE);
  const mult = BUYER_TYPES[state.buyer].multiplier;
  $('#slabModalNote').textContent = `${BUYER_TYPES[state.buyer].label} pricing • per ${rows[0] ? 'unit' : 'pc'} excl. GST${state.buyer === 'schools' ? ' • includes 3% tender discount' : ''}`;
  $('#slabTable').innerHTML = `
    <thead><tr><th>Product</th><th>MRP</th><th>Slab 1</th><th>Slab 2</th><th>Slab 3</th></tr></thead>
    <tbody>${rows.map((p) => `
      <tr>
        <td><strong>${p.name}</strong><small>${p.brand} • MOQ ${p.moq} ${plural(p, p.moq)}</small></td>
        <td><s>${inr(p.mrp)}</s></td>
        ${p.slabs.map(([min, price]) => `<td><small>${min}+</small><b>${inr(price * mult)}</b></td>`).join('')}
      </tr>`).join('')}
    </tbody>`;
}

// ---------- cart bar ----------
function renderCartBar() {
  const lines = cartLines();
  const items = lines.length;
  const pcs = lines.reduce((n, l) => n + l.qty, 0);
  const total = lines.reduce((n, l) => n + l.total, 0);
  const saved = lines.reduce((n, l) => n + l.saved, 0);
  $('#cartbar').classList.toggle('is-empty', !items);
  $('#cartbarBadge').textContent = items;
  $('#cartbarBadge').hidden = !items;
  $('#cartbarItems').textContent = items ? `${items} item${items > 1 ? 's' : ''} • ${pcs.toLocaleString('en-IN')} pcs` : 'Your cart is empty';
  $('#cartbarSave').textContent = items ? `You save ${inr(saved)} on slab pricing` : 'Add bulk items to see slab savings';
  $('#cartbarTotal').textContent = inr(total);
  $('#cartbarCheckout').disabled = !items;
  $('#cartbarQuote').disabled = !items;
}

// ---------- master render ----------
function render({ scroll = false } = {}) {
  const list = sorted(filtered());
  renderPagination(list.length);
  renderHead(list);
  renderGrid(list);
  renderSlabBanner(list);
  renderActiveFilters();
  renderCatList();
  renderBrandList();
  renderCartBar();
  writeUrl();
  if (scroll) $('#slabBanner').scrollIntoView({ behavior: 'smooth', block: 'start' });
  return list;
}

function resetFilters() {
  f.cats.clear(); f.brands.clear(); f.slab = 100; f.inStock = true; f.gst = true; f.q = ''; f.page = 1;
  $('#inStockOnly').checked = true; $('#gstOnly').checked = true; $('#searchInput').value = ''; $('#brandSearch').value = '';
  renderSlabChips(); render();
}

// ---------- events ----------
function bind() {
  $('#buyerList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-buyer]');
    if (!b) return;
    setBuyer(b.dataset.buyer);          // triggers onChange → render
    renderBuyerList();
    toast(`${BUYER_TYPES[b.dataset.buyer].label} pricing applied`);
  });

  $('#catList').addEventListener('change', (e) => {
    if (!e.target.matches('input')) return;
    e.target.checked ? f.cats.add(e.target.value) : f.cats.delete(e.target.value);
    f.page = 1; render();
  });

  $('#slabChips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-slab]');
    if (!b || !BUYER_TYPES[state.buyer].slabs) return;
    f.slab = Number(b.dataset.slab); renderSlabChips(); render();
  });

  $('#brandChecks').addEventListener('change', (e) => {
    if (!e.target.matches('input')) return;
    e.target.checked ? f.brands.add(e.target.value) : f.brands.delete(e.target.value);
    f.page = 1; render();
  });
  $('#brandSearch').addEventListener('input', renderBrandList);
  $('#brandGroups').addEventListener('click', (e) => {
    const b = e.target.closest('[data-only-brand]');
    if (!b) return;
    f.brands = new Set([b.dataset.onlyBrand]); f.page = 1; render({ scroll: true });
  });
  $('#groupByBrand').addEventListener('change', (e) => { f.group = e.target.checked; f.page = 1; render(); });

  $('#inStockOnly').addEventListener('change', (e) => { f.inStock = e.target.checked; f.page = 1; render(); });
  $('#gstOnly').addEventListener('change', (e) => { f.gst = e.target.checked; toast(e.target.checked ? 'Showing GST-invoiced products' : 'All SPOCART orders ship with a GST invoice — filter kept for reference.'); });
  $('#clearFilters').addEventListener('click', resetFilters);
  $('#emptyClear').addEventListener('click', resetFilters);

  $('#activeFilters').addEventListener('click', (e) => {
    const b = e.target.closest('[data-remove-filter]');
    if (!b) return;
    const { removeFilter: k, value: v } = b.dataset;
    if (k === 'q') { f.q = ''; $('#searchInput').value = ''; }
    if (k === 'cat') f.cats.delete(v);
    if (k === 'brand') f.brands.delete(v);
    if (k === 'stock') { f.inStock = true; $('#inStockOnly').checked = true; }
    f.page = 1; render();
  });

  $('#sortSelect').addEventListener('change', (e) => { f.sort = e.target.value; f.page = 1; render(); });
  $$('.view-toggle button').forEach((b) => b.addEventListener('click', () => {
    f.view = b.dataset.view;
    $$('.view-toggle button').forEach((x) => x.classList.toggle('is-active', x === b));
    render();
  }));

  $('#pagination').addEventListener('click', (e) => {
    const b = e.target.closest('[data-page]');
    if (!b || b.disabled) return;
    f.page = Number(b.dataset.page); render({ scroll: true });
  });

  // Search from the shared header filters this page instead of navigating
  $('#searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    f.q = $('#searchInput').value.trim(); f.page = 1;
    $('#searchResults').hidden = true;
    render({ scroll: true });
  });
  $('#searchInput').addEventListener('input', (e) => { if (!e.target.value && f.q) { f.q = ''; render(); } });

  // Collapsible filter card
  document.addEventListener('click', (e) => {
    const h = e.target.closest('[data-collapse]');
    if (!h) return;
    const open = h.getAttribute('aria-expanded') === 'true';
    h.setAttribute('aria-expanded', String(!open));
    $(`#${h.dataset.collapse}`).hidden = open;
  });

  // Mobile filter drawer toggle
  $('#filterToggle').addEventListener('click', () => {
    const open = $('#filters').classList.toggle('is-open');
    $('#filterToggle').innerHTML = open ? `${icon('i-close')} Close filters` : `${icon('i-menu')} Filters`;
  });

  // Slab table modal
  $('#viewSlabTable').addEventListener('click', () => { renderSlabTable(sorted(filtered())); $('#slabModal').hidden = false; document.body.style.overflow = 'hidden'; });
  const closeModal = () => { $('#slabModal').hidden = true; document.body.style.overflow = ''; };
  $('#closeSlabModal').addEventListener('click', closeModal);
  $('#slabModal').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  // BOQ upload
  $('#uploadBoqBtn').addEventListener('click', () => $('#boqFile').click());
  $('#boqFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast('File too large — keep the BOQ under 10 MB.'); e.target.value = ''; return; }
    if (!CONFIG.DEMO_MODE) {
      if (!Auth.isLoggedIn()) { toast('Login to upload a BOQ — we attach it to your account.'); setTimeout(() => { location.href = `login.html?next=${encodeURIComponent('catalog.html' + location.search)}`; }, 700); return; }
      try {
        toast('Uploading BOQ…');
        const up = await Api.uploadDesign(file);
        await Api.submitQuote([{ description: `BOQ / tender document: ${file.name}`, quantity: 1 }], 'Please quote against the attached BOQ.', null, { kind: 'csv', designFileUrl: up.url });
        toast(`"${file.name}" received — sealed quote within 2 hrs. Track it under Account → Quote requests.`);
      } catch (ex) { toast(ex.message); }
      e.target.value = '';
      return;
    }
    toast(`Received "${file.name}" (${(file.size / 1024).toFixed(0)} KB). Sealed quote in 2 hrs to your registered contact.`);
    e.target.value = '';
  });

  // Cart bar
  $('#cartbarCheckout').addEventListener('click', () => { location.href = 'cart.html'; });
  $('#cartbarQuote').addEventListener('click', () => window.Spocart.quoteFromCart());

  // Cart / buyer changes from the shared layout re-price the grid
  onChange(() => { renderBuyerList(); render(); });
}

// ---------- init ----------
readUrl();
if (!CONFIG.DEMO_MODE) $('#buyerList').closest('.filter-card').hidden = true;   // one price list on the server
renderBuyerList();
renderSlabChips();
$('#groupByBrand').checked = f.group;
$('#sortSelect').value = f.sort;
$('#inStockOnly').checked = f.inStock;
$$('.view-toggle button').forEach((x) => x.classList.toggle('is-active', x.dataset.view === f.view));
bind();
render();
});
