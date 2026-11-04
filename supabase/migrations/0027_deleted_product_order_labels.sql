update public.orders order_row
set items = (
  select jsonb_agg(
    (item - 'productId')
      || jsonb_build_object(
        'name', 'Deleted product',
        'deletedProduct', true
      )
    order by item_position
  )
  from jsonb_array_elements(order_row.items) with ordinality as snapshot(item, item_position)
)
where jsonb_typeof(order_row.items) = 'array'
  and exists (
    select 1
    from jsonb_array_elements(order_row.items) as snapshot(item)
    where item->>'productId' is not null
      and not exists (
        select 1
        from public.products product
        where product.id::text = item->>'productId'
      )
  );

create or replace function public.delete_catalog_product(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.cart_items
  where product_id = p_product_id;

  update public.order_items
  set product_id = null,
      variant_id = null
  where product_id = p_product_id
     or variant_id in (
       select id
       from public.product_variants
       where product_id = p_product_id
     );

  update public.orders order_row
  set items = (
    select jsonb_agg(
      (item - 'productId')
        || jsonb_build_object(
          'name', 'Deleted product',
          'deletedProduct', true
        )
      order by item_position
    )
    from jsonb_array_elements(order_row.items) with ordinality as snapshot(item, item_position)
  )
  where jsonb_typeof(order_row.items) = 'array'
    and order_row.items @> jsonb_build_array(
      jsonb_build_object('productId', p_product_id::text)
    );

  delete from public.products
  where id = p_product_id;

  if not found then
    raise exception 'Product not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.delete_catalog_product(uuid) from public, anon, authenticated;
grant execute on function public.delete_catalog_product(uuid) to service_role;

notify pgrst, 'reload schema';
