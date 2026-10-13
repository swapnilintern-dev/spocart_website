/* ==========================================================================
   SPOCART Wholesale — enquiry / partner / support page
   Prefills from the signed-in profile and the ?topic= / ?item= params.
   Requests are stored locally until POST /enquiries is wired.
   ========================================================================== */
CATALOG_READY.then(async () => {
const { toast } = window.Spocart;
const TOPICS = {
  quote:   { title: 'Get a bulk quote', sub: 'Share your list — sealed quote with slab pricing in 2 hours.', label: 'Products, quantities & sizes' },
  school:  { title: 'School annual sports kit program', sub: 'One PO, full-year supply, custom logo printing and staggered delivery.', label: 'Sports played, student strength & timeline' },
  tender:  { title: 'Tender & BOQ support', sub: 'We prepare compliant quotes, documentation and samples for institutional tenders.', label: 'Tender details, due date & items' },
  partner: { title: 'Become a SPOCART B2B partner', sub: 'Retail shops and distributors: margins up to 45%, credit terms and a dedicated manager.', label: 'About your shop / territory' },
  service: { title: 'Sports services enquiry', sub: 'Logo printing, ground & court setup, equipment AMC and more.', label: 'Which service and where' },
  support: { title: 'Order support', sub: 'Delivery, invoice, damage or return — quote your order ID and we sort it out.', label: 'Order ID and the issue' },
};
const params = new URLSearchParams(location.search);
const form = $('#enquiryForm');
const topic = TOPICS[params.get('topic')] ? params.get('topic') : 'quote';
form.elements.topic.value = topic;

function applyTopic(t) {
  const c = TOPICS[t];
  $('#pageTitle').textContent = c.title; $('#pageSub').textContent = c.sub; $('#messageLabel').textContent = c.label;
  document.title = `${c.title} — SPOCART Wholesale`;
}
applyTopic(topic);
$('#topicGrid').addEventListener('change', (e) => applyTopic(e.target.value));

// Prefill from profile / session / item
const profile = load('spocart.profile', null);
const session = Auth.session();
if (profile) { form.elements.name.value = profile.contact || ''; form.elements.business.value = profile.business || ''; form.elements.email.value = profile.email || ''; }
if (session) form.elements.mobile.value = session.mobile;
if (params.get('item')) form.elements.message.value = `Service: ${params.get('item')}\n`;
if (params.get('order')) form.elements.message.value = `Order ${params.get('order')}: `;
if (params.get('product')) form.elements.message.value = `${params.get('product')} — qty: `;
form.elements.mobile.addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10); });

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  const v = (k) => String(fd.get(k) || '').trim();
  const err = $('#enquiryError');
  const fail = (m) => { err.textContent = m; err.hidden = false; };
  if (!v('name') || !v('business')) return fail('Please enter your name and business.');
  if (!Auth.validMobile(v('mobile'))) return fail('Enter a valid 10-digit mobile number.');
  if (v('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v('email'))) return fail('That email address doesn’t look right.');
  if (v('message').length < 10) return fail('Tell us a little more about the requirement (at least 10 characters).');
  const file = fd.get('file');
  if (file && file.size > 10 * 1024 * 1024) return fail('Attachment is over 10 MB.');
  err.hidden = true;
  const ref = `ENQ-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
  if (!CONFIG.DEMO_MODE) {
    const btn = $('#submitEnquiry'); btn.disabled = true; btn.textContent = 'Sending…';
    Api.submitLead({ name: v('name'), business: v('business') || undefined, mobile: Auth.normalise(v('mobile')), email: v('email') || undefined,
      message: `[${TOPICS[v('topic')].title}]${v('city') ? ` City: ${v('city')}.` : ''}${v('volume') ? ` Volume: ${v('volume')}.` : ''}${file?.name ? ` Attachment to follow: ${file.name}.` : ''}\n${v('message')}`, sourcePage: `partner.html?topic=${v('topic')}` })
      .then(() => { form.hidden = true; $('#enquiryDone').hidden = false; $('#doneText').innerHTML = `Our sales desk will call <b>${Auth.formatMobile(v('mobile'))}</b> within 2 working hours (Mon–Sat, 10 am – 7 pm)${v('email') ? ` and email a copy to <b>${v('email')}</b>` : ''}.`; window.scrollTo({ top: 0, behavior: 'smooth' }); toast('Request sent.'); })
      .catch((ex) => { fail(ex.message); btn.disabled = false; btn.innerHTML = 'Send request ' + icon('i-arrow'); });
    return;
  }
  const list = load('spocart.enquiries', []);
  list.unshift({ ref, topic: v('topic'), name: v('name'), business: v('business'), mobile: v('mobile'), email: v('email'), city: v('city'), volume: v('volume'), message: v('message'), file: file?.name || null, at: new Date().toISOString() });
  save('spocart.enquiries', list);
  form.hidden = true;
  $('#enquiryDone').hidden = false;
  $('#doneText').innerHTML = `Reference <b>${ref}</b>. Our sales desk will call <b>${Auth.formatMobile(v('mobile'))}</b> within 2 working hours (Mon–Sat, 10 am – 7 pm)${v('email') ? ` and email a copy to <b>${v('email')}</b>` : ''}.`;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  toast('Request sent — reference ' + ref);
});
});
