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

The current catalog is intentionally dummy data in `lib/products.ts`, so the site works immediately. Move it to Supabase tables from `scot.md`, then add Supabase Auth middleware/RLS, Storage uploads and the Razorpay SDK/webhook before accepting live payments. Razorpay secrets must remain server-only in `.env.local`.
