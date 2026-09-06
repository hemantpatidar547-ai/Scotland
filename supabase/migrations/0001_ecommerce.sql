-- Run in Supabase SQL Editor. Auth users live in auth.users; profiles extends them.
create extension if not exists "pgcrypto";
create type public.app_role as enum ('customer','admin','super_admin');
create type public.product_status as enum ('draft','active','out_of_stock','archived');
create type public.order_status as enum ('pending_payment','paid','processing','packed','shipped','delivered','cancelled','refunded');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text, full_name text, phone text, role public.app_role not null default 'customer',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.categories (
  id uuid primary key default gen_random_uuid(), name text not null, slug text unique not null, description text,
  parent_id uuid references public.categories(id) on delete set null, image_url text, display_order int not null default 0,
  is_active boolean not null default true, seo_title text, seo_description text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.products (
  id uuid primary key default gen_random_uuid(), name text not null, slug text unique not null, description text not null,
  short_description text, category_id uuid references public.categories(id) on delete set null, brand_name text default 'SCOTLAND',
  gender text check(gender in ('Men','Women','Unisex')), style_origin text, occasion text, season text, style text,
  material text, care_instructions text, price numeric(12,2) not null check(price > 0), sale_price numeric(12,2),
  cost_price numeric(12,2), tax_percentage numeric(5,2) not null default 0, sku text unique not null,
  status public.product_status not null default 'draft', is_featured boolean not null default false,
  is_new_arrival boolean not null default false, is_best_seller boolean not null default false, is_on_sale boolean not null default false,
  average_rating numeric(3,2) not null default 0, review_count int not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.product_variants (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade,
  sku text unique not null, color text, size text, price numeric(12,2), sale_price numeric(12,2), stock_quantity int not null default 0 check(stock_quantity >= 0),
  reserved_quantity int not null default 0 check(reserved_quantity >= 0), image_url text, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(reserved_quantity <= stock_quantity)
);
create table public.product_images (id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade, image_url text not null, alt_text text, display_order int not null default 0, is_primary boolean not null default false, created_at timestamptz not null default now());
create table public.carts (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade, session_id text unique, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(user_id is not null or session_id is not null));
create table public.cart_items (id uuid primary key default gen_random_uuid(), cart_id uuid not null references public.carts(id) on delete cascade, product_id uuid not null references public.products(id), variant_id uuid references public.product_variants(id), quantity int not null check(quantity > 0), price numeric(12,2) not null check(price >= 0), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.wishlists (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, product_id uuid not null references public.products(id) on delete cascade, created_at timestamptz not null default now(), unique(user_id,product_id));
create table public.orders (id uuid primary key default gen_random_uuid(), order_number text unique not null, user_id uuid references auth.users(id), email text not null, subtotal numeric(12,2) not null, discount numeric(12,2) not null default 0, tax numeric(12,2) not null default 0, shipping_fee numeric(12,2) not null default 0, total_amount numeric(12,2) not null, currency text not null default 'INR', order_status public.order_status not null default 'pending_payment', payment_status text not null default 'pending', shipping_address jsonb not null, billing_address jsonb, tracking_number text, courier_name text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.order_items (id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade, product_id uuid references public.products(id), variant_id uuid references public.product_variants(id), product_name text not null, sku text, size text, color text, quantity int not null check(quantity > 0), unit_price numeric(12,2) not null, total_price numeric(12,2) not null, created_at timestamptz not null default now());
create table public.payments (id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade, razorpay_order_id text unique, razorpay_payment_id text unique, signature text, amount numeric(12,2) not null, currency text not null default 'INR', payment_status text not null default 'pending', failure_reason text, refund_amount numeric(12,2) not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index products_status_idx on public.products(status); create index product_variants_product_idx on public.product_variants(product_id); create index orders_user_idx on public.orders(user_id); create index cart_items_cart_idx on public.cart_items(cart_id);

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$ select coalesce((select role in ('admin','super_admin') from public.profiles where id = auth.uid()), false); $$;
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$ begin insert into public.profiles(id,email,full_name) values(new.id,new.email,new.raw_user_meta_data->>'full_name'); return new; end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
alter table public.profiles enable row level security; alter table public.categories enable row level security; alter table public.products enable row level security; alter table public.product_variants enable row level security; alter table public.product_images enable row level security; alter table public.carts enable row level security; alter table public.cart_items enable row level security; alter table public.wishlists enable row level security; alter table public.orders enable row level security; alter table public.order_items enable row level security; alter table public.payments enable row level security;
create policy "public sees active categories" on public.categories for select using (is_active or public.is_admin()); create policy "admins manage categories" on public.categories for all using (public.is_admin()) with check (public.is_admin());
create policy "public sees active products" on public.products for select using (status='active' or public.is_admin()); create policy "admins manage products" on public.products for all using (public.is_admin()) with check (public.is_admin());
create policy "public sees variants for visible product" on public.product_variants for select using (is_active or public.is_admin()); create policy "admins manage variants" on public.product_variants for all using (public.is_admin()) with check (public.is_admin());
create policy "public sees product images" on public.product_images for select using (true); create policy "admins manage images" on public.product_images for all using (public.is_admin()) with check (public.is_admin());
create policy "users manage their cart" on public.carts for all using (user_id=auth.uid()) with check (user_id=auth.uid()); create policy "users manage own cart items" on public.cart_items for all using (exists(select 1 from public.carts c where c.id=cart_id and c.user_id=auth.uid())) with check (exists(select 1 from public.carts c where c.id=cart_id and c.user_id=auth.uid()));
create policy "users manage wishlist" on public.wishlists for all using (user_id=auth.uid()) with check (user_id=auth.uid()); create policy "users see own orders" on public.orders for select using (user_id=auth.uid() or public.is_admin()); create policy "admins update orders" on public.orders for update using (public.is_admin()); create policy "users see order items" on public.order_items for select using (exists(select 1 from public.orders o where o.id=order_id and (o.user_id=auth.uid() or public.is_admin()))); create policy "users see payments" on public.payments for select using (exists(select 1 from public.orders o where o.id=order_id and (o.user_id=auth.uid() or public.is_admin())));
