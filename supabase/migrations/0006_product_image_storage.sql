-- Store public product images as optimized objects instead of embedding data URLs in product responses.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'scotland-product-images',
  'scotland-product-images',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
