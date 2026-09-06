Build a complete, functional, modern and lightweight ecommerce website for my Scottish-inspired clothing brand.

Temporary brand name:
NORTH & LOCH

Important brand positioning:
- This is a modern Scottish-inspired fashion brand.
- Use “Inspired by Scotland” in the website content.
- Do not claim “Made in Scotland” unless I manually change the text later.
- The brand should feel premium, modern, clean, international and trustworthy.
- Do not make the design look old-fashioned, crowded or like a costume/kilt-only store.
- Use subtle Scottish heritage through small tartan details, Highland landscape inspiration and refined colors.

==================================================
TECHNOLOGY STACK
==================================================

Frontend:
- Next.js with React
- TypeScript
- Tailwind CSS
- Mobile-first responsive design
- Reusable React components

Backend:
- Next.js App Router
- Next.js Route Handlers for API endpoints
- Server Actions where appropriate
- Keep business logic on the server
- Never expose private keys in frontend code

Database:
- Supabase PostgreSQL

Authentication:
- Supabase Auth
- Email and password signup
- Login
- Logout
- Forgot password
- Reset password
- Protected user account pages
- Protected admin dashboard

File storage:
- Supabase Storage
- Product images bucket
- Category images bucket
- User upload bucket
- AI try-on result bucket
- Use secure access policies for private files

Hosting:
- Make the project deployable on Vercel
- Keep environment variables configurable
- Create a clear README file explaining setup and deployment

Payments:
- Prepare secure Razorpay integration
- Create server-side payment order
- Verify payment signature on server
- Add Razorpay webhook endpoint
- Handle payment success, failure and pending states
- Handle refunds
- Never store card details
- Never expose Razorpay secret key to the browser

AI recommendation:
- Keep AI outfit recommendation as a separate server-side API module
- Create an endpoint named /api/recommendations
- Match recommended products with the store catalog
- Keep AI API keys in server-side environment variables
- Do not expose AI provider keys in frontend code

==================================================
DESIGN SYSTEM
==================================================

Design style:
- Modern
- Premium
- Minimal
- Lightweight
- Fast-loading
- Mobile-first
- Clean product-focused layout
- Plenty of whitespace
- Elegant but simple
- Smooth and limited animations
- No heavy 3D effects
- No autoplay background videos
- No unnecessary popups
- No cluttered layout
- No excessive gradients
- No excessive shadows

Color palette:
- Deep navy: #0F1B2D
- Charcoal black: #181818
- Warm cream: #F7F3EC
- Stone grey: #D9D6CE
- Muted Highland red: #8F3030
- Soft gold: #B89B5E

Typography:
- Use one elegant serif font for headings.
- Use one clean modern sans-serif font for body text.
- Keep text readable on mobile.
- Use clear font hierarchy.
- Do not use more than two font families.

Logo:
- Create a simple text-based logo for NORTH & LOCH.
- Use a minimal mountain, loch or abstract Highland mark if appropriate.
- Keep the logo easy to replace later.

==================================================
CUSTOMER WEBSITE PAGES
==================================================

Create these public pages:

1. Home
2. Shop All
3. Men
4. Women
5. Unisex
6. New Arrivals
7. Clothing
8. Shoes
9. Watches
10. Belts
11. Bags and Accessories
12. Scottish Heritage Collection
13. Complete Looks
14. AI Outfit Recommendation
15. Product Details
16. Cart
17. Checkout
18. Wishlist
19. Login
20. Signup
21. Forgot Password
22. My Account
23. My Orders
24. Order Details
25. Order Tracking
26. About the Brand
27. Size Guide
28. Shipping and Delivery
29. Returns and Exchanges
30. Contact
31. Privacy Policy
32. Terms and Conditions

==================================================
HOME PAGE
==================================================

Create a premium lightweight homepage containing:

- Slim announcement bar:
  “Free shipping on orders above [amount]”
- Header with:
  - Brand logo
  - Shop
  - Collections
  - Complete Looks
  - AI Style
  - About
  - Search icon
  - Account icon
  - Wishlist icon
  - Cart icon
- Hero section with one optimized fashion image
- Hero heading:
  “Modern Clothing, Rooted in Scotland.”
