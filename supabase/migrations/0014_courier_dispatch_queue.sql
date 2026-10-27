alter table public.orders
  add column if not exists courier_dispatch_queued boolean not null default false;

create index if not exists orders_courier_dispatch_queue_idx
  on public.orders (courier_dispatch_queued, created_at desc)
  where courier_dispatch_queued = true;

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
    or new.tracking_number is not null then
    new.courier_dispatch_queued := false;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_clear_courier_queue_for_terminal_status on public.orders;
create trigger orders_clear_courier_queue_for_terminal_status
before update of order_status, payment_status, tracking_number on public.orders
for each row
execute function public.clear_courier_queue_for_terminal_orders();

notify pgrst, 'reload schema';
