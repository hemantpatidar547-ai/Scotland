alter table public.orders
  add column if not exists admin_archived_at timestamptz;

update public.orders
set admin_archived_at = now()
where admin_archived_at is null;

create index if not exists orders_active_admin_created_idx
  on public.orders (created_at desc)
  where admin_archived_at is null;

notify pgrst, 'reload schema';
