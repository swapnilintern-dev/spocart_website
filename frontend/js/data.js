/* ==========================================================================
   SPOCART Wholesale — catalogue seed data + pricing helpers
   Swap CATEGORIES / PRODUCTS for a fetch against
   https://api.spocart.info/api/v1 when wiring to the live API.
   ========================================================================== */

const GST_RATE = 0.18;
const FREE_FREIGHT_AT = 25000;

// Buyer types drive pricing: shops/schools get slab prices (schools get a
// tender discount on top), individuals get a single-piece price below MRP.
const BUYER_TYPES = {
  shops:      { label: 'Retail shop',      icon: 'i-store',  multiplier: 1,    slabs: true },
  schools:    { label: 'School / Academy', icon: 'i-school', multiplier: 0.97, slabs: true },
  individual: { label: 'Individual',       icon: 'i-user',   multiplier: 0.92, slabs: false },
};

// `home: true` → shown in the 6-tile "Shop by category" grid on the home page.
const CATEGORIES = [
  { id: 'football',  name: 'Football',      skus: 120, home: true,  img: 'assets/images/footballs_stack.jpg' },
  { id: 'cricket',   name: 'Cricket',       skus: 180, home: true,  img: 'assets/images/cricket_ball.jpg' },
  { id: 'badminton', name: 'Badminton',     skus: 90,  home: true,  img: 'assets/images/hero_badminton.jpg' },
  { id: 'gym',       name: 'Gym & Fitness', skus: 220, home: true,  img: 'assets/images/gym_dumbbells.jpg' },
  { id: 'footwear',  name: 'Footwear',      skus: 150, home: true,  img: 'assets/images/runners_group.jpg' },
  { id: 'apparel',   name: 'Apparel',       skus: 200, home: true,  img: 'assets/images/fitness_accessories.jpg' },
  { id: 'tennis',    name: 'Tennis & TT',   skus: 60,  home: false, img: 'assets/images/tennis_clay.jpg' },
  { id: 'swimming',  name: 'Swimming',      skus: 45,  home: false, img: 'assets/images/swimmer.jpg' },
];

// Brands carried by SPOCART, in display order.
const BRANDS = ['Cosco', 'Nivia', 'Yonex', 'Li Ning', 'Vector X', 'Vicky', 'Nike', 'Adidas', 'Puma', 'USI', 'SF', 'SS', 'SG', 'Sega', 'Attack', 'Nxton', 'Techno Sports', 'Tynor', 'Shiv Naresh', 'EM', 'Stag', 'Amza', 'Tyka', 'Sparton', 'Flash', 'Alpha', 'Sixit', 'Reebok', 'Woods', 'Fenta', 'Gray Nicolls'];

// Brand logos live in assets/brands/<slug>.jpg; brands without one fall back to initials.
const BRAND_LOGOS = new Set(['cosco', 'nivia', 'yonex', 'li-ning', 'vector-x', 'vicky', 'nike', 'adidas', 'puma', 'usi', 'sf', 'ss', 'sg', 'sega', 'attack', 'nxton', 'techno-sports', 'tynor', 'shiv-naresh', 'em', 'stag', 'amza', 'tyka', 'sparton', 'flash', 'alpha', 'sixit', 'reebok', 'fenta']);
const brandSlug = (b) => String(b).trim().toLowerCase().replace(/\s+/g, '-');
const brandLogo = (b, cls = '') => BRAND_LOGOS.has(brandSlug(b))
  ? `<img class="brand-logo ${cls}" src="assets/brands/${brandSlug(b)}.jpg" alt="${b}" loading="lazy" />`
  : `<span class="brand-mark ${cls}">${String(b).slice(0, 2).toUpperCase()}</span>`;

