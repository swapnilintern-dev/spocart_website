# SPOCART Wholesale — website

Static B2B storefront for SPOCART (shops, schools, academies). No build step:
serve the folder with any static host (Netlify, Vercel, GitHub Pages, S3, nginx).

## Pages

| Page | What it does |
|---|---|
| `index.html` | Home: hero, instant price check, buyer segments, categories, bulk deals, services, testimonials, coupon |
| `catalog.html` | Bulk catalog: products grouped by brand (31 brands), buyer-type pricing, category/slab/brand/stock filters, sort, list/grid, slab table, BOQ upload, sticky cart bar. Deep links: `?cat=…&brand=…&buyer=…&q=…&group=none` |
| `cart.html` | Cart & checkout: next-slab hints, coupons (`BULK5`, `SCHOOL10`), address, payment (UPI / NEFT / pay-later within credit limit), place order (login required) |
| `orders.html` | My orders (login required): status tabs, progress bar, pay now / track / reorder / cancel, printable GST invoice |
| `account.html` | My account (login required): profile edit, recent orders, quotes, multiple addresses, business & GST, buyer type, credit, payments, support |
| `login.html` / `signup.html` | Mobile number + OTP. Signup collects name, business, buyer type, email, GSTIN/PAN and delivery address |
| `partner.html` | Enquiries: bulk quote, school kit program, tender support, become a partner, services, order support (`?topic=…`) |
| `policies.html` | Terms, shipping, returns & warranty, GST & billing, privacy |
| `404.html` | Not-found page (picked up automatically by Netlify / GitHub Pages) |
| `admin-login.html` | Staff login: mobile + OTP, restricted to `CONFIG.ADMIN_MOBILES` (demo) or `user.role === 'admin'` from the API. Reached from the shield icon in the top bar and footer |
| `admin.html` | Admin panel: overview & to-do, orders (advance status, tracking, mark paid, cancel, CSV export), enquiries (handled/reopen, WhatsApp/call), products (full editor: name, brand incl. new brands, category, unit, MOQ, MRP, slab quantities & prices, stock, description, image upload/URL, buyer types, deal flag, hide; add / remove / delete / reset-to-default; quick inline stock & price edits — all visible to customers immediately), customers, back-in-stock requests |

## Code

```
css/styles.css     brand tokens (mirrors the Flutter app's app_tokens.dart) + all page styles
js/config.js       DEMO_MODE, API base URL, support contacts, social links
js/data.js         brands, categories, products (slab prices), buyer types, helpers
js/auth.js         OTP login/registration, session, requireAuth(); admin OTP + requireAdmin()
js/icons.js        shared SVG icon sprite
js/layout.js       shared header/footer/cart drawer/mobile menu injected on every page;
                   cart, quotes, buyer type, order creation, sign-out
js/home.js, catalog.js, cart.js, orders.js, orders-data.js, account.js,
js/auth-pages.js, partner.js, admin-login.js, admin.js      page behaviour
assets/            brand logos + photos shared with the Flutter app
robots.txt, sitemap.xml
```

## Backend (spocart-api)

The site is wired to the Node/Express + Prisma backend in `../backend/spocart-api`
through [js/api.js](js/api.js). `js/config.js` picks the base URL automatically:

| Site served from | API used |
|---|---|
| `localhost` / `127.0.0.1` | `http://localhost:3000/api/v1` (local `npm run dev`) |
| anywhere else | `https://spocart-api.onrender.com/api/v1` |

Set `DEMO_MODE: true` in `js/config.js` to fall back to the browser-only sample data.
If the API cannot be reached the site shows a yellow banner and the sample catalogue.

### Run locally

```bash
# 1. backend (Postgres must be running; .env has DATABASE_URL)
cd ../backend/spocart-api && npm run dev          # http://localhost:3000

# 2. website
python3 -m http.server 8765   # from the frontend/ folder
```

With `SMS_DRIVER=console` the OTP is printed in the backend terminal
(`[SMS → +91…] OTP 123456`). Admin numbers come from `ADMIN_MOBILES` in the
backend `.env` (currently 8797048355).

### What talks to what

| Website | Backend route |
|---|---|
| Login / signup | `POST /auth/otp/send`, `POST /auth/otp/verify`, `PUT /auth/profile`, `POST /addresses` |
| Catalog, home, price check | `GET /catalog/categories`, `GET /catalog/products` |
| Cart → Place order | `POST /orders` → Razorpay checkout → `POST /orders/payments/verify` (pay-later confirms directly) |
| Orders page, Pay now | `GET /orders`, `POST /orders/:id/retry-payment` |
| Account | `GET/POST/PUT/DELETE /addresses`, `POST /addresses/:id/default`, `PUT /auth/profile`, `GET/POST /quotes`, `POST /quotes/:id/accept`, `GET /notifications` (+ read) |
| Catalog BOQ upload | `POST /uploads/design` → `POST /quotes` (kind `csv`) |
| Product sizes | order lines carry `size` for products with `sizes` (cart keys are `productId#size`) |
| Talk to sales, footer callback | `POST /leads` |
| Admin | `GET /admin/orders`, `POST /admin/orders/:id/status`, `/cancel`, `/reconcile`, `POST /admin/invoices/:id/settle`, `GET /admin/leads`, `GET /admin/quotes` (+ respond / decline), `GET /admin/users`, `POST /admin/users/:id/credit`, `POST/PUT /admin/products` |
| Admin → Database | `GET /admin/db` (table metadata), `GET/POST /admin/db/:table`, `GET/PUT/DELETE /admin/db/:table/:id`, `GET /admin/db/_meta/stats` — full CRUD over categories, products (with tiers), users (+ profile), addresses, orders, payments, quotes, leads, notifications, team, device tokens, OTP codes |

Backend facts the UI adapts to: products have tiers (any number) but **no MRP**
(cards hide strike-through prices), stock is a boolean `inStock`, profiles
**require a GSTIN**, orders need a saved address, products with `sizes` need a
size per line, and customers cannot cancel orders themselves (admins can).
Coupons, buyer-type price multipliers and PAN exist only in demo mode (no backend).

### Deploying

1. Backend: set `CORS_ORIGINS` to include the website origin(s) and
   `PUBLIC_BASE_URL` to the API's public URL (the local `.env` now has
   `http://localhost:8765` and `http://localhost:3000` for development).
2. Website: upload this folder to any static host; if the API is not on
   `spocart-api.onrender.com`, change `API_BASE_URL` in `js/config.js`.
3. Razorpay: the site loads `checkout.razorpay.com/v1/checkout.js`; live keys
   are configured only on the backend.
