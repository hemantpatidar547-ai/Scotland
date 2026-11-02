alter table public.settings
  add column if not exists order_paused boolean not null default false,
  add column if not exists order_pause_message text not null default 'We are temporarily unable to process orders. Please try again later.';

insert into public.settings (id, free_delivery, order_paused, order_pause_message)
values (
  'store',
  false,
  false,
  'We are temporarily unable to process orders. Please try again later.'
)
on conflict (id) do nothing;

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
  perform 1
  from public.settings
  where id = 'store'
    and order_paused = false
  for share;

  if not found then
    raise exception 'Orders are temporarily paused';
  end if;

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

notify pgrst, 'reload schema';
