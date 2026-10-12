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
Apply the Supabase migrations in order before using admin product editing or checkout. In particular, `supabase/migrations/0002_product_pricing_metadata.sql` adds the product metadata column required by the admin form, and `supabase/migrations/0003_atomic_variant_inventory.sql` enables safe stock deduction at checkout.