// slabs: [minQty, unitPrice] ascending. mrp = single-piece MRP.
// deal: true → featured in "Best wholesale prices this week" on the home page.
const IMG = {
  football: 'assets/images/footballs_stack.jpg', match: 'assets/images/football_match.jpg', cricket: 'assets/images/cricket_ball.jpg',
  dumbbell: 'assets/images/gym_dumbbells.jpg', gym: 'assets/images/gym_studio.jpg', fitness: 'assets/images/fitness_accessories.jpg',
  badminton: 'assets/images/hero_badminton.jpg', runners: 'assets/images/runners_group.jpg', tennis: 'assets/images/tennis_clay.jpg', swim: 'assets/images/swimmer.jpg',
};
// Each product's own photo lives at assets/products/<id>.jpg; `img` (a category photo) is the fallback.
const P = (id, cat, brand, name, unit, moq, mrp, slabs, rating, reviews, stock, audience, deal, img) =>
  ({ id, cat, brand, name, unit, moq, mrp, slabs, rating, reviews, stock, audience, deal, img: `assets/products/${id}.jpg`, fallbackImg: img });

const PRODUCTS = [
  // Football
  P('fb-pro-5',    'football', 'Cosco',    'Cosco Pro Football Size 5',            'pc',   10, 1299, [[10, 899], [100, 749], [500, 649]],   4.7, 820,  320,  ['shops', 'schools'], true,  IMG.football),
  P('fb-train-4',  'football', 'Nivia',    'Nivia Training Football Size 4',       'pc',   20, 899,  [[20, 649], [100, 549], [500, 479]],   4.6, 540,  860,  ['shops', 'schools'], false, IMG.match),
  P('fb-vx-5',     'football', 'Vector X', 'Vector X Match Football Size 5',       'pc',   10, 1499, [[10, 1049], [100, 899], [500, 799]],  4.5, 310,  260,  ['shops', 'schools'], false, IMG.football),
  P('fb-goal-net', 'football', 'Vector X', 'Vector X Goal Net 24×8 ft (Pair)',     'pair', 2,  6999, [[2, 4999], [10, 4499], [50, 3999]],   4.5, 120,  40,   ['schools'],          false, IMG.match),
  P('fb-adi-5',    'football', 'Adidas',   'Adidas Tiro League Football',          'pc',   10, 2499, [[10, 1899], [100, 1699], [500, 1549]], 4.8, 460,  140,  ['shops'],            false, IMG.football),
  P('fb-flash-5',  'football', 'Flash',    'Flash Club Football Size 5',           'pc',   20, 799,  [[20, 549], [100, 469], [500, 419]],   4.3, 190,  700,  ['shops', 'schools'], false, IMG.match),
  // Cricket
  P('cr-bat-sh',   'cricket',  'SG',       'SG English Willow Bat SH',             'pc',   10, 4999, [[10, 3499], [100, 2899], [500, 2599]], 4.8, 1200, 150,  ['shops'],            true,  IMG.cricket),
  P('cr-ball-lt',  'cricket',  'SG',       'SG Leather Cricket Ball 4pc (Box)',    'pc',   24, 1599, [[24, 1099], [100, 949], [500, 849]],  4.7, 390,  900,  ['shops', 'schools'], true,  IMG.cricket),
  P('cr-ss-bat',   'cricket',  'SS',       'SS Kashmir Willow Bat (Youth)',        'pc',   10, 2999, [[10, 2099], [100, 1799], [500, 1599]], 4.6, 520,  240,  ['shops', 'schools'], false, IMG.cricket),
  P('cr-ss-kit',   'cricket',  'SS',       'SS Junior Cricket Kit (Bag + Pads)',   'set',  5,  5499, [[5, 3999], [50, 3599], [200, 3299]],  4.4, 210,  0,    ['schools'],          false, IMG.cricket),
  P('cr-sf-bat',   'cricket',  'SF',       'SF Sapphire English Willow Bat',       'pc',   10, 6499, [[10, 4599], [100, 3999], [500, 3599]], 4.7, 330,  90,   ['shops'],            false, IMG.cricket),
  P('cr-gn-bat',   'cricket',  'Gray Nicolls', 'Gray Nicolls Powerbow Bat',        'pc',   5,  8999, [[5, 6499], [50, 5799], [200, 5299]],  4.9, 280,  60,   ['shops'],            false, IMG.cricket),
  P('cr-vicky',    'cricket',  'Vicky',    'Vicky Cricket Tennis Ball (Pack of 6)', 'pack', 20, 599, [[20, 399], [100, 349], [500, 299]],   4.5, 610,  1500, ['shops', 'schools'], false, IMG.cricket),
  P('cr-amza',     'cricket',  'Amza',     'Amza Kashmir Willow Bat (Tape Ball)',  'pc',   10, 1799, [[10, 1249], [100, 1099], [500, 949]], 4.3, 240,  380,  ['shops', 'schools'], false, IMG.cricket),
  P('cr-sparton',  'cricket',  'Sparton',  'Sparton Batting Pads (Pair)',          'pair', 10, 2499, [[10, 1799], [100, 1549], [500, 1399]], 4.4, 170,  210,  ['shops', 'schools'], false, IMG.cricket),
  P('cr-sixit',    'cricket',  'Sixit',    'Sixit Batting Gloves (Pair)',          'pair', 12, 1499, [[12, 1049], [100, 899], [500, 799]],  4.2, 130,  330,  ['shops', 'schools'], false, IMG.cricket),
  // Badminton & racquet
  P('bd-racket',   'badminton', 'Yonex',   'Yonex Nanoray Light Racket',           'pc',   10, 2199, [[10, 1499], [100, 1299], [500, 1149]], 4.5, 360,  260,  ['shops', 'schools'], true,  IMG.badminton),
  P('bd-shuttle',  'badminton', 'Yonex',   'Yonex Mavis 350 Shuttlecock (Tube)',   'tube', 24, 1499, [[24, 999], [100, 899], [500, 799]],   4.6, 450,  1200, ['shops', 'schools'], false, IMG.badminton),
  P('bd-lining',   'badminton', 'Li Ning', 'Li Ning Carbon Racket XP',             'pc',   10, 2699, [[10, 1899], [100, 1699], [500, 1499]], 4.6, 290,  180,  ['shops'],            false, IMG.badminton),
  P('bd-fenta',    'badminton', 'Fenta',   'Fenta Badminton Shoes (Non-marking)',  'pair', 12, 1999, [[12, 1349], [100, 1199], [500, 1049]], 4.3, 150,  300,  ['shops', 'schools'], false, IMG.badminton),
  P('tn-ball',     'tennis',   'Cosco',    'Cosco Tennis Ball Can (3)',            'can',  24, 699,  [[24, 449], [100, 399], [500, 359]],   4.5, 290,  640,  ['shops', 'schools'], false, IMG.tennis),
  P('tt-stag',     'tennis',   'Stag',     'Stag Table Tennis Racket Set',         'set',  10, 1299, [[10, 899], [100, 799], [500, 699]],   4.4, 220,  420,  ['shops', 'schools'], false, IMG.tennis),
  // Gym & fitness
  P('gym-hex-10',  'gym',      'USI',      'USI Hex Dumbbell 10kg Pair',           'pair', 20, 2499, [[20, 1799], [100, 1499], [500, 1349]], 4.9, 640,  210,  ['shops', 'schools'], true,  IMG.dumbbell),
  P('gym-kettle',  'gym',      'USI',      'USI Cast Iron Kettlebell 12kg',        'pc',   10, 2199, [[10, 1599], [100, 1399], [500, 1249]], 4.6, 180,  0,    ['shops'],            false, IMG.gym),
  P('gym-mat',     'gym',      'Reebok',   'Reebok Yoga & Exercise Mat 6mm',       'pc',   20, 999,  [[20, 599], [100, 499], [500, 429]],   4.4, 275,  480,  ['schools'],          true,  IMG.gym),
  P('gym-band',    'gym',      'Cosco',    'Cosco Resistance Band Set (5)',        'set',  20, 1299, [[20, 799], [100, 699], [500, 599]],   4.3, 330,  720,  ['shops', 'schools'], false, IMG.fitness),
  P('gym-rope',    'gym',      'Cosco',    'Cosco Skipping Rope (Pack of 10)',     'pack', 10, 1499, [[10, 999], [100, 899], [500, 799]],   4.4, 410,  900,  ['shops', 'schools'], false, IMG.fitness),
  P('gym-tynor',   'gym',      'Tynor',    'Tynor Knee Cap Support (Pair)',        'pair', 12, 499,  [[12, 349], [100, 299], [500, 269]],   4.5, 380,  850,  ['shops'],            false, IMG.fitness),
  P('gym-alpha',   'gym',      'Alpha',    'Alpha Gym Gloves (Pair)',              'pair', 12, 699,  [[12, 449], [100, 399], [500, 349]],   4.2, 140,  520,  ['shops'],            false, IMG.fitness),
  // Swimming
  P('sw-goggles',  'swimming', 'Nivia',    'Nivia Anti-fog Swim Goggles',          'pc',   12, 899,  [[12, 549], [100, 479], [500, 429]],   4.4, 160,  300,  ['shops', 'schools'], false, IMG.swim),
  P('sw-cap',      'swimming', 'Woods',    'Woods Silicone Swim Cap',              'pc',   24, 399,  [[24, 249], [100, 219], [500, 189]],   4.3, 120,  600,  ['shops', 'schools'], false, IMG.swim),
  // Footwear
  P('fw-runner',   'footwear', 'Nike',     'Nike Revolution Running Shoe',         'pair', 12, 3999, [[12, 2799], [100, 2499], [500, 2299]], 4.6, 910,  340,  ['shops'],            true,  IMG.runners),
  P('fw-spikes',   'footwear', 'Puma',     'Puma Running Spikes Pro',              'pair', 20, 3499, [[20, 2399], [100, 2099], [500, 1899]], 4.5, 280,  180,  ['shops', 'schools'], false, IMG.runners),
  P('fw-sega',     'footwear', 'Sega',     'Sega Marathon Running Shoes',          'pair', 12, 1299, [[12, 849], [100, 749], [500, 679]],   4.4, 730,  620,  ['shops', 'schools'], false, IMG.runners),
  P('fw-attack',   'footwear', 'Attack',   'Attack Football Studs',                'pair', 12, 1599, [[12, 1099], [100, 949], [500, 849]],  4.2, 260,  410,  ['shops', 'schools'], false, IMG.runners),
  P('fw-reebok',   'footwear', 'Reebok',   'Reebok Training Shoe (Unisex)',        'pair', 12, 3299, [[12, 2299], [100, 2049], [500, 1899]], 4.5, 340,  150,  ['shops'],            false, IMG.runners),
  // Apparel
  P('ap-jersey',   'apparel',  'Techno Sports', 'Techno Sports Team Jersey Set (15)', 'set', 1, 8999, [[1, 6499], [10, 5499], [50, 4999]],   4.6, 410,  75,   ['schools'],          true,  IMG.fitness),
  P('ap-track',    'apparel',  'Shiv Naresh', 'Shiv Naresh Tracksuit Set',        'set',  10, 2499, [[10, 1699], [100, 1499], [500, 1349]], 4.4, 220,  410,  ['shops', 'schools'], false, IMG.runners),
  P('ap-adi',      'apparel',  'Adidas',   'Adidas Essentials Tracksuit',          'set',  10, 4999, [[10, 3699], [100, 3399], [500, 3149]], 4.7, 380,  120,  ['shops'],            false, IMG.runners),
  P('ap-nxton',    'apparel',  'Nxton',    'Nxton Dry-fit Sports T-shirt (Pack of 5)', 'pack', 10, 1999, [[10, 1349], [100, 1199], [500, 1049]], 4.3, 290, 560, ['shops', 'schools'], false, IMG.fitness),
  P('ap-tyka',     'apparel',  'Tyka',     'Tyka Cricket Whites Set',              'set',  10, 2299, [[10, 1649], [100, 1449], [500, 1299]], 4.5, 170,  230,  ['shops', 'schools'], false, IMG.fitness),
  P('ap-em',       'apparel',  'EM',       'EM Training Jersey (Pack of 10)',      'pack', 5,  3499, [[5, 2499], [50, 2199], [200, 1999]],  4.2, 110,  340,  ['schools'],          false, IMG.fitness),
  P('ap-puma',     'apparel',  'Puma',     'Puma Team Shorts (Pack of 10)',        'pack', 5,  4999, [[5, 3699], [50, 3299], [200, 2999]],  4.5, 150,  180,  ['shops', 'schools'], false, IMG.fitness),
];


