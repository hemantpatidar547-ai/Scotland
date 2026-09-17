-- Preserve admin pricing and product fields that are not normalized into the core tables.
alter table public.products add column if not exists mrp numeric(12,2);
alter table public.products add column if not exists discount numeric(5,2) not null default 0;
alter table public.products add column if not exists product_metadata jsonb not null default '{}'::jsonb;
