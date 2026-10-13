/* ==========================================================================
   SPOCART Wholesale — shared layout + behaviour
   Injects the top bar, header, footer, cart drawer, mobile menu and toast
   into every page, and owns cart / quote / buyer-type state (localStorage).
   Page scripts (home.js, catalog.js) build on top of `Spocart`.
   ========================================================================== */


const firstName = (s) => (s?.name || '').split(' ')[0];

// No top strip: the phone and the For Shops / For Schools links are in the
// footer, Login and Sign up are buttons in the header below, and Admin now
// sits beside them.
const HEADER = (SESSION) => `
<header class="header">
  <div class="container header__inner">
    <button class="icon-btn header__burger" id="mobileMenuBtn" aria-label="Open menu">${icon('i-menu')}</button>
    <a class="brand" href="index.html" aria-label="SPOCART home">
      <img src="assets/brand/logo_dark.png" alt="SPOCART" class="brand__logo" />
      <span class="brand__tag">WHOLESALE</span>
    </a>
    <form class="search" id="searchForm" role="search" action="catalog.html" method="get">
      ${icon('i-search', 'ic search__icon')}
      <input type="search" name="q" id="searchInput" placeholder="Search balls, bats, gym equipment, shoes…" autocomplete="off" />
      <button type="submit" class="btn btn--dark btn--sm">Search</button>
      <ul class="search__results" id="searchResults" hidden></ul>
    </form>
    <div class="header__actions">
      <a href="index.html" class="action" id="homeBtn" title="Home">${icon('i-home')}<span>Home</span></a>
      <a href="orders.html" class="action" id="ordersBtn">${icon('i-box')}<span>Orders</span></a>
      <a href="cart.html" class="action" id="cartBtn">${icon('i-cart')}<span>Cart</span><em class="badge" id="cartCount">0</em></a>
      ${SESSION
        ? `<a href="account.html" class="action action--user" id="accountBtn" title="${SESSION.business || ''}"><span class="action__avatar">${(SESSION.name || 'U').slice(0, 1).toUpperCase()}</span><span>${firstName(SESSION) || 'Account'}</span></a>`
        : `<div class="header__auth"><a href="login.html" class="btn btn--outline btn--sm">Login</a><a href="signup.html" class="btn btn--red btn--sm">Sign up</a></div>`}
      <a href="${Auth.isAdmin() ? 'admin.html' : 'admin-login.html'}" class="header__admin ${Auth.isAdmin() ? 'is-on' : ''}" title="${Auth.isAdmin() ? 'Open admin panel' : 'Admin login'}" aria-label="Admin login">${icon('i-shield')}<span>Admin</span></a>
    </div>
  </div>
  <div class="navbar">
    <div class="container navbar__inner">
      <a class="navbar__all" href="catalog.html">${icon('i-menu')} All Categories</a>
      <nav class="navbar__links" id="mainNav">
        ${CATEGORIES.filter((c) => c.home).map((c) => `<a href="catalog.html?cat=${c.id}" data-cat="${c.id}">${c.name}</a>`).join('')}
        <a href="index.html#services">Services</a>
        <a href="index.html#deals" class="navbar__hot">Bulk Deals <span class="tag tag--red">HOT</span></a>
      </nav>
      <div class="navbar__gst">${icon('i-check-circle')} GST Invoice Available</div>
    </div>
  </div>
</header>`;

