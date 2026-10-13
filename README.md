# SPOCART — full-stack project

```
website_spocart/
├── frontend/             Static website (HTML + CSS + vanilla JS). Any static host.
├── backend/spocart-api/  Node 20 · Express 5 · Prisma 6 → PostgreSQL. Deployed on Render.
└── AUDIT.md              Feature-by-feature audit and gap analysis (19 Sep 2026)
```

Architecture: **Frontend → REST `/api/v1` → Express (Render) → Prisma → Neon PostgreSQL**

## Run locally

```bash
# backend — uses backend/spocart-api/.env (local Postgres). Never point .env at Neon for dev.
cd backend/spocart-api && npm install && npm run dev        # http://localhost:3000
```
```bash
# frontend
cd frontend && python3 -m http.server 8765                 # http://localhost:8765
```

OTPs print in the backend terminal while `SMS_DRIVER=console`. Admin numbers: `ADMIN_MOBILES` in the backend env.
Backend tests: `cd backend/spocart-api && npm test`.

## Deploy
- **Backend (Render)**: env from `.env.production` (Neon `DATABASE_URL`, JWT, Razorpay, MSG91). Set
  `CORS_ORIGINS` to the website origin(s) and `PUBLIC_BASE_URL` to the API's public URL.
  Migrations: `npm run deploy` (`prisma migrate deploy`) — never `migrate reset` against Neon.
- **Frontend**: upload `frontend/` to the static host. `frontend/js/config.js` uses
  `https://spocart-api.onrender.com/api/v1` automatically when not on localhost.

See `frontend/README.md` (pages, API map) and `backend/spocart-api/README.md` (endpoints, admin DB console).
# spocart_website
