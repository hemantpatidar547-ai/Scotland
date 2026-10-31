create or replace function public.cancel_customer_order(
  p_order_id uuid,
  p_user_id uuid default null
)
returns table (
  order_id uuid,
  order_number text,
  payment_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_order public.orders%rowtype;
  inventory_items jsonb;
  current_status text;
begin
  select *
  into current_order
  from public.orders
  where id = p_order_id
  for update;

  if not found or (p_user_id is not null and current_order.user_id is distinct from p_user_id) then
    raise exception 'Order not found';
  end if;

  current_status := lower(current_order.order_status::text);
  if current_status not in ('pending_payment', 'pending', 'new', 'paid', 'confirmed', 'processing', 'packed') then
    raise exception 'This order can no longer be cancelled because it has been dispatched or completed';
  end if;

  if p_user_id is not null and now() > current_order.created_at + interval '12 hours' then
    raise exception 'The 12-hour cancellation window has expired. Please contact customer support for help.';
  end if;

  select coalesce(
    jsonb_agg(jsonb_build_object('variant_id', item.variant_id, 'quantity', item.quantity)),
    '[]'::jsonb
  )
  into inventory_items
  from (
    select variant_id, sum(quantity)::integer as quantity
    from public.order_items
    where order_items.order_id = p_order_id
      and variant_id is not null
    group by variant_id
    order by variant_id
  ) as item;

  if jsonb_array_length(inventory_items) > 0 then
    perform public.restore_product_variant_stocks(inventory_items);
  end if;

  update public.orders
  set order_status = 'cancelled',
      updated_at = now()
  where id = p_order_id;

  return query
  select current_order.id, current_order.order_number, current_order.payment_status;
end;
$$;

revoke all on function public.cancel_customer_order(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cancel_customer_order(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