const FOOTER = (SESSION) => `
<footer class="footer" id="callback">
  <div class="container footer__grid">
    <div class="footer__brand">
      <img src="assets/brand/logo_dark.png" alt="SPOCART" class="footer__logo" />
      <p>India's wholesale sports supplier for shops, schools and academies since 2012.</p>
      <div class="socials">
        <a href="${CONFIG.SOCIAL.instagram}" target="_blank" rel="noopener" aria-label="Instagram">${icon('i-instagram')}</a>
        <a href="${CONFIG.SOCIAL.facebook}" target="_blank" rel="noopener" aria-label="Facebook">${icon('i-facebook')}</a>
        <a href="https://wa.me/${CONFIG.SUPPORT.whatsapp}" target="_blank" rel="noopener" aria-label="WhatsApp">${icon('i-whatsapp')}</a>
      </div>
    </div>
    <div>
      <h5>Shop</h5>
      <a href="index.html">Home</a>
      <a href="catalog.html">All products</a>
      <a href="catalog.html?cat=football">Football</a>
      <a href="catalog.html?cat=cricket">Cricket</a>
      <a href="catalog.html?cat=gym">Fitness &amp; gym</a>
      <a href="index.html#deals">Bulk deals</a>
    </div>
    <div>
      <h5>Business</h5>
      <a href="account.html">My account</a>
      <a href="cart.html">My cart</a>
      <a href="orders.html">Track my orders</a>
      <a href="partner.html?topic=partner">Become a partner</a>
      <a href="partner.html?topic=tender">School tenders</a>
      <a href="policies.html#gst">GST &amp; billing</a>
      <a href="policies.html#shipping">Shipping &amp; returns</a>
    </div>
    <form class="callback" id="callbackForm">
      <h5>Need a custom quote?</h5>
      <p>Share your list, get price in 2 hrs.</p>
      <input type="text" id="callbackContact" placeholder="Enter phone / email…" required />
      <button type="submit" class="btn btn--red btn--block">Request callback</button>
    </form>
  </div>
  <div class="container footer__bottom">
    <span>© 2026 SPOCART. All rights reserved.</span>
    <div>
      <a href="policies.html#terms">Terms</a>
      <a href="policies.html#privacy">Privacy</a>
      <a href="partner.html">Contact</a>
      <a href="${Auth.isAdmin() ? 'admin.html' : 'admin-login.html'}" class="footer__admin">${icon('i-shield')} Admin</a>
      <span class="footer__genuine">${icon('i-shield')} 100% genuine stock</span>
    </div>
  </div>
</footer>
<div class="overlay" id="overlay"></div>
<aside class="drawer" id="cartDrawer" aria-label="Cart">
  <div class="drawer__head">
    <h3>Your cart <span class="muted" id="drawerCount"></span></h3>
    <button class="icon-btn" id="closeCart" aria-label="Close cart">${icon('i-close')}</button>
  </div>
  <div class="drawer__body" id="cartItems"></div>
  <div class="drawer__foot">
    <div class="freight" id="freightNote"></div>
    <div class="totals">
      <div><span>Subtotal</span><b id="cartSubtotal">₹0</b></div>
      <div><span>GST (18%)</span><b id="cartGst">₹0</b></div>
      <div class="totals__grand"><span>Total</span><b id="cartTotal">₹0</b></div>
    </div>
    <button class="btn btn--red btn--block" id="checkoutBtn">Proceed to checkout ${icon('i-arrow')}</button>
    <a href="cart.html" class="drawer__link">View full cart</a>
  </div>
</aside>
<aside class="drawer drawer--left" id="mobileMenu" aria-label="Menu">
  <div class="drawer__head">
    <img src="assets/brand/logo_dark.png" alt="SPOCART" style="height:32px" />
    <button class="icon-btn" id="closeMenu" aria-label="Close menu">${icon('i-close')}</button>
  </div>
  <nav class="mobile-nav" id="mobileNav">
    <a href="index.html">${icon('i-home')} Home</a>
    <hr>
    <details class="mobile-nav__group">
      <summary>Shop by sport <em>${CATEGORIES.length}</em></summary>
      <div class="mobile-nav__sub">
        ${CATEGORIES.map((c) => `<a href="catalog.html?cat=${c.id}">${c.name}</a>`).join('')}
      </div>
    </details>
    <hr>
    <a href="catalog.html">All products</a>
    <a href="account.html">My account</a>
    <a href="orders.html">My orders</a>
    <a href="cart.html">Cart</a>
    <a href="index.html#deals">Bulk deals</a>
    <a href="index.html#services">Services</a>
    <a href="catalog.html?buyer=shops">For shops</a>
    <a href="catalog.html?buyer=schools">For schools</a>
    <a href="partner.html?topic=quote">Get a quote</a>
    <a href="policies.html">Policies</a>
    <hr>
    ${SESSION ? `<a href="account.html">${icon('i-user')} ${SESSION.name || 'My account'}</a><a href="#" data-signout>${icon('i-close')} Sign out</a>` : `<a href="login.html">${icon('i-user')} Login</a><a href="signup.html" class="mobile-nav__cta">Create account</a>`}
    <hr>
    <a href="tel:${CONFIG.SUPPORT.phoneDial}">Call ${CONFIG.SUPPORT.phoneDisplay}</a>
  </nav>
</aside>
<div class="toast" id="toast" role="status" aria-live="polite"></div>`;

