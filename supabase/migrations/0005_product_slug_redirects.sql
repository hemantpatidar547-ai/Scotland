create table if not exists public.product_slug_redirects (
  old_slug text primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (old_slug <> '')
);

create index if not exists product_slug_redirects_product_id_idx
  on public.product_slug_redirects(product_id);

alter table public.product_slug_redirects enable row level security;

create or replace function public.record_product_slug_redirect()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.slug is distinct from new.slug then
    insert into public.product_slug_redirects(old_slug, product_id)
    values (old.slug, new.id)
    on conflict (old_slug) do update set product_id = excluded.product_id;
  end if;
  return new;
end;
$$;

drop trigger if exists products_record_slug_redirect on public.products;
create trigger products_record_slug_redirect
before update of slug on public.products
for each row
execute function public.record_product_slug_redirect();

create table if not exists public.category_slug_redirects (
  old_slug text primary key,
  category_id uuid not null references public.categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (old_slug <> '')
);

create index if not exists category_slug_redirects_category_id_idx
  on public.category_slug_redirects(category_id);

alter table public.category_slug_redirects enable row level security;

create or replace function public.record_category_slug_redirect()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.slug is distinct from new.slug then
    insert into public.category_slug_redirects(old_slug, category_id)
    values (old.slug, new.id)
    on conflict (old_slug) do update set category_id = excluded.category_id;
  end if;
  return new;
end;
$$;

drop trigger if exists categories_record_slug_redirect on public.categories;
create trigger categories_record_slug_redirect
before update of slug on public.categories
for each row
execute function public.record_category_slug_redirect();
