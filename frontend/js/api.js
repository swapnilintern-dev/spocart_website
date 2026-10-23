/* ==========================================================================
   SPOCART Wholesale — API client + adapters for the spocart-api backend
   Envelope: { ok: true, data } | { ok: false, message }. Bearer JWT from the
   customer session (or the admin session on admin pages). Every adapter maps
   the API shape onto the shapes the pages already render.
   ========================================================================== */
const Api = (() => {
  const FALLBACK_IMG = 'assets/images/footballs_stack.jpg';
  const token = () => (document.body.dataset.page?.startsWith('admin') ? load('spocart.admin', null)?.token : load('spocart.session', null)?.token) || null;

  async function request(method, path, body, { auth = true, raw = false } = {}) {
    const headers = {};
    if (!raw) headers['Content-Type'] = 'application/json';
    if (auth && token()) headers.Authorization = `Bearer ${token()}`;
    let res;
    try {
      res = await fetch(CONFIG.API_BASE_URL + path, { method, headers, body: raw ? body : body ? JSON.stringify(body) : undefined });
    } catch { throw new Error('Cannot reach the SPOCART server. Check your connection and try again.'); }
    const json = await res.json().catch(() => null);
    if (res.status === 401 && auth && token()) {
      // Expired / revoked token → drop the session so pages redirect to login.
      if (document.body.dataset.page?.startsWith('admin')) localStorage.removeItem('spocart.admin'); else Auth.signOut();
      throw new Error(json?.message || 'Your session has expired. Please sign in again.');
    }
    if (!res.ok || !json || json.ok !== true) throw new Error(json?.message || `Request failed (${res.status})`);
    return json.data;
  }
  /**
   * Keeps the raw Response. Two admin calls need it: the import template is a
   * file, and the import's "this sheet has errors" answer is a 422 that still
   * carries a result worth showing rather than an error to throw.
   */
  async function rawRequest(method, path, body) {
    const headers = {};
    if (token()) headers.Authorization = `Bearer ${token()}`;
    let res;
    try {
      res = await fetch(CONFIG.API_BASE_URL + path, { method, headers, body });
    } catch { throw new Error('Cannot reach the SPOCART server. Check your connection and try again.'); }
    if (res.status === 401) {
      if (document.body.dataset.page?.startsWith('admin')) localStorage.removeItem('spocart.admin'); else Auth.signOut();
      throw new Error('Your session has expired. Please sign in again.');
    }
    return res;
  }

  const get = (p, o) => request('GET', p, undefined, o);
  const post = (p, b, o) => request('POST', p, b, o);
  const put = (p, b, o) => request('PUT', p, b, o);
  const patch = (p, b, o) => request('PATCH', p, b, o);
  const del = (p, o) => request('DELETE', p, undefined, o);

  // ---------- mappers: API → site ----------
  const BUYER_FROM_TYPE = { school: 'schools', academy: 'schools', club: 'schools', retailer: 'shops', wholesaler: 'shops', gym: 'shops', corporate: 'shops', other: 'individual' };
  const TYPE_FROM_BUYER = { shops: 'retailer', schools: 'school', individual: 'other' };

  const mapCategory = (c, i, products) => ({
    id: c.id, name: c.name, skus: products.filter((p) => p.cat === c.id).length, home: i < 6,
    img: c.imageUrl || (products.find((p) => p.cat === c.id)?.img) || FALLBACK_IMG, subcategories: c.subcategories || [],
  });
  const mapProduct = (p) => ({
    id: p.id, cat: p.categoryId, brand: p.brand, name: p.name, unit: p.unit || 'pc', moq: p.moq || 1,
    mrp: null,                                   // backend has no MRP — cards hide strike-through/discount
    slabs: (p.tiers || []).map((t) => [t.minQty, t.unitPrice]).sort((a, b) => a[0] - b[0]),
    rating: Number(p.rating) || 0, reviews: p.reviewCount || 0,
    stock: p.inStock ? 9999 : 0,                 // boolean stock → "in stock" sentinel
    audience: ['shops', 'schools'], deal: !!p.popular, desc: p.description || '', subcategory: p.subcategory || '',
    img: (p.images && p.images[0]) || FALLBACK_IMG, images: p.images || [], sizes: p.sizes || [], features: p.features || [],
    customisable: !!p.customisable, hidden: p.active === false,
  });
  const mapAddress = (a) => ({
    id: a.id, label: a.label, name: a.businessName || a.contactName, contactName: a.contactName, businessName: a.businessName,
    line: [a.line1, a.line2].filter(Boolean).join(', '), line1: a.line1, line2: a.line2 || '', city: `${a.city}, ${a.state} ${a.pincode}`.trim(),
    cityOnly: a.city, state: a.state, pincode: a.pincode, phone: Auth.formatMobile(a.mobile), mobile: a.mobile, isDefault: !!a.isDefault, gstin: '',
  });
  const mapProfile = (u) => ({
    business: u.profile?.businessName || '', contact: u.profile?.contactName || '', email: u.profile?.email || '',
    gstin: u.profile?.gstin || '', pan: '', businessType: u.profile?.businessType || 'retailer',
    buyerType: BUYER_FROM_TYPE[u.profile?.businessType] || 'shops', phone: Auth.formatMobile(u.mobile),
    memberSince: u.createdAt || new Date().toISOString().slice(0, 10), creditLimit: u.creditLimit ?? 100000, role: u.role, userId: u.id,
  });
  const mapOrderAddress = (a) => (a && a.line1
    ? { name: a.businessName || a.contactName, line: [a.line1, a.line2].filter(Boolean).join(', '), city: `${a.city}, ${a.state} ${a.pincode}`, phone: Auth.formatMobile(a.mobile), gstin: a.gstin || '' }
    : (a || { name: '', line: '', city: '' }));
  const mapOrder = (o) => ({
    id: o.id, placedAt: o.placedAt, status: o.status, buyer: 'shops',
    lines: (o.lines || []).map((l) => ({ productId: l.productId, name: l.name, image: l.image || FALLBACK_IMG, unit: l.unit, quantity: l.quantity, unitPrice: l.unitPrice, mrp: null, size: l.size })),
    subtotal: o.subtotal, gst: o.gst, total: o.total, freight: 0, discount: 0, coupon: null,
    address: mapOrderAddress(o.address), paymentMethod: o.paymentMethod === 'payLater' ? 'Pay later (30 days)' : (o.payment?.method ? `Online (${o.payment.method})` : 'Online (Razorpay)'),
    paid: !!o.paid, etaStart: o.etaStart, etaEnd: o.etaEnd, invoiceId: o.invoiceId, trackingId: o.trackingId,
    history: (o.statusHistory && o.statusHistory.length ? o.statusHistory : [{ status: o.status, at: o.statusUpdatedAt || o.placedAt }]).map((h) => ({ status: h.status, at: h.at, note: h.note })),
    mobile: o.buyer?.mobile || Auth.session()?.mobile || null, buyerInfo: o.buyer || null, remote: true,
  });

  // ---------- catalogue ----------
  async function loadCatalog() {
    const [cats, prods] = await Promise.all([get('/catalog/categories', { auth: false }), get('/catalog/products', { auth: false })]);
    const products = prods.map(mapProduct);
    const categories = cats.map((c, i) => mapCategory(c, i, products));
    return { categories, products };
  }

  // ---------- auth / account ----------
  const sendOtp = (mobile) => post('/auth/otp/send', { mobile }, { auth: false });
  const verifyOtp = (mobile, code) => post('/auth/otp/verify', { mobile, code }, { auth: false });
  // Admin sign-in is two steps on its own pair of routes: the password first,
  // then the code it triggers. The customer routes above now refuse admins
  // outright, which is what keeps an admin session off the mobile app.
  const adminLogin = (mobile, password) => post('/auth/admin/login', { mobile, password }, { auth: false });
  const adminVerify = (mobile, code) => post('/auth/admin/verify', { mobile, code }, { auth: false });
  const me = () => get('/auth/me');
  const saveProfile = (p) => put('/auth/profile', {
    businessName: p.business, gstin: (p.gstin || '').toUpperCase(), businessType: p.businessType || TYPE_FROM_BUYER[p.buyerType] || 'retailer',
    contactName: p.contact, mobile: Auth.normalise(p.phone || Auth.session()?.mobile), email: p.email,
  });
  const listAddresses = async () => (await get('/addresses')).map(mapAddress);
  const addressBody = (a) => ({
    contactName: a.contactName || a.name, businessName: a.businessName || a.name || '', line1: a.line1 || a.line, line2: a.line2 || '',
    city: a.cityOnly || a.city, state: a.state, pincode: a.pincode, mobile: Auth.normalise(a.mobile || a.phone), label: a.label || 'office', isDefault: !!a.isDefault,
  });
  const saveAddress = async (a) => mapAddress(a.id ? await put(`/addresses/${a.id}`, addressBody(a)) : await post('/addresses', addressBody(a)));
  const deleteAddress = (id) => del(`/addresses/${id}`);
  const setDefaultAddress = (id) => post(`/addresses/${id}/default`);

  // ---------- orders & payment ----------
  const fetchOrders = async () => (await get('/orders')).map(mapOrder);
  const placeOrder = async ({ lines, addressId, paymentMethod }) => {
    const r = await post('/orders', { lines, addressId, paymentMethod });
    return { order: mapOrder(r.order), checkout: r.checkout };
  };
  const retryPayment = async (id) => { const r = await post(`/orders/${id}/retry-payment`); return { order: mapOrder(r.order), checkout: r.checkout }; };
  const verifyPayment = (proof) => post('/orders/payments/verify', proof).then(mapOrder);

  /** Opens Razorpay checkout; resolves with the verified order, rejects on dismiss/failure. */
  function payWithRazorpay(checkout) {
    return new Promise((resolve, reject) => {
      if (!window.Razorpay) return reject(new Error('Payment library did not load. Refresh and try again.'));
      const rzp = new window.Razorpay({
        key: checkout.keyId, amount: Math.round(checkout.amount * 100), currency: checkout.currency || 'INR', order_id: checkout.razorpayOrderId,
        name: checkout.name || 'SPOCART', description: checkout.description, prefill: checkout.prefill || {}, theme: { color: checkout.themeColor || '#E4132B' },
        handler: (res) => verifyPayment({ razorpayOrderId: res.razorpay_order_id, razorpayPaymentId: res.razorpay_payment_id, razorpaySignature: res.razorpay_signature }).then(resolve, reject),
        modal: { ondismiss: () => reject(new Error('Payment window closed — the order is saved as awaiting payment.')) },
      });
      rzp.on('payment.failed', (e) => reject(new Error(e.error?.description || 'Payment failed.')));
      rzp.open();
    });
  }

  // ---------- quotes & leads ----------
  const submitQuote = (items, notes, contact, extra = {}) => post('/quotes', { kind: extra.kind || 'bulk', items, notes: notes || '', ...(extra.designFileUrl ? { designFileUrl: extra.designFileUrl } : {}), ...(contact || {}) });
  const listQuotes = () => get('/quotes');
  const acceptQuote = async (id, addressId) => { const r = await post(`/quotes/${id}/accept`, { addressId }); return { order: mapOrder(r.order), checkout: r.checkout }; };
  const submitLead = (lead) => post('/leads', lead, { auth: false });
  const uploadDesign = (file) => { const fd = new FormData(); fd.append('file', file); return request('POST', '/uploads/design', fd, { raw: true }); };
  const notifications = () => get('/notifications');
  const readNotification = (id) => post(`/notifications/${id}/read`);
  const readAllNotifications = () => post('/notifications/read-all');
  const dashboard = () => get('/dashboard');

  // ---------- admin ----------
  const admin = {
    orders: async (q = {}) => (await get('/admin/orders' + qs(q))).map(mapOrder),
    setStatus: (id, status, trackingId, note) => post(`/admin/orders/${id}/status`, { status, ...(trackingId ? { trackingId } : {}), ...(note ? { note } : {}) }).then(mapOrder),
    cancel: (id, note) => post(`/admin/orders/${id}/cancel`, note ? { note } : {}).then(mapOrder),
    settleInvoice: (invoiceId, reference) => post(`/admin/invoices/${invoiceId}/settle`, { reference }).then(mapOrder),
    leads: () => get('/admin/leads'),
    quotes: () => get('/admin/quotes'),
    respondQuote: (id, quotedTotal, adminNote) => post(`/admin/quotes/${id}/respond`, { quotedTotal, ...(adminNote ? { adminNote } : {}) }),
    declineQuote: (id, adminNote) => post(`/admin/quotes/${id}/decline`, adminNote ? { adminNote } : {}),
    users: () => get('/admin/users'),
    setCredit: (id, creditLimit) => post(`/admin/users/${id}/credit`, { creditLimit }),
    // Sales is read from the orders themselves, so it is a fact, not a sample:
    // totals, GST and a per-day series between two dates.
    salesReport: (from, to) => get(`/admin/analytics/sales${qs({ from, to })}`),
    productInterest: (days, limit) => get(`/admin/analytics/products${qs({ days, limit })}`),
    buyerActivity: (quietDays) => get(`/admin/analytics/buyers${qs({ quietDays })}`),
    saveProduct: (p, isNew) => {
      const body = {
        id: p.id, categoryId: p.cat, name: p.name, brand: p.brand, subcategory: p.subcategory || catById(p.cat)?.name || 'General',
        unit: ['pc', 'pair', 'set', 'box'].includes(p.unit) ? p.unit : 'box', moq: p.moq, description: p.desc || '',
        images: p.images && p.images.length ? p.images : (p.img && !p.img.startsWith('data:') ? [p.img] : []),
        sizes: p.sizes || [], features: p.features || [], rating: p.rating || 0, reviewCount: p.reviews || 0,
        inStock: p.stock > 0, popular: !!p.deal, customisable: !!p.customisable, active: !p.hidden,
        tiers: p.slabs.map(([minQty, unitPrice]) => ({ minQty, unitPrice })),
      };
      return (isNew ? post('/admin/products', body) : put(`/admin/products/${p.id}`, body)).then(mapProduct);
    },
    setStock: (id, inStock) => patch(`/admin/products/${id}/stock`, { inStock }),
    addCategory: (c) => post('/admin/categories', c),
    uploadCatalogImage: (file) => { const fd = new FormData(); fd.append('file', file); return request('POST', '/admin/uploads/catalog', fd, { raw: true }); },
    // ── Bulk product import ─────────────────────────────────────────────────
    /** The .xlsx template for the data-entry employee, as a blob to save. */
    importTemplate: async () => {
      const res = await rawRequest('GET', '/admin/products/import/template');
      if (!res.ok) throw new Error(`Could not build the template (${res.status}). Try again in a moment.`);
      return res.blob();
    },
    /**
     * Uploads the filled sheet. With `dryRun` the server validates and reports
     * without changing anything. A sheet with bad rows answers 422 whose body
     * lists the row, column and problem — returned, not thrown, so the panel
     * can show the list.
     */
    importProducts: async (file, { dryRun = false } = {}) => {
      const fd = new FormData();
      fd.append('file', file);
      const res = await rawRequest('POST', `/admin/products/import?dryRun=${dryRun}`, fd);
      const json = await res.json().catch(() => null);
      if (json?.ok === true && json.data) return json.data;
      throw new Error(json?.message || `The upload failed (${res.status}).`);
    },
    broadcast: (b) => post('/admin/broadcast', b),
  };
  const qs = (o) => { const p = new URLSearchParams(Object.entries(o).filter(([, v]) => v !== '' && v != null)); return p.toString() ? `?${p}` : ''; };

  return { get, post, put, patch, del, loadCatalog, sendOtp, verifyOtp, adminLogin, adminVerify, me, saveProfile, listAddresses, saveAddress, deleteAddress, setDefaultAddress,
    fetchOrders, placeOrder, retryPayment, verifyPayment, payWithRazorpay, submitQuote, listQuotes, acceptQuote, submitLead, uploadDesign, notifications, readNotification, readAllNotifications, dashboard, admin, mapProfile, mapAddress, mapOrder, mapProduct, TYPE_FROM_BUYER, BUYER_FROM_TYPE };
})();
