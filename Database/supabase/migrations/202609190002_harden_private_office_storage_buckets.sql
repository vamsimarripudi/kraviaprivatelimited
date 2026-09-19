-- Production private storage hardening for KRAVIA Office.
-- All buckets remain non-public and storage.objects RLS has no browser/client
-- policies; trusted server-side service-role access is the only write path.

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'corporate-private',
  'corporate-private',
  false,
  20971520,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]::text[]
)
on conflict (id) do update set
  name=excluded.name,
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

update storage.buckets
set public=false
where id in ('office-documents','office-candidate-documents','corporate-private');