// ---------- admin catalogue edits ----------
// The admin panel can change any product field, add products, hide or delete
// them. Edits live in localStorage ('spocart.catalogEdits') and are applied
// here so the storefront reflects them immediately. Replace with the API once
// products are served from /products.
//   overrides: { [id]: { ...changed fields } }   added: [ product ]   removed: [ id ]
const CATALOG_EDITS = CONFIG.DEMO_MODE ? load('spocart.catalogEdits', { overrides: {}, added: [], removed: [] }) : { overrides: {}, added: [], removed: [] };
const PRODUCT_BASE_IDS = new Set(PRODUCTS.map((p) => p.id));
if (CONFIG.DEMO_MODE) {
  PRODUCTS.forEach((p) => { const ov = CATALOG_EDITS.overrides[p.id]; if (ov) Object.assign(p, ov); });
  CATALOG_EDITS.added.forEach((p) => { if (!PRODUCTS.some((x) => x.id === p.id)) PRODUCTS.push(p); });
  CATALOG_EDITS.removed.forEach((id) => { const i = PRODUCTS.findIndex((p) => p.id === id); if (i >= 0) PRODUCTS.splice(i, 1); });
}
/** Every product incl. hidden ones — the admin panel lists these; the storefront uses PRODUCTS. */
const ALL_PRODUCTS = PRODUCTS.slice();
for (let i = PRODUCTS.length - 1; i >= 0; i--) if (PRODUCTS[i].hidden) PRODUCTS.splice(i, 1);