// ---------- shared state ----------
const state = {
  cart: load('spocart.cart', {}),          // { productId: qty }
  quotes: load('spocart.quotes', []),      // [productId]
  buyer: load('spocart.buyer', 'shops'),   // shops | schools | individual
};
const listeners = [];
const emit = () => listeners.forEach((fn) => fn(state));

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('is-show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('is-show'), 2400);
}

// ---------- cart ----------
// Cart keys are "productId" or "productId#size" (the API requires a size for
// products that have sizes). Lines carry { p, size, key, qty, unit, total }.
const cartKey = (id, size) => (size ? `${id}#${size}` : id);
const parseKey = (key) => { const i = key.indexOf('#'); return i < 0 ? { id: key, size: null } : { id: key.slice(0, i), size: key.slice(i + 1) }; };

function cartLines() {
  const lines = [];
  for (const [key, qty] of Object.entries(state.cart)) {
    const { id, size } = parseKey(key);
    const p = byId(id);
    if (!p) { delete state.cart[key]; continue; }          // product removed from catalogue
    const unit = unitPriceFor(p, qty, state.buyer);
    lines.push({ p, size, key, qty, unit, total: unit * qty, saved: p.mrp ? (p.mrp - unit) * qty : 0 });
  }
  return lines;
}

/** Size chosen on a product card / price-check widget (null when the product has no sizes). */
function pickedSize(id) {
  const sel = document.querySelector(`[data-size-for="${id}"]`);
  return sel ? sel.value : null;
}

function addToCart(id, qty, size = pickedSize(id)) {
  const p = byId(id);
  if (p.stock === 0) { toast(`${p.name} is out of stock — add it to a quote to be notified.`); return; }
  if (p.sizes?.length && !size) { toast(`Choose a size for ${p.name} first.`); return; }
  const moq = state.buyer === 'individual' && BUYER_TYPES.individual.multiplier < 1 ? 1 : p.moq;
  const q = Math.max(qty, moq);
  const key = cartKey(id, p.sizes?.length ? size : null);
  state.cart[key] = (state.cart[key] || 0) + q;
  save('spocart.cart', state.cart);
  renderCart();
  toast(`Added ${q} × ${p.name}${size ? ` (${size})` : ''} at ${inr(unitPriceFor(p, state.cart[key], state.buyer))}/${p.unit}`);
  $('#cartBtn').classList.add('highlight');
  setTimeout(() => $('#cartBtn').classList.remove('highlight'), 1200);
}

function setQty(key, qty) {
  const p = byId(parseKey(key).id);
  const moq = state.buyer === 'individual' && BUYER_TYPES.individual.multiplier < 1 ? 1 : p.moq;
  if (qty < moq) { toast(`Minimum order for ${p.name} is ${moq} ${plural(p, moq)}`); qty = moq; }
  state.cart[key] = qty;
  save('spocart.cart', state.cart);
  renderCart();
}

function removeFromCart(key) {
  delete state.cart[key];
  save('spocart.cart', state.cart);
  renderCart();
}

function setBuyer(buyer) {
  if (!BUYER_TYPES[buyer]) return;
  state.buyer = buyer;
  save('spocart.buyer', buyer);
  renderCart();
}