- Hero description:
  “Refined everyday pieces, distinctive layers and complete looks inspired by Scottish character.”
- Buttons:
  - Shop New Arrivals
  - Explore Complete Looks
- New Arrivals section
- Featured Categories section
- Complete Looks section
- Scottish Heritage Collection section
- AI Outfit Recommendation section
- Best Sellers section
- Customer reviews section
- Newsletter signup
- Instagram/social media section
- Footer

Homepage should not be overloaded. Keep it fast, spacious and visually clean.

==================================================
PRODUCT CATEGORIES
==================================================

Create the following main categories:

1. Clothing
2. Shoes
3. Watches
4. Belts
5. Bags
6. Accessories
7. Complete Looks
8. New Arrivals
9. Sale

Clothing subcategories:
- T-shirts
- Shirts
- Overshirts
- Sweaters
- Hoodies
- Jackets
- Coats
- Trousers
- Jeans
- Dresses
- Skirts
- Shorts
- Traditional-inspired pieces

Shoes subcategories:
- Sneakers
- Boots
- Loafers
- Formal shoes
- Casual shoes
- Sandals

Watch subcategories:
- Classic watches
- Minimal watches
- Leather strap watches
- Metal strap watches
- Smart casual watches

Belts subcategories:
- Leather belts
- Casual belts
- Formal belts
- Tartan-inspired belts

Accessories subcategories:
- Scarves
- Caps
- Hats
- Wallets
- Jewellery
- Sunglasses
- Bags
- Socks

Each category must have:
- Category name
- Slug
- Description
- Category image
- Parent category
- Active/inactive status
- Display order
- SEO title
- SEO description

==================================================
PRODUCT SYSTEM
==================================================

Create a complete product management system.

Each product must support:

- Product name
- Product slug
- Product description
- Short description
- Main category
- Subcategory
- Brand name
- Product type
- Gender
- Collection
- Occasion
- Season
- Style
- Material
- Care instructions
- Country of inspiration
- Price
- Sale price
- Cost price, visible only to admin
- Tax percentage
- SKU
- Barcode, optional
- Product status
- Featured product status
- New arrival status
- Best seller status
- Sale status
- Product images
- Product video, optional
- Color options
- Size options
- Product variants
- Stock quantity
- Low-stock threshold
- Weight
- Shipping information
- Return eligibility
- Average rating
- Review count
- Created date
- Updated date

Product statuses:
- Draft
- Active
- Out of stock
- Archived

Product variant fields:
- Variant ID
- Product ID
- SKU
- Color
- Size
- Price
- Sale price
- Stock quantity
- Reserved quantity
- Available quantity
- Image
- Active status

Product card must show:
- Product image
- Product name
- Short subtitle
- Price
- Sale price
- Discount percentage
- Color options
- Rating
- Wishlist button
- Quick Add button
- Complete the look label if applicable
- Stock status

==================================================
CUSTOMER PRODUCT EXPERIENCE
==================================================

Product listing must include:

- Search products
- Filter by category
- Filter by subcategory
- Filter by price
- Filter by size
- Filter by color
- Filter by gender
- Filter by occasion
- Filter by season
- Filter by material
- Filter by style
- Filter by rating
- Filter in-stock products only
- Sort by newest
- Sort by price low to high
- Sort by price high to low
- Sort by popularity
- Sort by rating
- Sort by best sellers

Product details page must include:

- Product image gallery
- Mobile swipe gallery
- Product title
- Product price
- Sale price
- Discount percentage
- Product description
- Material
- Care instructions
- Size selector
- Color selector
- Size guide link
- Stock status
- Quantity selector
- Add to Cart button
- Buy Now button
- Wishlist button
- Delivery estimate
- Shipping information
- Return and exchange information
- Product reviews
- Related products
- Recently viewed products
- “Style it with” products
- “Complete the look” products
- Sticky Add to Cart button on mobile

==================================================
COMPLETE LOOKS SYSTEM
==================================================

Create a complete outfit bundle system.

A complete look can include:

- Shirt or top
- Trousers or bottom
- Shoes
- Watch
- Belt
- Bag
- Scarf
- Other accessory