ALL_PRODUCTS.forEach((p) => { if (p.brand && !BRANDS.includes(p.brand)) BRANDS.push(p.brand); });

function saveCatalogEdits() { if (CONFIG.DEMO_MODE) save('spocart.catalogEdits', CATALOG_EDITS); }

const INDIAN_STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman & Nicobar', 'Chandigarh', 'Dadra & Nagar Haveli and Daman & Diu', 'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'];

// Demo account. The account page edits these into localStorage
// ('spocart.profile' / 'spocart.address'); checkout reads the address.
const DEFAULT_PROFILE = { business: 'Rajesh Sports', contact: 'Rajesh Kumar', phone: '+91 98111 22334', email: 'rajesh@rajeshsports.in', gstin: '07AABCR1234F1Z5', pan: 'AABCR1234F', memberSince: '2019-03-12', creditLimit: 100000 };
const DEFAULT_ADDRESS = { name: 'Rajesh Sports', line: '14, Sadar Bazar Road, Karol Bagh', city: 'New Delhi 110005', phone: '+91 98111 22334', gstin: '07AABCR1234F1Z5' };

const SERVICES = [
  { icon: 'i-printer', name: 'Custom logo printing',         desc: 'Sublimation & screen printing on jerseys, balls and kit bags. School and club branding from 10 pcs.', price: 'From ₹49 / pc' },
  { icon: 'i-school',  name: 'School & academy kit program', desc: 'Annual sports-kit contracts with staggered delivery, tender paperwork and one consolidated PO.', price: 'Annual contract' },
  { icon: 'i-ruler',   name: 'Ground & court setup',         desc: 'Goal posts, nets, cricket pitch covers, basketball hoops — supplied, installed and certified.', price: 'Site quote' },
  { icon: 'i-tool',    name: 'Equipment maintenance (AMC)',  desc: 'Gym machine servicing, re-stringing, bat knocking and repairs on a yearly maintenance contract.', price: 'From ₹4,999 / yr' },
];