function renderCart() {
  const lines = cartLines();
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const subtotal = lines.reduce((n, l) => n + l.total, 0);
  const gst = subtotal * GST_RATE;

  $('#cartCount').textContent = count > 999 ? '999+' : count;
  $('#drawerCount').textContent = count ? `(${count} ${count === 1 ? 'item' : 'items'})` : '';

  $('#cartItems').innerHTML = lines.length ? lines.map(({ p, size, key, qty, unit, total }) => `
    <div class="cart-item" data-id="${key}">
      <img src="${p.img}" alt="" onerror="this.onerror=null;this.src='assets/images/footballs_stack.jpg'" />
      <div>
        <strong>${p.name}${size ? ` <span class="tag tag--grey">${size}</span>` : ''}</strong>
        <small>${p.brand} • ${inr(unit)}/${p.unit} at ${qty} ${plural(p, qty)}</small>
        <div class="qty">
          <button data-dec aria-label="Decrease">${icon('i-minus')}</button>
          <input type="number" min="1" step="1" value="${qty}" aria-label="Quantity" />
          <button data-inc aria-label="Increase">${icon('i-plus')}</button>
        </div>
      </div>
      <div>
        <div class="cart-item__price">${inr(total)}</div>
        <button class="cart-item__remove" data-remove aria-label="Remove">${icon('i-trash')}</button>
      </div>
    </div>`).join('')
    : `<div class="cart-empty">${icon('i-cart')}<p>Your cart is empty.<br>Add bulk items from the catalog.</p></div>`;

  const freight = $('#freightNote');
  if (!lines.length) { freight.hidden = true; }
  else if (subtotal >= FREE_FREIGHT_AT) {
    freight.hidden = false; freight.className = 'freight is-free';
    freight.innerHTML = `${icon('i-truck')} Free freight unlocked on this order`;
  } else {
    freight.hidden = false; freight.className = 'freight';
    freight.innerHTML = `Add ${inr(FREE_FREIGHT_AT - subtotal)} more for free freight<div class="freight__bar"><i style="width:${(subtotal / FREE_FREIGHT_AT) * 100}%"></i></div>`;
  }

  $('#cartSubtotal').textContent = inr(subtotal);
  $('#cartGst').textContent = inr(gst);
  $('#cartTotal').textContent = inr(subtotal + gst);
  $('#checkoutBtn').disabled = !lines.length;
  $('#checkoutBtn').style.opacity = lines.length ? '' : '.5';
  emit();
}

// ---------- orders ----------
// Orders placed on the site live in localStorage next to the demo seed in
// orders.js. Checkout creates a payment-pending order the buyer settles from
// the orders page (mirrors the app's Pay Now flow).
function placeOrder({ paymentMethod = null, coupon = null, discount = 0, staggered = false } = {}) {
  const lines = cartLines();
  const subtotal = lines.reduce((n, l) => n + l.total, 0) - discount;
  const now = new Date();
  const freight = subtotal >= FREE_FREIGHT_AT ? 0 : 1200;
  const seq = (load('spocart.orderSeq', 100) + 1);
  save('spocart.orderSeq', seq);
  const stamp = now.toISOString().slice(2, 10).replace(/-/g, '');
  const order = {
    id: `SPO-${stamp}-${seq}`,
    placedAt: now.toISOString(),
    status: paymentMethod && paymentMethod.startsWith('Pay later') ? 'placed' : 'paymentPending',
    buyer: state.buyer,
    coupon, discount, staggered,
    lines: lines.map((l) => ({ productId: l.p.id, name: l.p.name, image: l.p.img, unit: l.p.unit, quantity: l.qty, unitPrice: l.unit, mrp: l.p.mrp, size: l.size })),
    subtotal,
    gst: subtotal * GST_RATE,
    total: subtotal * (1 + GST_RATE) + freight,
    freight,
    address: load('spocart.address', DEFAULT_ADDRESS),
    mobile: Auth.session()?.mobile || null,
    paymentMethod,
    paid: !!(paymentMethod && paymentMethod.startsWith('Pay later')),
    etaStart: new Date(now.getTime() + 4 * 864e5).toISOString(),
    etaEnd: new Date(now.getTime() + 6 * 864e5).toISOString(),
    invoiceId: null,
    trackingId: null,
    history: [{ status: 'paymentPending', at: now.toISOString() }],
  };
  if (order.status === 'placed') {
    order.invoiceId = `INV-26-${String(seq).padStart(4, '0')}`;
    order.history.push({ status: 'placed', at: now.toISOString() });
  }
  const orders = load('spocart.orders', []);
  orders.unshift(order);
  save('spocart.orders', orders);
  state.cart = {};
  save('spocart.cart', state.cart);
  return order;
}

