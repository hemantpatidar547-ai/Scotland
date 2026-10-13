alter table public.profiles
  add column if not exists phone text;

create index if not exists profiles_created_at_idx
  on public.profiles (created_at desc);

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Home',
  recipient_name text not null,
  phone text not null,
  address_line text not null,
  city text not null,
  postal_code text not null,
  country text not null default 'India',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_addresses_user_idx
  on public.customer_addresses (user_id, created_at desc);

with ranked_defaults as (
  select id, row_number() over (
    partition by user_id
    order by is_default desc, created_at, id
  ) as position
  from public.customer_addresses
)
update public.customer_addresses address
set is_default = false
from ranked_defaults
where address.id = ranked_defaults.id
  and ranked_defaults.position > 1;

create unique index if not exists customer_addresses_one_default_idx
  on public.customer_addresses (user_id)
  where is_default;

alter table public.customer_addresses enable row level security;
drop policy if exists "users manage own addresses" on public.customer_addresses;
create policy "users manage own addresses"
  on public.customer_addresses for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

drop policy if exists "users update own profile" on public.profiles;
revoke update on public.profiles from anon, authenticated;

alter table public.orders
  add column if not exists user_email text,
  add column if not exists items jsonb not null default '[]'::jsonb,
  add column if not exists shipping_cost numeric(12,2) not null default 0,
  add column if not exists coupon_code text,
  add column if not exists coupon_discount numeric(12,2) not null default 0,
  add column if not exists final_amount numeric(12,2),
  add column if not exists payment_method text,
  add column if not exists razorpay_payment_id text,
  add column if not exists razorpay_order_id text,
  add column if not exists razorpay_signature text;

create table if not exists public.settings (
  id text primary key,
  free_delivery boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;

update public.orders
set user_email = email
where user_email is null;

update public.orders
set final_amount = total_amount
where final_amount is null;

create index if not exists orders_user_created_idx
  on public.orders (user_id, created_at desc);

with latest_customer_orders as (
  select distinct on (user_id)
    user_id,
    shipping_address
  from public.orders
  where user_id is not null
  order by user_id, created_at desc
)
update public.profiles profile
set full_name = coalesce(profile.full_name, nullif(latest.shipping_address->>'name', '')),
    phone = coalesce(profile.phone, nullif(latest.shipping_address->>'phone', ''))
from latest_customer_orders latest
where profile.id = latest.user_id
  and (profile.full_name is null or profile.phone is null);

alter table public.order_items
  add column if not exists product_image text;

do $$
declare
  customer_cart record;
  cart_item record;
  extra_cart_id uuid;
  kept_cart_id uuid;
begin
  for customer_cart in
    select user_id, array_agg(id order by created_at, id) as cart_ids
    from public.carts
    where user_id is not null
    group by user_id
    having count(*) > 1
  loop
    kept_cart_id := customer_cart.cart_ids[1];

    foreach extra_cart_id in array customer_cart.cart_ids[2:]
    loop
      for cart_item in
        select * from public.cart_items where cart_id = extra_cart_id
      loop
        update public.cart_items
        set quantity = quantity + cart_item.quantity,
            price = cart_item.price
        where cart_id = kept_cart_id
          and product_id = cart_item.product_id
          and variant_id is not distinct from cart_item.variant_id;

        if not found then
          update public.cart_items
          set cart_id = kept_cart_id
          where id = cart_item.id;
        else
          delete from public.cart_items where id = cart_item.id;
        end if;
      end loop;

      delete from public.carts where id = extra_cart_id;
    end loop;
  end loop;
end;
$$;

create unique index if not exists carts_user_unique_idx
  on public.carts (user_id)
  where user_id is not null;

with item_totals as (
  select
    (array_agg(id order by id))[1] as keep_id,
    cart_id,
    product_id,
    variant_id,
    sum(quantity)::integer as total_quantity,
    max(price) as latest_price
  from public.cart_items
  group by cart_id, product_id, variant_id
)
update public.cart_items item
set quantity = totals.total_quantity,
    price = totals.latest_price
from item_totals totals
where item.id = totals.keep_id;

delete from public.cart_items item
using public.cart_items kept
where item.cart_id = kept.cart_id
  and item.product_id = kept.product_id
  and item.variant_id is not distinct from kept.variant_id
  and item.id > kept.id;

create unique index if not exists cart_items_variant_unique_idx
  on public.cart_items (cart_id, product_id, coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid));

