/* ==========================================================================
   SPOCART Wholesale — admin login (mobile + OTP, allow-listed numbers only)
   Standalone page: no customer header, so it mounts the icon sprite itself.
   ========================================================================== */
// Sign-in needs nothing from the catalogue, so it does not wait for it.
Promise.resolve().then(async () => {
if (Auth.isAdmin()) { location.replace('admin.html'); return; }

mountSprite();

// `password` is held only so Resend can ask for a new code — the server
// re-checks it every time. Cleared as soon as the sign-in finishes or the
// admin goes back a step, and never written to storage.
const state = { mobile: '', password: '', timer: null };
const toast = (msg) => { const el = $('#toast'); el.textContent = msg; el.classList.add('is-show'); clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('is-show'), 2400); };
const show = (id) => { $$('.auth__step').forEach((s) => { s.hidden = s.id !== id; }); $(`#${id} input`)?.focus(); };
const err = (id, msg) => { const el = $(`#${id}`); el.textContent = msg || ''; el.hidden = !msg; };

$('#mobile').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10); err('mobileError'); });
$('#password').addEventListener('input', () => err('mobileError'));
$('#stepMobile').addEventListener('submit', (e) => {
  e.preventDefault();
  sendOtp(Auth.normalise($('#mobile').value), $('#password').value);
});

async function sendOtp(m, password) {
  const btn = $('#sendOtp'); btn.disabled = true; btn.textContent = 'Checking…';
  try {
    const { demoOtp } = await Auth.sendAdminOtp(m, password);
    state.mobile = m;
    state.password = password;
    $('#otpTo').textContent = Auth.formatMobile(m);
    $('#demoOtp').hidden = !demoOtp;
    if (demoOtp) $('#demoOtpCode').textContent = demoOtp;
    boxes.forEach((b) => { b.value = ''; }); err('otpError');
    if (!demoOtp && /localhost|127\.0\.0\.1/.test(CONFIG.API_BASE_URL)) { $('#demoOtp').hidden = false; $('#demoOtp span').innerHTML = 'Local API with <code>SMS_DRIVER=console</code> — the OTP is printed in the API server terminal.'; }
    show('stepOtp'); startTimer();
  } catch (ex) { err('mobileError', ex.message); }
  finally { btn.disabled = false; btn.innerHTML = 'Continue <svg class="ic"><use href="#i-arrow"/></svg>'; }
}

const boxes = $$('#otpBoxes input');
boxes.forEach((box, i) => {
  box.addEventListener('input', (e) => {
    const v = e.target.value.replace(/\D/g, '');
    if (v.length > 1) { v.split('').slice(0, boxes.length - i).forEach((ch, k) => { boxes[i + k].value = ch; }); boxes[Math.min(i + v.length, boxes.length - 1)].focus(); }
    else { e.target.value = v; if (v && boxes[i + 1]) boxes[i + 1].focus(); }
    err('otpError');
    if (boxes.every((b) => b.value)) $('#stepOtp').requestSubmit();
  });
  box.addEventListener('keydown', (e) => { if (e.key === 'Backspace' && !box.value && boxes[i - 1]) boxes[i - 1].focus(); });
  box.addEventListener('paste', (e) => { const t = (e.clipboardData.getData('text') || '').replace(/\D/g, ''); if (t.length >= 4) { e.preventDefault(); boxes.forEach((b, k) => { b.value = t[k] || ''; }); if (t.length >= boxes.length) $('#stepOtp').requestSubmit(); } });
});
$('#changeMobile').addEventListener('click', () => {
  clearInterval(state.timer);
  state.password = '';
  $('#password').value = '';
  show('stepMobile');
});
$('#resendOtp').addEventListener('click', () => sendOtp(state.mobile, state.password));
function startTimer() {
  clearInterval(state.timer);
  let left = CONFIG.OTP_RESEND_SECONDS; const btn = $('#resendOtp'), t = $('#resendTimer');
  btn.disabled = true; t.textContent = `(${left}s)`;
  state.timer = setInterval(() => { left--; t.textContent = left > 0 ? `(${left}s)` : ''; if (left <= 0) { clearInterval(state.timer); btn.disabled = false; } }, 1000);
}

$('#stepOtp').addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = boxes.map((b) => b.value).join('');
  if (code.length !== CONFIG.OTP_LENGTH) { err('otpError', 'Enter all 6 digits.'); return; }
  const btn = $('#verifyOtp'); btn.disabled = true; btn.textContent = 'Verifying…';
  try {
    await Auth.verifyAdminOtp(state.mobile, code);
    state.password = '';
    $('#password').value = '';
    toast('Welcome, admin.');
    location.href = 'admin.html';
  }
  catch (ex) { err('otpError', ex.message); boxes.forEach((b) => { b.value = ''; }); boxes[0].focus(); btn.disabled = false; btn.textContent = 'Verify & open admin panel'; }
});
});