/** API mode: a small banner when the live server could not be reached. */
function apiBanner() {
  if (CONFIG.DEMO_MODE || !API_STATUS.error) return '';
  return `<div class="api-banner">${icon('i-clock')} The catalogue is temporarily unavailable (${API_STATUS.error}). Please refresh in a moment.</div>`;
}

// ---------- quotes ----------
function toggleQuote(id) {
  const p = byId(id);
  const i = state.quotes.indexOf(id);
  if (i >= 0) { state.quotes.splice(i, 1); toast(`Removed ${p.name} from quote request`); }
  else { state.quotes.push(id); toast(`${p.name} added to quote request`); }
  save('spocart.quotes', state.quotes);
  $$(`[data-quote="${id}"]`).forEach((b) => b.classList.toggle('is-quoted', i < 0));
}

function addAllToQuote(ids) {
  let added = 0;
  ids.forEach((id) => { if (!state.quotes.includes(id)) { state.quotes.push(id); added++; } });
  save('spocart.quotes', state.quotes);
  $$('[data-quote]').forEach((b) => b.classList.toggle('is-quoted', state.quotes.includes(b.dataset.quote)));
  toast(added ? `${added} item${added > 1 ? 's' : ''} added — sealed quote in 2 hrs.` : 'These items are already in your quote request.');
}

/** Sealed quote for the current cart: real POST /quotes in API mode, local list in demo. */
async function quoteFromCart() {
  const lines = cartLines();
  if (!lines.length) return toast('Your cart is empty.');
  if (CONFIG.DEMO_MODE) return addAllToQuote([...new Set(lines.map((l) => l.p.id))]);
  if (!Auth.isLoggedIn()) { toast('Login to request a sealed quote.'); setTimeout(() => { location.href = 'login.html?next=cart.html'; }, 600); return; }
  try {
    await Api.submitQuote(lines.map((l) => ({ productId: l.p.id, description: `${l.p.name}${l.size ? ` (${l.size})` : ''}`, quantity: l.qty, ...(l.size ? { size: l.size } : {}) })), 'Sealed quote requested for the items in my cart.');
    toast('Quote request sent — our team replies within 2 hours. Track it under Account → Quote requests.');
  } catch (ex) { toast(ex.message); }
}

// ---------- sign out ----------
function signOut() {
  Auth.signOut();
  toast('Signed out. See you soon!');
  setTimeout(() => { location.href = 'index.html'; }, 400);
}

// ---------- drawers ----------
function openDrawer(id) {
  $('#overlay').classList.add('is-open');
  $(id).classList.add('is-open');
  document.body.style.overflow = 'hidden';
}
function closeDrawers() {
  $('#overlay').classList.remove('is-open');
  $$('.drawer').forEach((d) => d.classList.remove('is-open'));
  document.body.style.overflow = '';
}

// ---------- search suggestions ----------
function renderSearchSuggestions() {
  const q = $('#searchInput').value.trim().toLowerCase();
  const box = $('#searchResults');
  if (q.length < 2) { box.hidden = true; return; }
  const hits = PRODUCTS.filter((p) => [p.name, p.brand, p.cat].join(' ').toLowerCase().includes(q)).slice(0, 5);
  if (!hits.length) { box.hidden = true; return; }
  box.innerHTML = hits.map((p) => `<li data-id="${p.id}"><img src="${p.img}" alt="" /><span>${p.name}</span><b>${inr(unitPriceFor(p, 100, state.buyer))}</b></li>`).join('');
  box.hidden = false;
}

