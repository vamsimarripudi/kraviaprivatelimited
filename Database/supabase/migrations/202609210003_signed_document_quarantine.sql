-- KRAVIA Office — route signed-document evidence through the canonical private
-- quarantine and allow the least-privilege backend worker to finalize a
-- signature only after malware scanning succeeds.

alter table public.office_file_objects
  add column if not exists context_metadata jsonb not null default '{}'::jsonb;

alter table public.office_file_objects
  drop constraint if exists office_file_objects_context_metadata_object;
alter table public.office_file_objects
  add constraint office_file_objects_context_metadata_object
  check(jsonb_typeof(context_metadata)='object');

grant execute on function public.office_document_record_signature(
  uuid,uuid,uuid,text,text,text,text,text,text,bigint,timestamptz,jsonb
) to kravia_office_backend;

comment on column public.office_file_objects.context_metadata is
  'Bounded internal workflow metadata used by the backend worker after a file passes quarantine. Never store provider secrets or unrestricted personal data here.';
