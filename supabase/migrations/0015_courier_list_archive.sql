alter table public.orders
  add column if not exists courier_hidden boolean not null default false;

create index if not exists orders_visible_courier_created_idx
  on public.orders (created_at desc)
  where courier_hidden = false;

create or replace function public.clear_courier_queue_for_terminal_orders()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (
      lower(new.order_status::text) in ('cancelled', 'refunded', 'delivered', 'returned', 'shipped', 'out_for_delivery')
      and old.order_status is distinct from new.order_status
    )
    or lower(new.payment_status) = 'refunded'
    or new.tracking_number is not null
    or new.courier_hidden then
    new.courier_dispatch_queued := false;
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