// ---------- shared product card ----------
function productCard(p, opts = {}) {
  const qty = opts.qty ?? 100;
  const unit = unitPriceFor(p, qty, state.buyer);
  const showSlab = state.buyer === 'individual' ? null : (p.slabs.find(([min]) => min >= qty) || p.slabs[p.slabs.length - 1]);
  const quoted = state.quotes.includes(p.id);
  const notified = load('spocart.notify', []);
  const out = p.stock === 0;
  const moqLabel = state.buyer === 'individual' ? 'Single pc' : `MOQ ${p.moq}${p.unit === 'set' ? ' set' : ''}`;
  return `
    <article class="product ${out ? 'is-out' : ''}" data-id="${p.id}" data-cat="${p.cat}">
      <a class="product__media" href="catalog.html?cat=${p.cat}">
        <img src="${p.img}" alt="${p.name}" loading="lazy" onerror="this.onerror=null;this.src='assets/images/footballs_stack.jpg'" />
        ${p.mrp ? `<span class="tag tag--red">-${pct(p.mrp, unit)}%</span>` : ''}
        <span class="tag tag--dark">${moqLabel}</span>
      </a>
      <div class="product__body">
        <span class="product__brand">${p.brand}</span>
        <h4 class="product__name">${p.name}</h4>
        ${p.desc ? `<p class="product__desc">${p.desc}</p>` : ''}
        <div class="product__meta">${icon('i-star')} ${p.rating} (${p.reviews.toLocaleString('en-IN')}) • ${out ? '<span class="stock stock--out">Out of stock</span>' : `<span class="stock">${icon('i-check-circle')} In stock</span>`}</div>
        <div class="product__price"><b>${inr(unit)}</b>${p.mrp ? `<s>${inr(p.mrp)}</s>` : ''}<small>/${p.unit}</small></div>
        <span class="product__slab">${showSlab ? `${showSlab[0]}+ ${plural(p)} • ` : (p.mrp ? 'Below MRP • ' : '')}GST invoice incl.${state.buyer === 'schools' && BUYER_TYPES.schools.multiplier < 1 ? ' • tender price' : ''}</span>
        ${p.sizes?.length ? `<label class="size-pick"><span>Size</span><select data-size-for="${p.id}" aria-label="Size">${p.sizes.map((s) => `<option>${s}</option>`).join('')}</select></label>` : ''}
        <div class="product__actions">
          ${out ? `<button class="btn btn--outline btn--sm" data-notify="${p.id}">${notified.includes(p.id) ? '✓ Will notify' : 'Notify me'}</button>` : `<button class="btn btn--dark btn--sm" data-add="${p.id}">Add to cart</button>`}
          <button class="icon-btn ${quoted ? 'is-quoted' : ''}" data-quote="${p.id}" title="Add to quote request" aria-label="Add to quote">${icon('i-quote')}</button>
        </div>
      </div>
    </article>`;
}

