create table if not exists public.api_rate_limits (
  bucket text primary key,
  window_started_at timestamptz not null,
  request_count bigint not null check (request_count > 0)
);

create index if not exists api_rate_limits_window_started_idx
  on public.api_rate_limits (window_started_at);

alter table public.api_rate_limits enable row level security;
revoke all on table public.api_rate_limits from public, anon, authenticated;
grant all on table public.api_rate_limits to service_role;

create or replace function public.consume_api_rate_limit (
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_window_started_at timestamptz;
  v_request_count bigint;
begin
  if p_bucket is null or length(p_bucket) > 160
     or p_limit < 1 or p_limit > 10000
     or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Invalid rate limit parameters.';
  end if;

  insert into public.api_rate_limits as current_bucket (
    bucket,
    window_started_at,
    request_count
  )
  values (p_bucket, v_now, 1)
  on conflict (bucket) do update
  set
    window_started_at = case
      when current_bucket.window_started_at <= v_now - make_interval(secs => p_window_seconds)
        then v_now
      else current_bucket.window_started_at
    end,
    request_count = case
      when current_bucket.window_started_at <= v_now - make_interval(secs => p_window_seconds)
        then 1
      else current_bucket.request_count + 1
    end
  returning window_started_at, request_count
  into v_window_started_at, v_request_count;

  if random() < 0.01 then
    delete from public.api_rate_limits
    where window_started_at < v_now - interval '24 hours';
  end if;

  return query
  select
    v_request_count <= p_limit,
    greatest(
      1,
      ceil(extract(epoch from (
        v_window_started_at + make_interval(secs => p_window_seconds) - v_now
      )))::integer
    );
end;
$$;

revoke all on function public.consume_api_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer)
  to service_role;

notify pgrst, 'reload schema';
