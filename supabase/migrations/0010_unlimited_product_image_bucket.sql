insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'scotland-product-images',
  'scotland-product-images',
  true,
  null,
  null
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = null,
    allowed_mime_types = null;
