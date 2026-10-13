# SPOCART — full-stack audit (19 Sep 2026)

Structure adopted (matches what is on disk):

```
website_spocart/
├── frontend/             static site (HTML + CSS + vanilla JS)      → served from any static host
└── backend/spocart-api/  Node 20 · Express 5 · Prisma 6 · PostgreSQL  → Render (https://spocart-api.onrender.com), DB on Neon
```

Architecture in place: **Frontend → REST (/api/v1) → Express → Prisma → Neon PostgreSQL**.
Auth is mobile + OTP → JWT (Bearer). Payments: Razorpay orders + signature verify + webhook + reconcile job. Prices, MOQ, stock, credit and totals are computed **server-side only**.

## Backend (spocart-api) — state before this pass

| Area | Status |
|---|---|
| Auth (`/auth/otp/send`, `/otp/verify`, `/me`, `PUT /profile`, `/logout-all`) | ✅ complete, JWT with token version |
| Catalog (`/catalog/categories`, `/products`, `/products/:id`) | ✅ complete, cached 5 min |
| Addresses CRUD + default | ✅ |
| Orders (`POST`, `GET`, `GET /:id`, `payments/verify`, `retry-payment`) | ✅ server-authoritative pricing (tiers), MOQ, inStock, **size required when product has sizes**, credit limit, Razorpay |
| Invoices / dashboard / devices | ✅ |
| Quotes (`GET`, `POST` public+auth, `POST /:id/accept` → paymentPending order) | ✅ |
| Leads (`POST /leads`) | ✅ |
| Notifications (`GET`, `read`, `read-all`, `DELETE`) | ✅ |
| Team | ✅ (used by the mobile app only) |
| Uploads (`POST /uploads/design`, auth) | ✅ local disk — **ephemeral on Render** (see risks) |
| Webhooks (Razorpay) + expire-unpaid cron + reconcile | ✅ |
| Admin: orders status/cancel/reconcile, invoice settle, refunds, quotes respond/decline, leads, users + credit, products upsert, stock, categories, broadcast | ✅ |
| Admin: **database console** `/admin/db/*` (all 12 tables, guarded deletes) | ✅ added 19 Sep |
| Admin: catalogue image upload | ❌ missing → **added** `POST /admin/uploads/catalog` |
| Models | User, BusinessProfile, Address, TeamMember, Category, Product, ProductTier, Order, OrderItem, OrderStatusHistory, Payment, Quote, QuoteItem, Lead, Notification, DeviceToken, OtpCode — relations/cascades/enums verified. No cart table (cart is client-side by design; the API validates every line at order time). No coupon / wishlist / review models. |

## Frontend feature map (API mode, `DEMO_MODE=false`)

| Feature | API | Status before | Action |
|---|---|---|---|
| Home catalogue, categories, price-check | `GET /catalog/*` | ✅ connected | — |
| Home coupon card (BULK5) | none | ❌ UI only, no backend | hidden in API mode |
| Catalog listing/filters/brand groups | `GET /catalog/products` | ✅ | — |
| Catalog BOQ upload | `/uploads/design` + `/quotes` | ❌ toast only | **connected** (login required) |
| Product size selection | order lines need `size` | ❌ missing → orders for 13/36 products would fail | **implemented** in card, cart, drawer, price-check, reorder |
| Cart (local) → Place order | `POST /orders` | ✅ Razorpay / pay-later | + sizes |
| Orders list, Pay now, invoice print | `GET /orders`, `retry-payment` | ✅ | — |
| Customer cancel | no route (admin only) | hidden | — |
| Account profile | `PUT /auth/profile` | ✅ | PAN removed (no backend field); full businessType select |
| Account addresses | `/addresses` | ✅ | — |
| Account quote requests | `POST /quotes` | ⚠️ submit only | + list `GET /quotes`, **Accept & pay** for quoted |
| Account notifications | `/notifications` | ❌ missing | **added** (list, mark read, unread badge) |
| Login / signup | `/auth/*` | ✅ | signup businessType select, PAN removed |
| Enquiries, footer callback | `POST /leads` | ✅ | — |
| Notify-me on out-of-stock | none | ❌ local only | → `POST /leads` (admin sees it under Enquiries) |
| Admin orders / enquiries / products / customers / database | `/admin/*` | ✅ | + image upload, broadcast; stock-alerts view hidden in API mode |
| Sample-data fallback when API down | — | ⚠️ showed fake products | now shows an error banner and empty catalogue |

## Risks / follow-ups (not code)
- **Uploads on Render use local disk** — files vanish on redeploy. Move `uploads/` to S3/R2/Cloudinary before relying on admin image uploads in production.
- Render env must include the website origin in `CORS_ORIGINS` and the public URL in `PUBLIC_BASE_URL`.
- `SMS_DRIVER=msg91` + keys needed in production for real OTP SMS.
- Razorpay webhook URL must be registered in the Razorpay dashboard for capture confirmation.
