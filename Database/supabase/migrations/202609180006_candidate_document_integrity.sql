-- Candidate document integrity metadata for private KRAVIA recruitment uploads.
-- Files remain in the non-public office-candidate-documents bucket.

alter table public.office_candidate_document_requests
  add column if not exists sha256 text,
  add column if not exists mime_type text,
  add column if not exists byte_size bigint,
  add column if not exists original_filename text;

alter table public.office_candidate_document_requests
  drop constraint if exists office_candidate_document_requests_sha256_check;
alter table public.office_candidate_document_requests
  add constraint office_candidate_document_requests_sha256_check
  check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$');

alter table public.office_candidate_document_requests
  drop constraint if exists office_candidate_document_requests_byte_size_check;
alter table public.office_candidate_document_requests
  add constraint office_candidate_document_requests_byte_size_check
  check (byte_size is null or (byte_size > 0 and byte_size <= 26214400));

create or replace function public.office_candidate_document_received_v2(
  p_actor uuid,
  p_request uuid,
  p_storage text,
  p_source text,
  p_sha text,
  p_mime text,
  p_size bigint,
  p_filename text
) returns text
language plpgsql
security definer
set search_path=''
as $$
declare
  d public.office_candidate_document_requests%rowtype;
  c public.office_candidates%rowtype;
  r public.office_hiring_requisitions%rowtype;
  digest text:=lower(trim(p_sha));
  mime text:=lower(trim(p_mime));
begin
  select * into d from public.office_candidate_document_requests where id=p_request for update;
  if d.id is null then raise exception 'Candidate document request not found'; end if;
  select * into c from public.office_candidates where id=d.candidate_id;
  select * into r from public.office_hiring_requisitions where id=c.requisition_id;

  if not public.office_effective_permission(p_actor,'hiring.candidate.manage','COMPANY',null,null)
     and not public.office_effective_permission(p_actor,'hiring.candidate.manage','DEPARTMENT',r.department_code,null) then
    raise exception 'Candidate document permission is required';
  end if;
  if d.status in ('VERIFIED','WAIVED') then raise exception 'Finalized candidate document cannot be replaced silently'; end if;
  if digest !~ '^[0-9a-f]{64}$' then raise exception 'Valid SHA-256 is required'; end if;
  if mime not in ('application/pdf','image/jpeg','image/png','image/webp') then raise exception 'Unsupported candidate document type'; end if;
  if p_size is null or p_size<=0 or p_size>26214400 then raise exception 'Candidate document exceeds allowed size'; end if;

  update public.office_candidate_document_requests
     set storage_reference=trim(p_storage),
         source_reference=nullif(trim(coalesce(p_source,'')),''),
         sha256=digest,
         mime_type=mime,
         byte_size=p_size,
         original_filename=left(nullif(trim(coalesce(p_filename,'')),''),255),
         status='UNDER_REVIEW',
         verified_by=null,
         verified_at=null,
         updated_at=now()
   where id=d.id;

  insert into public.office_recruitment_events(actor_user_id,requisition_id,candidate_id,event_type,metadata)
  values(
    p_actor,c.requisition_id,c.id,'CANDIDATE_DOCUMENT_RECEIVED',
    jsonb_build_object(
      'request_id',d.id,
      'document_type',d.document_type,
      'storage_reference',trim(p_storage),
      'sha256',digest,
      'mime_type',mime,
      'byte_size',p_size
    )
  );
  return 'UNDER_REVIEW';
end;
$$;

revoke all on function public.office_candidate_document_received_v2(uuid,uuid,text,text,text,text,bigint,text) from public,anon,authenticated;
grant execute on function public.office_candidate_document_received_v2(uuid,uuid,text,text,text,text,bigint,text) to service_role;
