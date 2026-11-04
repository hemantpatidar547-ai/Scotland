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