// ---------- boot ----------
function mountLayout() {
  mountSprite();
  const SESSION = Auth.session();
  $('#siteHeader').outerHTML = apiBanner() + HEADER(SESSION);
  $('#siteFooter').outerHTML = FOOTER(SESSION);

  const page = document.body.dataset.page;
  const params = new URLSearchParams(location.search);
  $$('#mainNav a').forEach((a) => {
    const isCat = a.dataset.cat && page === 'catalog' && params.get('cat') === a.dataset.cat;
    a.classList.toggle('is-active', !!isCat);
  });
  if (params.get('q')) $('#searchInput').value = params.get('q');
  $('#ordersBtn').classList.toggle('is-active', page === 'orders');
  $('#accountBtn')?.classList.toggle('is-active', page === 'account');
  $('#cartBtn').classList.toggle('is-active', page === 'cart');

  // Delegated product actions (work on any page that renders productCard)
  document.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    if (add && !add.disabled) { addToCart(add.dataset.add, byId(add.dataset.add).moq); return; }
    const quote = e.target.closest('[data-quote]');
    if (quote) { toggleQuote(quote.dataset.quote); return; }
    const notify = e.target.closest('[data-notify]');
    if (notify) {
      const list = load('spocart.notify', []);
      if (!list.includes(notify.dataset.notify)) { list.push(notify.dataset.notify); save('spocart.notify', list); }
      notify.textContent = '✓ Will notify';
      const prod = byId(notify.dataset.notify);
      if (!CONFIG.DEMO_MODE) {
        const s = Auth.session();
        if (!s) { toast('Login so we can message you when it is back in stock.'); setTimeout(() => { location.href = `login.html?next=${encodeURIComponent(location.pathname.split('/').pop() + location.search)}`; }, 700); return; }
        Api.submitLead({ name: s.name || 'Customer', business: s.business || undefined, mobile: s.mobile, message: `[Back in stock] Notify when available: ${prod.name} (${prod.id})`, sourcePage: location.pathname }).catch(() => {});
      }
      toast(Auth.session() ? `We'll message ${Auth.formatMobile(Auth.session().mobile)} when ${prod.name} is back in stock.` : 'Saved — login so we can message you when it is back in stock.');
      return;
    }
    const so = e.target.closest('[data-signout]');
    if (so) { e.preventDefault(); signOut(); }
  });

  // Cart drawer (the icon opens the quick drawer; the full page is cart.html)
  $('#cartBtn').addEventListener('click', (e) => { if (document.body.dataset.page === 'cart') return; e.preventDefault(); openDrawer('#cartDrawer'); });
  $('#closeCart').addEventListener('click', closeDrawers);
  $('#overlay').addEventListener('click', closeDrawers);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeDrawers(); $('#searchResults').hidden = true; } });
  $('#cartItems').addEventListener('click', (e) => {
    const row = e.target.closest('.cart-item');
    if (!row) return;
    const input = $('input', row);
    if (e.target.closest('[data-inc]')) setQty(row.dataset.id, Number(input.value) + 1);
    else if (e.target.closest('[data-dec]')) setQty(row.dataset.id, Number(input.value) - 1);
    else if (e.target.closest('[data-remove]')) removeFromCart(row.dataset.id);
  });
  $('#cartItems').addEventListener('change', (e) => {
    const row = e.target.closest('.cart-item');
    if (row && e.target.matches('input')) setQty(row.dataset.id, Number(e.target.value) || 0);
  });
  $('#checkoutBtn').addEventListener('click', () => {
    if (!cartLines().length) return;
    location.href = 'cart.html';
  });

  // Header highlights
  $('#homeBtn').classList.toggle('is-active', page === 'home');

  // Search
  const input = $('#searchInput');
  input.addEventListener('input', renderSearchSuggestions);
  input.addEventListener('focus', renderSearchSuggestions);
  document.addEventListener('click', (e) => { if (!e.target.closest('.search')) $('#searchResults').hidden = true; });
  $('#searchResults').addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (li) location.href = `catalog.html?q=${encodeURIComponent(byId(li.dataset.id).name)}`;
  });

  // Callback form
  $('#callbackForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('#callbackContact').value.trim();
    const ok = /^(\+?91[-\s]?)?[6-9]\d{9}$/.test(v.replace(/\s/g, '')) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    if (!ok) { toast('Enter a valid Indian mobile number or email.'); $('#callbackContact').focus(); return; }
    const done = () => { e.target.reset(); toast('Thanks! A SPOCART manager will call you within 2 hours (Mon–Sat, 10am–7pm).'); };
    if (CONFIG.DEMO_MODE) return done();
    const isMobile = /^\d+$/.test(v.replace(/\D/g, '')) && Auth.validMobile(v);
    Api.submitLead({ name: Auth.session()?.name || 'Website visitor', business: Auth.session()?.business || undefined, mobile: isMobile ? Auth.normalise(v) : (Auth.session()?.mobile || '9999999999'), email: isMobile ? undefined : v, message: `Callback request from the website footer (${document.body.dataset.page} page).`, sourcePage: location.pathname })
      .then(done).catch((ex) => toast(ex.message));
  });

  // Mobile menu
  $('#mobileMenuBtn').addEventListener('click', () => openDrawer('#mobileMenu'));
  $('#closeMenu').addEventListener('click', closeDrawers);

  renderCart();
}

window.Spocart = {
  state, toast, addToCart, setQty, removeFromCart, cartLines, renderCart, setBuyer, placeOrder, cartKey, parseKey,
  toggleQuote, addAllToQuote, quoteFromCart, openDrawer, closeDrawers, productCard, signOut,
  onChange: (fn) => listeners.push(fn),
};
CATALOG_READY.then(mountLayout);
