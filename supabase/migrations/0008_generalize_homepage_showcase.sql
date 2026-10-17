update public.settings
set homepage_showcase = jsonb_set(
  jsonb_set(
    homepage_showcase,
    '{title}',
    to_jsonb('Styles for every day.'::text),
    true
  ),
  '{description}',
  to_jsonb('Explore a growing collection of considered essentials, easy layers, and complete looks. New products and fresh styles are on the way.'::text),
  true
),
updated_at = now()
where id = 'store'
  and (
    coalesce(homepage_showcase->>'title', '') ilike '%italian%'
    and coalesce(homepage_showcase->>'description', '') ilike '%italian%'
  );
