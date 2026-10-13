/* ==========================================================================
   SPOCART Wholesale — site configuration
   Flip DEMO_MODE to false once the API is reachable: auth then calls the
   SPOCART API (same endpoints as the mobile app) instead of the local stub.
   ========================================================================== */
const CONFIG = {
  // false → talk to the deployed spocart-api backend (Render → Neon). true → browser-only demo with sample data.
  DEMO_MODE: false,
  // Always the deployed backend — no local backend / local Postgres needed.
  // (For a local backend during development, set to 'http://localhost:3000/api/v1'.)
  API_BASE_URL: 'https://spocart-api.onrender.com/api/v1',
  OTP_LENGTH: 6,
  OTP_RESEND_SECONDS: 45,
  SUPPORT: { phoneDisplay: '+91 70619 11575', phoneDial: '+917061911575', whatsapp: '917061911575', email: 'sales@spocart.in', hours: 'Mon–Sat, 10:00 am – 7:00 pm IST' },
  SOCIAL: { instagram: 'https://www.instagram.com/spocart.in', facebook: 'https://www.facebook.com/spocart.in', youtube: 'https://www.youtube.com/@spocart' },
  DEMO_ACCOUNT: { mobile: '9811122334' },
  // Mobile numbers allowed into the admin panel (demo mode). With the API,
  // /auth/otp/verify must return user.role === 'admin' instead.
  ADMIN_MOBILES: ['7061911575'],
};
