# SCOTLAND ecommerce

Multi-page Next.js App Router ecommerce foundation based on `scot.md`.

## Run locally

1. Install Node 20+.
2. Copy `.env.example` to `.env.local` and add Supabase/Razorpay credentials when ready.
3. Run `npm install`, then `npm run dev`.
4. Open `http://localhost:3000`.

## Included today

- Multi-page shop, collection, product details, cart, wishlist, checkout, account/orders, complete looks, AI style and admin screens.
- Persistent browser cart and wishlist.
- Catalog, category, product, recommendations, order and payment-order API route foundations.
- Admin product/category/order dashboard UI and product validation form.

## Production integration

The catalog is loaded from the configured database. Keep Supabase credentials and payment secrets server-side in `.env.local`.
Apply the Supabase migrations in order before using admin product editing, checkout, or customer accounts:

1. `supabase/migrations/0001_ecommerce.sql`
2. `supabase/migrations/0002_product_pricing_metadata.sql`
3. `supabase/migrations/0003_atomic_variant_inventory.sql`
4. `supabase/migrations/0004_customer_accounts.sql`

`0002` adds the product metadata required by the admin form, `0003` enables atomic stock deduction, and `0004` adds saved customer addresses, user-cart uniqueness/synchronization, order snapshots, profile policies, and customer-account indexes. Run each file in the Supabase SQL Editor for the same project used by the app. The migrations are additive and preserve existing profiles and orders.

## Customer accounts

- Supabase Auth owns password hashing and browser/server sessions. No password or password hash is stored in application tables.
- Registration, email verification, password reset, and Google OAuth use Supabase Auth. To require verified email, enable **Confirm email** in Supabase Authentication settings and configure an SMTP provider for production delivery.
- Add the local and production callback destinations to Supabase Authentication **URL Configuration** (for example `http://localhost:3000/**` and `https://your-domain.example/**`). Set `NEXT_PUBLIC_SITE_URL` to the public site origin in production.
- Google sign-in is optional and works only after enabling the Google provider and configuring its credentials/redirect URI in Supabase.
- Supabase Auth applies its configured authentication rate limits; configure production rate limits and CAPTCHA/bot protection in the Supabase dashboard to suit the deployment.
- Signed-in carts and wishlists are stored against the authenticated user in Postgres and merged with the browser's guest cart after login. Guest carts remain local to the browser until login; customer data is never selected by a client-supplied user ID.
- Checkout re-reads product and variant prices on the server and creates immutable purchase snapshots. Guest checkout remains available. Orders made while signed in are linked to that account.
- Cancellation/return/refund eligibility is not exposed to customers because the existing application has no defined customer-facing cancellation or return policy/action.

Required account environment values are the existing Supabase URL/publishable key/service-role key and `NEXT_PUBLIC_SITE_URL`. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. For Razorpay checkout, configure `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_ID`, and `RAZORPAY_KEY_SECRET`.