Each complete look must have:

- Look name
- Look description
- Look image
- Occasion
- Season
- Style
- Total price
- Discounted bundle price
- Individual product list
- Product replacement option
- Add complete look to cart button
- Save look button
- Share look button
- Similar look suggestions

Allow the customer to:

- Add the complete outfit to cart.
- Remove one product.
- Replace one product.
- Select a different size.
- Select a different color.
- See updated total price.
- See unavailable product alternatives.

==================================================
AI OUTFIT RECOMMENDATION
==================================================

Create an AI Outfit Recommendation page connected to the product catalog.

User inputs:
- Upload photo
- Select gender or preferred clothing category
- Select occasion
- Select country or culture
- Select weather
- Select season
- Select budget
- Select preferred colors
- Select disliked colors
- Select style preference
- Select modesty preference
- Select clothing size

AI output:
- Recommended complete looks
- Recommended individual products
- Matching colors
- Occasion explanation
- Styling explanation
- Similar alternatives
- Product prices
- Stock availability
- Add complete look to cart button
- Try This Look button
- Shop This Look button

Create this API endpoint:

POST /api/recommendations

The endpoint should accept:
- User preferences
- Occasion
- Weather
- Budget
- Style
- Product catalog data

The endpoint should return:
- Recommended outfit
- Product IDs
- Reason for recommendation
- Alternative product IDs
- Total price

Keep the AI provider integration separate and secure.

==================================================
CART AND WISHLIST
==================================================

Cart features:
- Add product
- Add complete look
- Change quantity
- Change size
- Change color
- Remove product
- Save for later
- Apply coupon
- Calculate subtotal
- Calculate discount
- Calculate tax
- Calculate shipping
- Calculate final total
- Show unavailable items
- Show low-stock warning

Wishlist features:
- Add product to wishlist
- Remove product
- Move product to cart
- Show price changes
- Show stock status
- Show similar products

==================================================
CHECKOUT AND PAYMENT
==================================================

Create a clean checkout page with:

- Guest checkout
- User checkout
- Contact information
- Shipping address
- Billing address
- Delivery method
- Coupon code
- Order summary
- Product images
- Size and color details
- Quantity
- Subtotal
- Discount
- Tax
- Shipping fee
- Final total
- Cash on Delivery option
- Online payment option

Prepare Razorpay integration with these server-side routes:

POST /api/payments/create-order
POST /api/payments/verify
POST /api/payments/webhook
POST /api/payments/refund

Payment states:
- Pending
- Authorized
- Captured
- Failed
- Refunded
- Partially refunded
- Cancelled

Important security requirements:
- Never expose Razorpay secret key on frontend.
- Verify payment signature on server.
- Verify webhook signature.
- Prevent duplicate order creation.
- Use idempotency for webhook processing.
- Update order status only after verified payment.
- Save payment ID and gateway order ID.
- Do not store card information.

Use Razorpay webhook events for server-side payment status confirmation. Razorpay recommends server verification and webhooks so the order status remains correct even if the customer closes the browser after payment. [web:451][web:405]

==================================================
CUSTOMER ACCOUNT
==================================================

Create customer account features:

- Signup
- Login
- Logout
- Forgot password
- Reset password
- Profile details
- Phone number
- Saved addresses
- Wishlist
- My orders
- Order details
- Order tracking
- Return request
- Exchange request
- Saved style preferences
- Saved AI recommendations

==================================================
ADMIN DASHBOARD
==================================================

Create a secure admin dashboard at:

/admin

Only users with admin role can access this area.

Create these admin pages:

1. Admin Dashboard
2. Products
3. Add Product
4. Edit Product
5. Categories
6. Add Category
7. Edit Category
8. Product Variants
9. Inventory
10. Orders
11. Order Details
12. Customers
13. Reviews
14. Coupons
15. Complete Looks
16. Homepage Sections
17. Banners
18. AI Recommendations
19. Payments
20. Refunds
21. Shipping Settings
22. Tax Settings
23. Store Settings
24. Admin Users
25. Activity Logs
26. Analytics

Admin dashboard overview must show:

- Total sales
- Total orders
- Pending orders
- Paid orders
- Shipped orders
- Delivered orders
- Cancelled orders
- Refund requests
- Total customers
- Low-stock products
- Out-of-stock products
- Best-selling products
- Recent orders
- Revenue chart

==================================================
ADMIN PRODUCT MANAGEMENT
==================================================

Admin must be able to:

- Add a new product.
- Edit an existing product.
- Delete or archive a product.
- Upload multiple product images.
- Select main product image.
- Add product video optionally.
- Select category.
- Select subcategory.
- Select collection.
- Select gender.
- Select occasion.
- Select season.
- Select style.
- Add material and care instructions.
- Add price.
- Add sale price.
- Add tax.
- Add SKU.
- Add colors.
- Add sizes.
- Create product variants.
- Add stock for every variant.
- Set low-stock threshold.
- Mark product as featured.
- Mark product as new arrival.
- Mark product as best seller.
- Publish or save as draft.
- Preview product before publishing.

Create a clear Add Product form with sections:

1. Basic Information
2. Product Description
3. Category and Collection
4. Pricing
5. Images
6. Colors and Sizes
7. Variants
8. Inventory
9. Shipping
10. SEO
11. Publish Settings

Add validation:
- Product name required.
- Category required.
- Price must be positive.
- SKU must be unique.
- At least one image required.
- At least one variant required when size/color applies.
- Stock cannot be negative.

==================================================
ADMIN CATEGORY MANAGEMENT
==================================================

Admin must be able to:

- Add category.
- Edit category.
- Delete category.
- Archive category.
- Add subcategory.
- Reorder categories.
- Upload category image.
- Add category description.
- Add SEO title.
- Add SEO description.
- Set category active/inactive.
- View total products in each category.

Category form fields:

- Category name
- Slug
- Description
- Parent category
- Category image
- Display order
- Active status
- SEO title
- SEO description

Example categories:
- Clothing
- Shoes
- Watches
- Belts
- Bags
- Accessories
- Complete Looks
- New Arrivals
- Sale

==================================================
ADMIN INVENTORY MANAGEMENT
==================================================

Admin must be able to:

- View all stock.
- Search by product name or SKU.
- Filter low stock.
- Filter out of stock.
- Add stock.
- Remove stock.
- Adjust stock manually.
- View stock history.
- Manage stock per size and color.
- Set low-stock alert threshold.
- See reserved stock.
- See available stock.

Stock calculation:
available stock = total stock - reserved stock

Prevent customers from purchasing unavailable variants.

==================================================
ADMIN ORDER MANAGEMENT
==================================================

Admin must be able to:

- View all orders.
- Search by order number.
- Filter by order status.
- Filter by payment status.
- Filter by date.
- Open order details.
- View customer details.
- View ordered products.
- View size and color.
- View shipping address.
- Update order status.
- Add tracking number.
- Add courier name.
- Mark order as packed.
- Mark order as shipped.
- Mark order as delivered.
- Cancel order.
- Approve return.
- Approve exchange.
- Approve refund.

Order statuses:
- Pending payment
- Paid
- Processing
- Packed
- Shipped
- Delivered
- Cancelled
- Return requested
- Returned
- Refund requested
- Refunded

==================================================
ADMIN COUPON MANAGEMENT
==================================================

Admin must be able to create coupons with:

- Coupon code
- Discount type
- Percentage discount
- Fixed amount discount
- Minimum order value
- Maximum discount
- Start date
- Expiry date
- Usage limit
- Per-user usage limit
- Selected categories
- Selected products
- Active/inactive status

==================================================
ADMIN COMPLETE LOOK MANAGEMENT
==================================================

Admin must be able to:

- Create complete look.
- Add name and description.
- Upload look image.
- Select products.
- Select product variants.
- Set occasion.
- Set season.
- Set style.
- Set bundle price.
- Set discount.
- Publish or save draft.
- Edit look.
- Archive look.

==================================================
ADMIN HOMEPAGE MANAGEMENT
==================================================

Admin must be able to manage homepage content without editing code:

- Announcement bar text.
- Hero heading.
- Hero description.
- Hero image.
- Hero buttons.
- Featured categories.
- New arrivals.
- Best sellers.
- Complete looks.
- Scottish heritage section.
- AI recommendation section.
- Newsletter section.
- Footer links.

Allow admin to:
- Enable or disable a section.
- Change display order.
- Upload images.
- Edit text.
- Add button links.
- Preview homepage before publishing.

==================================================
ADMIN ROLES AND SECURITY
==================================================

Create these roles:

1. Customer
- Can view products.
- Can manage own cart.
- Can manage own wishlist.
- Can view own orders.
- Cannot access admin dashboard.

2. Admin
- Can manage products.
- Can manage categories.
- Can manage inventory.
- Can manage orders.
- Can manage coupons.
- Can manage complete looks.
- Can manage homepage content.

3. Super Admin
- All admin permissions.
- Can manage admin users.
- Can manage store settings.
- Can view activity logs.
- Can remove admins.

Use Supabase Row Level Security policies so customers can only access their own user data, carts, wishlists and orders. Admin access must be verified server-side, not only hidden in the UI. [web:450][web:452]

==================================================
DATABASE TABLES
==================================================

Create these Supabase PostgreSQL tables:

users:
- id
- email
- full_name
- phone
- role
- avatar_url
- created_at
- updated_at

categories:
- id
- name
- slug
- description
- parent_id
- image_url
- display_order
- is_active
- seo_title
- seo_description
- created_at
- updated_at

products:
- id
- name
- slug
- description
- short_description
- category_id
- collection
- gender
- occasion
- season
- style
- material
- care_instructions
- price
- sale_price
- cost_price
- tax_percentage
- sku
- status
- is_featured
- is_new_arrival
- is_best_seller
- is_on_sale
- average_rating
- review_count
- created_at
- updated_at

product_variants:
- id
- product_id
- sku
- color
- size
- price
- sale_price
- stock_quantity
- reserved_quantity
- image_url
- is_active
- created_at
- updated_at

product_images:
- id
- product_id
- image_url
- alt_text
- display_order
- is_primary
- created_at

carts:
- id
- user_id
- session_id
- created_at
- updated_at

cart_items:
- id
- cart_id
- product_id
- variant_id
- quantity
- price
- created_at
- updated_at

wishlists:
- id
- user_id
- product_id
- created_at

orders:
- id
- order_number
- user_id
- subtotal
- discount
- tax
- shipping_fee
- total_amount
- currency
- order_status
- payment_status
- shipping_address
- billing_address
- tracking_number
- courier_name
- created_at
- updated_at

order_items:
- id
- order_id
- product_id
- variant_id
- product_name
- sku
- size
- color
- quantity
- unit_price
- total_price
- created_at

payments:
- id
- order_id
- razorpay_order_id
- razorpay_payment_id
- signature
- amount
- currency
- payment_status
- failure_reason
- refund_amount
- created_at
- updated_at

reviews:
- id
- user_id
- product_id
- order_id
- rating
- title
- comment
- images
- status
- created_at
- updated_at

outfit_bundles:
- id
- name
- slug
- description
- image_url
- occasion
- season
- style
- bundle_price
- discount
- status
- created_at
- updated_at

outfit_bundle_items:
- id
- bundle_id
- product_id
- variant_id
- quantity
- created_at

coupons:
- id
- code
- discount_type
- discount_value
- minimum_order_value
- maximum_discount
- usage_limit
- per_user_limit
- starts_at
- expires_at
- is_active
- created_at
- updated_at

inventory_logs:
- id
- product_id
- variant_id
- change_amount
- reason
- previous_quantity
- new_quantity
- admin_user_id
- created_at

homepage_sections:
- id
- section_type
- title
- description
- image_url
- button_text
- button_url
- display_order
- is_active
- created_at
- updated_at

admin_activity_logs:
- id
- admin_user_id
- action
- entity_type
- entity_id
- details
- created_at

==================================================
API ROUTES
==================================================

Create these API routes:

Products:
- GET /api/products
- GET /api/products/[slug]
- POST /api/admin/products
- PATCH /api/admin/products/[id]
- DELETE /api/admin/products/[id]

