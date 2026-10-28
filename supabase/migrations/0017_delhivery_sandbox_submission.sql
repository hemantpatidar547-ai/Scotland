alter table public.orders
  add column if not exists courier_api_submission_state text not null default 'pending',
  add column if not exists courier_api_submission_error text,
  add column if not exists courier_package_weight_g integer;

alter table public.orders
  drop constraint if exists orders_courier_api_submission_state_check,
  drop constraint if exists orders_courier_package_weight_g_check;

alter table public.orders
  add constraint orders_courier_api_submission_state_check
    check (courier_api_submission_state in ('pending', 'submitting', 'submitted', 'needs_review')),
  add constraint orders_courier_package_weight_g_check
    check (courier_package_weight_g is null or courier_package_weight_g > 0);

notify pgrst, 'reload schema';
