alter table public.orders
  add column if not exists courier_status text,
  add column if not exists courier_status_updated_at timestamptz,
  add column if not exists courier_shipping_charge numeric(12,2);

alter table public.orders
  drop constraint if exists orders_courier_shipping_charge_check;

alter table public.orders
  add constraint orders_courier_shipping_charge_check
  check (courier_shipping_charge is null or courier_shipping_charge >= 0);

create index if not exists orders_courier_status_created_idx
  on public.orders (courier_status, created_at desc);

notify pgrst, 'reload schema';