Categories:
- GET /api/categories
- POST /api/admin/categories
- PATCH /api/admin/categories/[id]
- DELETE /api/admin/categories/[id]

Cart:
- GET /api/cart
- POST /api/cart/items
- PATCH /api/cart/items/[id]
- DELETE /api/cart/items/[id]

Wishlist:
- GET /api/wishlist
- POST /api/wishlist
- DELETE /api/wishlist/[productId]

Orders:
- POST /api/orders
- GET /api/orders
- GET /api/orders/[id]
- PATCH /api/admin/orders/[id]

Payments:
- POST /api/payments/create-order
- POST /api/payments/verify
- POST /api/payments/webhook
- POST /api/payments/refund

Recommendations:
- POST /api/recommendations

Admin:
- GET /api/admin/analytics
- GET /api/admin/inventory
- PATCH /api/admin/inventory/[variantId]
- GET /api/admin/customers
- GET /api/admin/reviews
- PATCH /api/admin/reviews/[id]
- GET /api/admin/activity-logs

==================================================
PERFORMANCE REQUIREMENTS
==================================================

Make the website lightweight and fast:

- Use WebP or AVIF images.
- Compress uploaded images.
- Use responsive image sizes.
- Lazy-load images below the fold.
- Do not use autoplay videos.
- Avoid heavy animation libraries.
- Avoid unnecessary third-party scripts.
- Use pagination for products.
- Use skeleton loaders.
- Prevent layout shifts.
- Use server-side data fetching where appropriate.
- Keep JavaScript bundle lightweight.
- Optimize mobile layout.
- Use accessible buttons and forms.
- Target fast mobile loading and good Core Web Vitals.

==================================================
FOLDER STRUCTURE
==================================================

Use a clean Next.js App Router structure similar to:

app/
  page.tsx
  shop/page.tsx
  products/[slug]/page.tsx
  categories/[slug]/page.tsx
  complete-looks/page.tsx
  ai-style/page.tsx
  cart/page.tsx
  checkout/page.tsx
  account/page.tsx
  account/orders/page.tsx
  admin/page.tsx
  admin/products/page.tsx
  admin/products/new/page.tsx
  admin/products/[id]/page.tsx
  admin/categories/page.tsx
  admin/orders/page.tsx
  admin/inventory/page.tsx
  admin/coupons/page.tsx
  admin/complete-looks/page.tsx
  admin/settings/page.tsx
  api/products/route.ts
  api/categories/route.ts
  api/orders/route.ts
  api/payments/create-order/route.ts
  api/payments/verify/route.ts
  api/payments/webhook/route.ts
  api/recommendations/route.ts

components/
  Header.tsx
  Footer.tsx
  ProductCard.tsx
  ProductGrid.tsx
  ProductFilters.tsx
  ProductGallery.tsx
  AddToCartButton.tsx
  WishlistButton.tsx
  CartDrawer.tsx
  CheckoutForm.tsx
  CompleteLookCard.tsx
  AdminSidebar.tsx
  AdminProductForm.tsx
  AdminCategoryForm.tsx
  AdminOrderTable.tsx
  AdminInventoryTable.tsx
  ImageUploader.tsx

lib/
  supabase/
  auth/
  products/
  cart/
  orders/
  payments/
  recommendations/
  validation/
  permissions/

types/
  database.ts
  product.ts
  order.ts
  user.ts

public/
  images/
  icons/

==================================================
FINAL BUILD INSTRUCTION
==================================================

Before generating the final code, first show:

1. Complete sitemap
2. Technology stack
3. Database schema
4. User roles
5. Admin permissions
6. API routes
7. Payment flow
8. Product management flow
9. Category management flow
10. Folder structure

Then generate the complete website.

Use realistic dummy products for:
- Shirts
- T-shirts
- Sweaters
- Jackets
- Trousers
- Shoes
- Watches
- Belts
- Bags
- Accessories

Make the website functional with dummy data first, but keep the complete architecture ready for Supabase, Razorpay, shipping integration and AI outfit recommendations.

Do not create only a landing page. Create a working ecommerce website with a real admin dashboard where I can add products, create categories, manage variants, update stock, manage orders and create complete outfit bundles.