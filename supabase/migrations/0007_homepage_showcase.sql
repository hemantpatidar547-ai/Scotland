alter table public.settings
  add column if not exists homepage_showcase jsonb not null default '{}'::jsonb;
