create table if not exists public.courier_submission_audit (
  id uuid primary key default gen_random_uuid(),
  admin_id text not null,
  order_id uuid not null,
  action text not null check (action = 'shipment_submission'),
  api_result jsonb not null default '{"outcome":"started"}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists courier_submission_audit_order_created_idx
  on public.courier_submission_audit (order_id, created_at desc);

alter table public.courier_submission_audit enable row level security;

notify pgrst, 'reload schema';
