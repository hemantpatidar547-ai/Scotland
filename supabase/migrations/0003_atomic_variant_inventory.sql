create or replace function public.decrement_product_variant_stocks(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  variant_uuid uuid;
  item_quantity integer;
  affected_rows integer;
begin
  for item in
    select value
    from jsonb_array_elements(p_items) as items(value)
    order by value->>'variant_id'
  loop
    variant_uuid := (item->>'variant_id')::uuid;
    item_quantity := (item->>'quantity')::integer;

    if item_quantity < 1 then
      raise exception 'Invalid inventory quantity';
    end if;

    update public.product_variants
    set stock_quantity = stock_quantity - item_quantity,
        updated_at = now()
    where id = variant_uuid
      and stock_quantity - reserved_quantity >= item_quantity;

    get diagnostics affected_rows = row_count;
    if affected_rows = 0 then
      raise exception 'Insufficient stock for variant %', variant_uuid;
    end if;
  end loop;
end;
$$;

create or replace function public.restore_product_variant_stocks(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  variant_uuid uuid;
  item_quantity integer;
  affected_rows integer;
begin
  for item in
    select value
    from jsonb_array_elements(p_items) as items(value)
    order by value->>'variant_id'
  loop
    variant_uuid := (item->>'variant_id')::uuid;
    item_quantity := (item->>'quantity')::integer;

    if item_quantity < 1 then
      raise exception 'Invalid inventory quantity';
    end if;

    update public.product_variants
    set stock_quantity = stock_quantity + item_quantity,
        updated_at = now()
    where id = variant_uuid;

    get diagnostics affected_rows = row_count;
    if affected_rows = 0 then
      raise exception 'Could not restore stock for variant %', variant_uuid;
    end if;
  end loop;
end;
$$;

revoke all on function public.decrement_product_variant_stocks(jsonb) from public, anon, authenticated;
revoke all on function public.restore_product_variant_stocks(jsonb) from public, anon, authenticated;
grant execute on function public.decrement_product_variant_stocks(jsonb) to service_role;
grant execute on function public.restore_product_variant_stocks(jsonb) to service_role;

notify pgrst, 'reload schema';
