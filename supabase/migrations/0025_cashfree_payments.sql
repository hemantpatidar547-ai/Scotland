alter table public.orders
  add column if not exists cashfree_checkout_session_id uuid,
  add column if not exists cashfree_order_id text,
  add column if not exists cashfree_payment_id text,
  add column if not exists cashfree_payment_method text,
  add column if not exists cashfree_transaction_id text,
  add column if not exists cashfree_payment_date timestamptz,
  add column if not exists cashfree_refund_status text,
  add column if not exists cashfree_refund_amount numeric(12,2) not null default 0;

create unique index if not exists orders_cashfree_checkout_session_idx
  on public.orders (cashfree_checkout_session_id)
  where cashfree_checkout_session_id is not null;

create table if not exists public.cashfree_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  checkout_key uuid not null unique,
  cashfree_order_id text not null unique,
  payment_session_id text,
  user_id uuid references auth.users(id) on delete set null,
  request_fingerprint text not null,
  order_snapshot jsonb not null,
  inventory_snapshot jsonb not null,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'INR',
  status text not null default 'pending',
  payment_status text not null default 'pending',
  cf_payment_id text,
  payment_method text,
  transaction_id text,
  payment_date timestamptz,
  order_id uuid unique references public.orders(id) on delete set null,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cashfree_payment_transactions (
  id uuid primary key default gen_random_uuid(),
  checkout_session_id uuid not null references public.cashfree_checkout_sessions(id) on delete cascade,
  cf_payment_id text not null unique,
  payment_status text not null,
  payment_amount numeric(12,2),
  payment_currency text,
  payment_method text,
  transaction_id text,
  bank_reference text,
  payment_time timestamptz,
  payment_completion_time timestamptz,
  payment_message text,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cashfree_refunds (
  id uuid primary key default gen_random_uuid(),
  checkout_session_id uuid not null references public.cashfree_checkout_sessions(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  merchant_refund_id text not null unique,
  cf_refund_id text unique,
  idempotency_key uuid not null unique,
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'PENDING',
  note text,
  refund_arn text,
  requested_by text,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.cashfree_webhook_events (
  event_key text primary key,
  event_type text not null,
  payload jsonb not null,
  processing_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists cashfree_sessions_status_created_idx
  on public.cashfree_checkout_sessions (status, created_at desc);
create index if not exists cashfree_transactions_session_created_idx
  on public.cashfree_payment_transactions (checkout_session_id, created_at desc);
create index if not exists cashfree_refunds_session_created_idx
  on public.cashfree_refunds (checkout_session_id, created_at desc);
create unique index if not exists cashfree_refunds_system_once_idx
  on public.cashfree_refunds (checkout_session_id)
  where requested_by = 'system';

alter table public.cashfree_checkout_sessions enable row level security;
alter table public.cashfree_payment_transactions enable row level security;
alter table public.cashfree_refunds enable row level security;
alter table public.cashfree_webhook_events enable row level security;

create or replace function public.complete_cashfree_checkout(
  p_checkout_session_id uuid,
  p_cf_payment_id text,
  p_payment_method text,
  p_transaction_id text,
  p_payment_date timestamptz,
  p_payment_amount numeric,
  p_currency text
)
returns table (order_id uuid, order_number text)
language plpgsql
security definer
set search_path = public
as $$
declare
  checkout public.cashfree_checkout_sessions%rowtype;
  created_order_id uuid;
  created_order_number text;
  item jsonb;
begin
  select *
    into checkout
    from public.cashfree_checkout_sessions
   where id = p_checkout_session_id
   for update;

  if not found then
    raise exception 'Cashfree checkout session not found';
  end if;

  if checkout.order_id is not null then
    return query
      select orders.id, orders.order_number
        from public.orders
       where orders.id = checkout.order_id;
    return;
  end if;

  if checkout.amount <> p_payment_amount
     or checkout.currency <> p_currency
     or p_cf_payment_id is null
     or p_cf_payment_id = '' then
    raise exception 'Cashfree payment does not match the saved checkout amount';
  end if;

  perform 1
    from public.settings
   where id = 'store'
     and order_paused = false
   for share;

  if not found then
    raise exception 'Orders are temporarily paused';
  end if;

  perform public.decrement_product_variant_stocks(checkout.inventory_snapshot);

  created_order_number := 'SC-' ||
    to_char(clock_timestamp() at time zone 'UTC', 'YYYYMMDDHH24MISS') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.orders (
    order_number, user_id, user_email, email, shipping_address, items,
    subtotal, shipping_cost, tax, coupon_code, coupon_discount,
    final_amount, total_amount, payment_method, payment_status, order_status,
    cashfree_checkout_session_id, cashfree_order_id, cashfree_payment_id,
    cashfree_payment_method, cashfree_transaction_id, cashfree_payment_date
  )
  values (
    created_order_number,
    checkout.user_id,
    checkout.order_snapshot->>'user_email',
    coalesce(checkout.order_snapshot->>'email', ''),
    checkout.order_snapshot->'shipping_address',
    coalesce(checkout.order_snapshot->'items', '[]'::jsonb),
    (checkout.order_snapshot->>'subtotal')::numeric,
    (checkout.order_snapshot->>'shipping_cost')::numeric,
    (checkout.order_snapshot->>'tax')::numeric,
    nullif(checkout.order_snapshot->>'coupon_code', ''),
    (checkout.order_snapshot->>'coupon_discount')::numeric,
    checkout.amount,
    checkout.amount,
    'cashfree',
    'paid',
    'paid',
    checkout.id,
    checkout.cashfree_order_id,
    p_cf_payment_id,
    p_payment_method,
    p_transaction_id,
    p_payment_date
  )
  returning id, orders.order_number
       into created_order_id, created_order_number;

  for item in
    select value
      from jsonb_array_elements(coalesce(checkout.order_snapshot->'items', '[]'::jsonb)) as order_items(value)
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

  if checkout.user_id is not null then
    update public.profiles
       set full_name = coalesce(full_name, nullif(checkout.order_snapshot->'shipping_address'->>'name', '')),
           phone = coalesce(phone, nullif(checkout.order_snapshot->'shipping_address'->>'phone', '')),
           updated_at = now()
     where id = checkout.user_id;
  end if;

  update public.cashfree_checkout_sessions
     set status = 'paid',
         payment_status = 'paid',
         cf_payment_id = p_cf_payment_id,
         payment_method = p_payment_method,
         transaction_id = p_transaction_id,
         payment_date = p_payment_date,
         order_id = created_order_id,
         failure_reason = null,
         updated_at = now()
   where id = checkout.id;

  return query select created_order_id, created_order_number;
end;
$$;

create or replace function public.record_cashfree_refund_required(
  p_checkout_session_id uuid,
  p_cf_payment_id text,
  p_payment_method text,
  p_transaction_id text,
  p_payment_date timestamptz,
  p_payment_amount numeric,
  p_currency text,
  p_failure_reason text
)
returns table (order_id uuid, order_number text)
language plpgsql
security definer
set search_path = public
as $$
declare
  checkout public.cashfree_checkout_sessions%rowtype;
  created_order_id uuid;
  created_order_number text;
  item jsonb;
begin
  select *
    into checkout
    from public.cashfree_checkout_sessions
   where id = p_checkout_session_id
   for update;
  if not found then
    raise exception 'Cashfree checkout session not found';
  end if;

  if checkout.order_id is not null then
    return query
      select orders.id, orders.order_number
        from public.orders
       where orders.id = checkout.order_id;
    return;
  end if;

  if checkout.amount <> p_payment_amount
     or checkout.currency <> p_currency
     or p_cf_payment_id is null
     or p_cf_payment_id = '' then
    raise exception 'Cashfree payment does not match the saved checkout amount';
  end if;

  created_order_number := 'SC-' ||
    to_char(clock_timestamp() at time zone 'UTC', 'YYYYMMDDHH24MISS') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.orders (
    order_number, user_id, user_email, email, shipping_address, items,
    subtotal, shipping_cost, tax, coupon_code, coupon_discount,
    final_amount, total_amount, payment_method, payment_status, order_status,
    cashfree_checkout_session_id, cashfree_order_id, cashfree_payment_id,
    cashfree_payment_method, cashfree_transaction_id, cashfree_payment_date
  )
  values (
    created_order_number,
    checkout.user_id,
    checkout.order_snapshot->>'user_email',
    coalesce(checkout.order_snapshot->>'email', ''),
    checkout.order_snapshot->'shipping_address',
    coalesce(checkout.order_snapshot->'items', '[]'::jsonb),
    (checkout.order_snapshot->>'subtotal')::numeric,
    (checkout.order_snapshot->>'shipping_cost')::numeric,
    (checkout.order_snapshot->>'tax')::numeric,
    nullif(checkout.order_snapshot->>'coupon_code', ''),
    (checkout.order_snapshot->>'coupon_discount')::numeric,
    checkout.amount,
    checkout.amount,
    'cashfree',
    'refund_required',
    'cancelled',
    checkout.id,
    checkout.cashfree_order_id,
    p_cf_payment_id,
    p_payment_method,
    p_transaction_id,
    p_payment_date
  )
  returning id, orders.order_number
       into created_order_id, created_order_number;

  for item in
    select value
      from jsonb_array_elements(coalesce(checkout.order_snapshot->'items', '[]'::jsonb)) as order_items(value)
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

  update public.cashfree_checkout_sessions
     set status = 'refund_required',
         payment_status = 'refund_required',
         cf_payment_id = p_cf_payment_id,
         payment_method = p_payment_method,
         transaction_id = p_transaction_id,
         payment_date = p_payment_date,
         order_id = created_order_id,
         failure_reason = left(p_failure_reason, 500),
         updated_at = now()
   where id = checkout.id;

  return query select created_order_id, created_order_number;
end;
$$;

create or replace function public.reserve_cashfree_refund(
  p_checkout_session_id uuid,
  p_amount numeric,
  p_idempotency_key uuid,
  p_note text,
  p_requested_by text
)
returns table (refund_record_id uuid, merchant_refund_id text)
language plpgsql
security definer
set search_path = public
as $$
declare
  checkout public.cashfree_checkout_sessions%rowtype;
  existing public.cashfree_refunds%rowtype;
  already_reserved numeric(12,2);
  new_refund_id text;
  new_record_id uuid;
begin
  select * into existing
    from public.cashfree_refunds
   where idempotency_key = p_idempotency_key;
  if found then
    if existing.checkout_session_id <> p_checkout_session_id
       or existing.amount <> p_amount then
      raise exception 'Refund idempotency key was already used for a different request';
    end if;
    return query select existing.id, existing.merchant_refund_id;
    return;
  end if;

  select * into checkout
    from public.cashfree_checkout_sessions
   where id = p_checkout_session_id
   for update;
  if not found or checkout.order_id is null or checkout.status <> 'paid' then
    raise exception 'Only a paid Cashfree order can be refunded';
  end if;

  select * into existing
    from public.cashfree_refunds
   where idempotency_key = p_idempotency_key;
  if found then
    if existing.checkout_session_id <> p_checkout_session_id
       or existing.amount <> p_amount then
      raise exception 'Refund idempotency key was already used for a different request';
    end if;
    return query select existing.id, existing.merchant_refund_id;
    return;
  end if;

  if p_amount <= 0 then
    raise exception 'Refund amount must be greater than zero';
  end if;

  select coalesce(sum(amount), 0)
    into already_reserved
    from public.cashfree_refunds
   where checkout_session_id = checkout.id
     and status not in ('FAILED', 'CANCELLED', 'REJECTED');

  if already_reserved + p_amount > checkout.amount then
    raise exception 'Refund amount exceeds the remaining captured payment';
  end if;

  new_refund_id := 'rf' || replace(gen_random_uuid()::text, '-', '');
  insert into public.cashfree_refunds (
    checkout_session_id, order_id, merchant_refund_id, idempotency_key,
    amount, status, note, requested_by
  )
  values (
    checkout.id, checkout.order_id, new_refund_id, p_idempotency_key,
    p_amount, 'PENDING', nullif(p_note, ''), p_requested_by
  )
  returning id into new_record_id;

  return query select new_record_id, new_refund_id;
end;
$$;

revoke all on function public.complete_cashfree_checkout(uuid, text, text, text, timestamptz, numeric, text) from public, anon, authenticated;
grant execute on function public.complete_cashfree_checkout(uuid, text, text, text, timestamptz, numeric, text) to service_role;
revoke all on function public.record_cashfree_refund_required(uuid, text, text, text, timestamptz, numeric, text, text) from public, anon, authenticated;
grant execute on function public.record_cashfree_refund_required(uuid, text, text, text, timestamptz, numeric, text, text) to service_role;
revoke all on function public.reserve_cashfree_refund(uuid, numeric, uuid, text, text) from public, anon, authenticated;
grant execute on function public.reserve_cashfree_refund(uuid, numeric, uuid, text, text) to service_role;

notify pgrst, 'reload schema';