create or replace function public.sync_customer_cart(p_user_id uuid, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cart_uuid uuid;
  item jsonb;
  variant_uuid uuid;
  item_quantity integer;
  product_uuid uuid;
  unit_price numeric(12,2);
  available_stock integer;
begin
  insert into public.carts (user_id)
  values (p_user_id)
  on conflict (user_id) where user_id is not null do nothing;

  select id into cart_uuid
  from public.carts
  where user_id = p_user_id;

  delete from public.cart_items
  where cart_id = cart_uuid;

  for item in
    select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as items(value)
  loop
    variant_uuid := (item->>'variant_id')::uuid;
    item_quantity := (item->>'quantity')::integer;

    if item_quantity < 1 then
      raise exception 'Cart quantity must be at least one';
    end if;

    select variant.product_id,
           coalesce(variant.sale_price, product.sale_price, variant.price, product.price),
           variant.stock_quantity - variant.reserved_quantity
    into product_uuid, unit_price, available_stock
    from public.product_variants variant
    join public.products product on product.id = variant.product_id
    where variant.id = variant_uuid
      and variant.is_active
      and product.status = 'active';

    if product_uuid is null then
      raise exception 'A selected product variant is no longer available';
    end if;

    if item_quantity > available_stock then
      raise exception 'Requested quantity exceeds available stock';
    end if;

    insert into public.cart_items (cart_id, product_id, variant_id, quantity, price)
    values (cart_uuid, product_uuid, variant_uuid, item_quantity, unit_price);
  end loop;
end;
$$;

revoke all on function public.sync_customer_cart(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.sync_customer_cart(uuid, jsonb) to service_role;

create or replace function public.create_customer_order(
  p_order jsonb,
  p_items jsonb,
  p_inventory jsonb
)
returns table (order_id uuid, order_number text)
language plpgsql
security definer
set search_path = public
as $$
declare
  created_order_id uuid;
  created_order_number text;
  item jsonb;
begin
  perform public.decrement_product_variant_stocks(p_inventory);

  insert into public.orders (
    order_number, user_id, user_email, email, shipping_address, items,
    subtotal, shipping_cost, tax, coupon_code, coupon_discount,
    final_amount, total_amount, payment_method, payment_status,
    razorpay_payment_id, razorpay_order_id, razorpay_signature, order_status
  )
  values (
    p_order->>'order_number',
    nullif(p_order->>'user_id', '')::uuid,
    nullif(p_order->>'user_email', ''),
    p_order->>'email',
    p_order->'shipping_address',
    coalesce(p_order->'items', '[]'::jsonb),
    (p_order->>'subtotal')::numeric,
    (p_order->>'shipping_cost')::numeric,
    (p_order->>'tax')::numeric,
    nullif(p_order->>'coupon_code', ''),
    (p_order->>'coupon_discount')::numeric,
    (p_order->>'final_amount')::numeric,
    (p_order->>'total_amount')::numeric,
    p_order->>'payment_method',
    p_order->>'payment_status',
    nullif(p_order->>'razorpay_payment_id', ''),
    nullif(p_order->>'razorpay_order_id', ''),
    nullif(p_order->>'razorpay_signature', ''),
    (p_order->>'order_status')::public.order_status
  )
  returning id, orders.order_number into created_order_id, created_order_number;

  if nullif(p_order->>'user_id', '') is not null then
    update public.profiles
    set full_name = coalesce(full_name, nullif(p_order->'shipping_address'->>'name', '')),
        phone = coalesce(phone, nullif(p_order->'shipping_address'->>'phone', '')),
        updated_at = now()
    where id = (p_order->>'user_id')::uuid;
  end if;

  for item in
    select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as order_items(value)
  loop
    insert into public.order_items (
      order_id, product_id, variant_id, product_name, product_image, sku,
      size, color, quantity, unit_price, total_price
    )
    values (
      created_order_id,
      (item->>'productId')::uuid,
      (item->>'variantId')::uuid,
      item->>'name',
      item->>'image',
      item->>'sku',
      item->>'size',
      item->>'color',
      (item->>'quantity')::integer,
      (item->>'price')::numeric,
      (item->>'totalPrice')::numeric
    );
  end loop;

  return query select created_order_id, created_order_number;
end;
$$;

revoke all on function public.create_customer_order(jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_customer_order(jsonb, jsonb, jsonb) to service_role;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    nullif(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'), ''),
    nullif(new.raw_user_meta_data->>'phone', '')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(profiles.full_name, excluded.full_name),
        phone = coalesce(profiles.phone, excluded.phone),
        updated_at = now();
  return new;
end;
$$;

update public.profiles
set role = 'admin'
where lower(email) in ('patidarhemant226@gmail.com', 'hemantpatidar547@gmail.com');

notify pgrst, 'reload schema';
