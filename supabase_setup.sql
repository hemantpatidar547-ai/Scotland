-- =============================================
-- Scotland E-commerce - Supabase Tables Setup
-- Safe to run multiple times (IF NOT EXISTS)
-- =============================================

-- 1. ORDERS TABLE
create table if not exists orders (
  id              uuid primary key default gen_random_uuid(),
  order_number    text unique not null,
  user_id         uuid references auth.users(id),
  user_email      text,
  shipping_address jsonb,
  items           jsonb,
  subtotal        numeric default 0,
  shipping_cost   numeric default 50,
  tax             numeric default 0,
  coupon_code     text,
  coupon_discount numeric default 0,
  final_amount    numeric default 0,
  payment_method  text default 'cod',
  payment_status  text default 'pending',
  order_status    text default 'pending',
  razorpay_payment_id text,
  razorpay_order_id   text,
  razorpay_signature  text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- 2. COUPONS TABLE
create table if not exists coupons (
  id                   uuid primary key default gen_random_uuid(),
  code                 text unique not null,
  discount_type        text not null,
  discount_value       numeric not null,
  minimum_order_amount numeric default 0,
  maximum_discount     numeric,
  usage_limit          int,
  used_count           int default 0,
  is_active            boolean default true,
  expires_at           timestamptz,
  created_at           timestamptz default now()
);

-- 3. SETTINGS TABLE
create table if not exists settings (
  id           text primary key,
  free_delivery boolean default false,
  updated_at   timestamptz default now()
);

-- Insert default settings row
insert into settings (id, free_delivery) values ('store', false)
on conflict (id) do nothing;

-- =============================================
-- RLS POLICIES (Drop first to avoid conflicts)
-- =============================================

alter table orders enable row level security;
alter table coupons enable row level security;
alter table settings enable row level security;

-- Drop existing policies first
drop policy if exists "Users can view own orders" on orders;
drop policy if exists "Anyone can insert orders" on orders;
drop policy if exists "Anyone can read coupons" on coupons;
drop policy if exists "Anyone can read settings" on settings;

-- Recreate policies
create policy "Users can view own orders" on orders
  for select using (auth.uid() = user_id);

create policy "Anyone can insert orders" on orders
  for insert with check (true);

create policy "Anyone can read coupons" on coupons
  for select using (true);

create policy "Anyone can read settings" on settings
  for select using (true);