// ---------- helpers (shared by every page) ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
const pct = (mrp, price) => Math.round((1 - price / mrp) * 100);
const byId = (id) => (typeof ALL_PRODUCTS !== 'undefined' ? ALL_PRODUCTS : PRODUCTS).find((p) => p.id === id);
const catById = (id) => CATEGORIES.find((c) => c.id === id);
const icon = (id, cls = 'ic') => `<svg class="${cls}"><use href="#${id}"/></svg>`;
const plural = (p, n = 2) => (n === 1 ? p.unit : p.unit === 'pc' ? 'pcs' : /(s|x|ch|sh)$/.test(p.unit) ? p.unit + 'es' : p.unit + 's');

/** Slab unit price for a product at a quantity, before buyer-type adjustment. */
function slabPriceFor(product, qty) {
  let price = product.slabs[0][1];
  for (const [min, p] of product.slabs) if (qty >= min) price = p;
  return price;
}

/** Unit price for a product at a quantity for the given buyer type. */
function unitPriceFor(product, qty, buyer = 'shops') {
  const t = BUYER_TYPES[buyer] || BUYER_TYPES.shops;
  if (!t.slabs) return Math.round(product.mrp * t.multiplier);
  return Math.round(slabPriceFor(product, qty) * t.multiplier);
}

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode — ignore */ }
}

