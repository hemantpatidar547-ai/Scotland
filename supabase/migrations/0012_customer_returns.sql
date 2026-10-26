alter table public.orders
  add column if not exists delivered_at timestamptz,
  add column if not exists return_status text,
  add column if not exists return_reason text,
  add column if not exists return_item_indexes integer[],
  add column if not exists return_requested_at timestamptz,
  add column if not exists return_refund_amount numeric(12,2),
  add column if not exists return_policy_accepted_at timestamptz;

update public.orders
set delivered_at = updated_at
where order_status::text = 'delivered'
  and delivered_at is null;

alter table public.orders
  drop constraint if exists orders_return_status_check;

alter table public.orders
  add constraint orders_return_status_check
  check (return_status is null or return_status in ('requested', 'approved', 'rejected', 'received', 'refunded'));

create or replace function public.set_order_delivered_timestamp()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.order_status::text = 'delivered'
    and (tg_op = 'INSERT' or old.order_status is distinct from new.order_status) then
    new.delivered_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists orders_set_delivered_timestamp on public.orders;
create trigger orders_set_delivered_timestamp
before insert or update of order_status on public.orders
for each row
execute function public.set_order_delivered_timestamp();

create or replace function public.request_customer_return(
  p_order_id uuid,
  p_user_id uuid,
  p_reason text,
  p_item_indexes integer[]
)
returns table (
  order_id uuid,
  return_status text,
  return_refund_amount numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_order public.orders%rowtype;
  item_total numeric(12,2);
  order_item_total numeric(12,2);
  discount_share numeric(12,2);
  estimated_refund numeric(12,2);
begin
  select *
  into current_order
  from public.orders
  where id = p_order_id
  for update;

  if not found or current_order.user_id is distinct from p_user_id then
    raise exception 'Order not found';
  end if;

  if current_order.order_status::text <> 'delivered' then
    raise exception 'Only delivered orders can be returned';
  end if;

  if current_order.delivered_at is null or now() > current_order.delivered_at + interval '48 hours' then
    raise exception 'The 48-hour return window has expired';
  end if;

  if current_order.return_status is not null then
    raise exception 'A return request already exists for this order';
  end if;

  if coalesce(array_length(p_item_indexes, 1), 0) = 0
    or cardinality(p_item_indexes) <> cardinality(array(select distinct unnest(p_item_indexes))) then
    raise exception 'Select one or more products to return';
  end if;

  select coalesce(sum(
    coalesce(
      nullif(item->>'totalPrice', '')::numeric,
      nullif(item->>'price', '')::numeric * nullif(item->>'quantity', '')::numeric,
      0
    )
  ), 0)
  into item_total
  from jsonb_array_elements(coalesce(current_order.items, '[]'::jsonb)) with ordinality as items(item, position)
  where (items.position - 1)::integer = any(p_item_indexes);

  select coalesce(sum(
    coalesce(
      nullif(item->>'totalPrice', '')::numeric,
      nullif(item->>'price', '')::numeric * nullif(item->>'quantity', '')::numeric,
      0
    )
  ), 0)
  into order_item_total
  from jsonb_array_elements(coalesce(current_order.items, '[]'::jsonb)) as items(item);

  if item_total <= 0 or order_item_total <= 0
    or exists (
      select 1
      from unnest(p_item_indexes) as selected(position)
      where selected.position < 0
        or selected.position >= jsonb_array_length(coalesce(current_order.items, '[]'::jsonb))
    ) then
    raise exception 'Selected products are invalid';
  end if;

  discount_share := case
    when order_item_total > 0 then round(coalesce(current_order.coupon_discount, 0) * item_total / order_item_total, 2)
    else 0
  end;
  estimated_refund := greatest(
    0,
    least(
      item_total - discount_share - 35,
      coalesce(current_order.final_amount, current_order.total_amount, 0) - coalesce(current_order.shipping_cost, 0)
    )
  );

  update public.orders
  set return_status = 'requested',
      return_reason = left(trim(p_reason), 500),
      return_item_indexes = p_item_indexes,
      return_requested_at = now(),
      return_refund_amount = estimated_refund,
      updated_at = now()
  where id = p_order_id;

  return query select p_order_id, 'requested'::text, estimated_refund;
end;
$$;

revoke all on function public.request_customer_return(uuid, uuid, text, integer[]) from public, anon, authenticated;
grant execute on function public.request_customer_return(uuid, uuid, text, integer[]) to service_role;

create or replace function public.set_order_policy_acceptance()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.return_policy_accepted_at is null then
    new.return_policy_accepted_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists orders_set_policy_acceptance on public.orders;
create trigger orders_set_policy_acceptance
before insert on public.orders
for each row
execute function public.set_order_policy_acceptance();

notify pgrst, 'reload schema';
