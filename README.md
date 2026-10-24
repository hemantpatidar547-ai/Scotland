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
5. `supabase/migrations/0005_product_slug_redirects.sql`
6. `supabase/migrations/0006_product_image_storage.sql`
7. `supabase/migrations/0007_homepage_showcase.sql`
8. `supabase/migrations/0008_generalize_homepage_showcase.sql`
9. `supabase/migrations/0009_product_image_storage_limit.sql`

`0002` adds the product metadata required by the admin form, `0003` enables atomic stock deduction, and `0004` adds saved customer addresses, user-cart uniqueness/synchronization, order snapshots, profile policies, and customer-account indexes. Run each file in the Supabase SQL Editor for the same project used by the app. The migrations are additive and preserve existing profiles and orders.

`0005` adds product/category slug history for permanent redirects when an administrator changes a public slug. This migration is not run by the app or deployment; apply it manually in Supabase after reviewing it. Until applied, old slugs cannot redirect.

`0006` creates the public `scotland-product-images` Storage bucket used for product uploads. Apply it before deploying the updated admin image uploader. The bucket serves public product images; uploads remain server-side and require the authenticated admin session and service-role key.

`0007` adds editable homepage showcase content to the existing store settings. Apply it before using **Admin → Homepage Content** to update the launch message, show/hide the showcase, and add/edit/remove showcase cards and images. Image uploads use the existing public product image bucket, and the default storefront content remains available until the migration is applied.

`0008` replaces the earlier Italian-specific homepage showcase heading and description in saved store settings with copy suitable for a wider product collection. Apply it after `0007`; administrators can continue to edit all homepage showcase text and images in **Admin → Homepage Content**.

`0009` ensures the public `scotland-product-images` bucket exists and allows image uploads up to 10 MB. Apply it in the Supabase SQL Editor after the earlier migrations. The Supabase project-level Storage file size limit must also be at least 10 MB.

Existing product, variant, category, and size-chart images stored as base64 data URLs must be copied to Storage to reduce page/API payload sizes and make product images eligible for the Merchant Center feed. Back up the project, apply migration `0006`, then run from the project directory:

```powershell
node scripts/migrate-embedded-images.mjs
node scripts/migrate-embedded-images.mjs --apply
```

The first command is a read-only dry run. Review the reported counts before the `--apply` run. The script is rerunnable and updates database image references only after each file is uploaded. It stops on the first invalid image or database/storage error; resolve the error and rerun. Do not make product/category image edits while the apply run is in progress.

## SEO and Google product discovery

- **Set the production URL first.** In Vercel, set `NEXT_PUBLIC_SITE_URL` to the exact public HTTPS domain serving the shop, then redeploy. Sitemap URLs, canonicals, product links, and the feed all use this origin.
- **Publish complete products.** In **Admin → Products**, save each item as **Published** and provide a unique slug, accurate product name and description, price, brand, category, image alt text, and a real product image. Add GTIN/MPN only when those identifiers were actually assigned. Review the editable SEO title, meta description, canonical URL, and indexing setting. Leave **no_index** unchecked for products you want search engines to consider. Categories are managed in **Admin → Categories**; assign a product to a category using the same category name.
- **Use supported image storage.** Apply `0009_product_image_storage_limit.sql` before using the Storage uploader, then follow the dry-run and `--apply` image conversion steps above for existing base64 images. New uploads must be JPEG, PNG, WebP, AVIF, or GIF and no larger than 10 MB. The Supabase project-level Storage file size limit must be at least 10 MB. Publicly accessible image URLs are required for Google product feeds.
- **Check the deployment itself.** After deploying, open `https://your-domain.example/robots.txt` and `https://your-domain.example/sitemap.xml`; both must return successfully. The sitemap includes published, indexable products with a blank canonical or one matching that product’s canonical URL. Active category URLs are included once the category has at least three indexable published products. Confirm a product URL opens without login and shows the saved price, stock, and image. Use the SEO Center for missing product fields and feed validation warnings.
- **Submit to Google Search Console.** Verify ownership of the production domain, submit `https://your-domain.example/sitemap.xml`, and use URL Inspection to request crawling of important product URLs. A successful submission or request does not mean Google has indexed or ranked the page. Search Console metrics are not connected to this app; the dashboard correctly reports them as **Pending** rather than inventing results.
- **Optional Merchant Center feed.** Add `https://your-domain.example/api/google/merchant-feed.xml` as a scheduled feed in Merchant Center. The feed contains currently published, indexable products that pass local checks for title, description, brand, a public image URL, and positive price. Confirm currency, shipping, tax, landing-page details, and policy requirements in Merchant Center, then review its diagnostics. A locally eligible feed item is not proof of Google approval or Shopping placement.
- **Understand recommendations.** The shop’s own “You may also like” section ranks published products by matching category, subcategory, tags, gender, and availability. Recent published products are surfaced in the homepage arrival section. These are on-site catalog recommendations, not Google recommendations; they do not guarantee that Google will show a product in search, recommendations, or Shopping.
- Product JSON-LD describes the visible product, variants, price, currency, and stock. Genuine rating data is emitted only when rating and review count are both present; no reviews, ratings, discounts, or availability are fabricated. Validate a live product URL with Google’s Rich Results Test after deployment.
- Optional GA4 uses `NEXT_PUBLIC_GA_MEASUREMENT_ID`. Events for product/list views, add-to-cart, checkout initiation, and completed orders are sent only after explicit analytics consent. No name, email, address, or payment details are sent. The visitor can reject or change consent using the on-page privacy settings.
- Technical SEO improvements and Google setup help make accurate product pages discoverable, but do not guarantee crawling, indexing, recommendations, rankings, Merchant Center approval, or Shopping placement. Google controls these decisions based on its systems, policies, relevance, competition, and other factors.
- Optional GA4 uses `NEXT_PUBLIC_GA_MEASUREMENT_ID`. Events for product/list views, add-to-cart, checkout initiation, and completed orders are sent only after explicit analytics consent. No name, email, address, or payment details are sent. The visitor can reject or change consent using the on-page privacy settings.
- SEO checks and technical improvements do not guarantee indexing, rankings, recommendations, Merchant Center approval, or Shopping placement. Google controls crawling, policy review, and placement.

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