// ---------- live catalogue (API mode) ----------
// Pages run their init inside CATALOG_READY.then(...) so the arrays above are
// filled from the server first. If the server is unreachable the built-in
// sample catalogue stays and API_STATUS.error explains why.
const API_STATUS = { live: false, error: null };

/**
 * Pulls the catalogue from the server into the arrays above. Run once on load,
 * and again by the admin panel after a bulk import so the new products appear
 * without a page reload.
 */
async function refreshCatalog() {
  if (CONFIG.DEMO_MODE) return;
  try {
    const { categories, products } = await Api.loadCatalog();
    const brandOrder = BRANDS.slice();
    const seen = new Set(products.map((p) => p.brand));
    const ordered = [...brandOrder.filter((b) => seen.has(b)), ...[...seen].filter((b) => !brandOrder.includes(b)).sort()];
    CATEGORIES.splice(0, CATEGORIES.length, ...categories);
    ALL_PRODUCTS.splice(0, ALL_PRODUCTS.length, ...products);
    PRODUCTS.splice(0, PRODUCTS.length, ...products.filter((p) => !p.hidden));
    BRANDS.splice(0, BRANDS.length, ...ordered);
    PRODUCT_BASE_IDS.clear(); products.forEach((p) => PRODUCT_BASE_IDS.add(p.id));
    // The server charges the same tier price to every buyer type.
    Object.values(BUYER_TYPES).forEach((t) => { t.multiplier = 1; t.slabs = true; });
    API_STATUS.live = true;
    API_STATUS.error = null;
  } catch (e) {
    API_STATUS.error = e.message;
    // First load: never show sample products — empty catalogue + banner instead.
    // A later refresh leaves whatever is already on screen alone.
    if (!API_STATUS.live) {
      CATEGORIES.splice(0, CATEGORIES.length); PRODUCTS.splice(0, PRODUCTS.length); ALL_PRODUCTS.splice(0, ALL_PRODUCTS.length);
    }
    console.warn('SPOCART API unavailable:', e.message);
  }
}
const CATALOG_READY = refreshCatalog();
