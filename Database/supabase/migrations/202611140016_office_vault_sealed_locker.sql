-- KRAVIA K-Vault 5.0 sealed secret document locker.
-- Branch-only until separate release approval and isolated schema rehearsal.
-- Content is AES-256-GCM ciphertext with per-object DEKs wrapped outside DB
-- by a server-held keyring. Never expose object paths or wrapped keys to browsers.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('office-vault-secrets','office-vault-secrets',false,10485760,
 array['application/octet-stream']::text[])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,
 allowed_mime_types=excluded.allowed_mime_types;

insert into public.office_permission_catalog
(code,module,action,label,description,sensitivity,high_risk,requires_managed_device,active,owner_bypass)
values
('vault.secret.upload','SECURITY','UPLOAD_SECRET','Upload sealed evidence',
 'Stage encrypted K-Vault documents; independent scan and review still required.','CRITICAL',true,true,true,true),
('vault.secret.read','SECURITY','READ_SECRET','Read secret metadata',
 'Inspect current permitted secret-document metadata under record grant.','CRITICAL',true,true,true,true),
('vault.secret.review','SECURITY','REVIEW_SECRET','Independently verify secrets',
 'Review scanner-clean secret evidence; never review own upload.','CRITICAL',true,true,true,true),
('vault.secret.download','SECURITY','DOWNLOAD_SECRET','Download sealed evidence',
 'Decrypt and deliver a reviewed file with a current download grant and audit.','CRITICAL',true,true,true,true)
on conflict(code) do update set module=excluded.module,action=excluded.action,
 label=excluded.label,description=excluded.description,sensitivity=excluded.sensitivity,
 high_risk=excluded.high_risk,requires_managed_device=excluded.requires_managed_device,
 active=true,owner_bypass=excluded.owner_bypass;

create table if not exists public.office_vault_secret_documents(
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 title text not null check(length(trim(title)) between 3 and 180),
 classification text not null check(classification in
  ('CONFIDENTIAL','RESTRICTED','BOARD','FINANCE','HR','LEGAL','SECURITY')),
 state text not null default 'ACTIVE' check(state in ('ACTIVE','RETIRED')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists office_vault_secret_owner_idx
 on public.office_vault_secret_documents(owner_user_id,state,created_at desc);

create table if not exists public.office_vault_secret_versions(
 id uuid primary key,
 document_id uuid not null references public.office_vault_secret_documents(id) on delete restrict,
 version_number integer not null check(version_number>0),
 uploaded_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 filename text not null check(length(trim(filename)) between 1 and 180),
 mime_type text not null check(mime_type in
  ('application/pdf','image/jpeg','image/png','image/webp',
   'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
   'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')),
 byte_size bigint not null check(byte_size between 1 and 10485760),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 sealed_path text not null unique,
 key_id text not null check(length(key_id) between 1 and 60),
 wrapped_key text not null check(length(wrapped_key) between 32 and 200),
 wrap_nonce text not null check(wrap_nonce ~ '^[a-f0-9]{24}$'),
 wrap_tag text not null check(wrap_tag ~ '^[a-f0-9]{32}$'),
 content_nonce text not null check(content_nonce ~ '^[a-f0-9]{24}$'),
 content_tag text not null check(content_tag ~ '^[a-f0-9]{32}$'),
 scan_state text not null default 'QUARANTINED'
  check(scan_state in ('QUARANTINED','CLEAN','BLOCKED')),
 review_state text not null default 'PENDING'
  check(review_state in ('PENDING','APPROVED','REJECTED')),
 reviewed_by uuid references public.office_identity_users(user_id) on delete restrict,
 reviewed_at timestamptz,
 review_note text,
 scanner_at timestamptz,
 created_at timestamptz not null default now(),
 unique(document_id,version_number),
 check(review_state<>'APPROVED' or scan_state='CLEAN'),
 check((review_state='PENDING' and reviewed_by is null and reviewed_at is null)
   or (review_state<>'PENDING' and reviewed_by is not null and reviewed_at is not null))
);
create index if not exists office_vault_secret_version_idx
 on public.office_vault_secret_versions(document_id,version_number desc);
create index if not exists office_vault_secret_pending_idx
 on public.office_vault_secret_versions(review_state,scan_state,created_at desc);

create table if not exists public.office_vault_secret_events(
 id bigint generated always as identity primary key,
 document_id uuid not null references public.office_vault_secret_documents(id) on delete restrict,
 version_id uuid references public.office_vault_secret_versions(id) on delete restrict,
 actor_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 event_type text not null check(event_type in (
  'SEALED','SCAN_CLEAN','SCAN_BLOCKED','SCAN_UNKNOWN','APPROVED','REJECTED',
  'PREVIEWED','DOWNLOADED','ACCESS_DENIED')),
 occurred_at timestamptz not null default now()
);
create index if not exists office_vault_secret_audit_idx
 on public.office_vault_secret_events(document_id,occurred_at desc);

alter table public.office_vault_secret_documents enable row level security;
alter table public.office_vault_secret_versions enable row level security;
alter table public.office_vault_secret_events enable row level security;
revoke all on public.office_vault_secret_documents,public.office_vault_secret_versions,
 public.office_vault_secret_events from public,anon,authenticated;
revoke all on sequence public.office_vault_secret_events_id_seq from public,anon,authenticated;
grant select,insert,update on public.office_vault_secret_documents,public.office_vault_secret_versions to service_role;
grant select,insert on public.office_vault_secret_events to service_role;
grant usage,select on sequence public.office_vault_secret_events_id_seq to service_role;

-- The corporate classification and original custodian are immutable once
-- evidence is sealed. A human-readable title cannot be rewritten later.
create or replace function public.office_vault_secret_document_integrity()
returns trigger language plpgsql security invoker set search_path=public as $
begin
 if row(new.owner_user_id,new.title,new.classification,new.created_at)
   is distinct from row(old.owner_user_id,old.title,old.classification,old.created_at)
 then raise exception 'Sealed document custody and classification are immutable'; end if;
 if new.state<>old.state and not(old.state='ACTIVE' and new.state='RETIRED')
 then raise exception 'Sealed document retirement is one-way'; end if;
 return new;
end; $;
revoke all on function public.office_vault_secret_document_integrity() from public,anon,authenticated;
grant execute on function public.office_vault_secret_document_integrity() to service_role;
drop trigger if exists office_vault_secret_document_no_rewrite on public.office_vault_secret_documents;
create trigger office_vault_secret_document_no_rewrite before update
 on public.office_vault_secret_documents for each row
 execute function public.office_vault_secret_document_integrity();

create or replace function public.office_vault_secret_version_immutability()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if row(
  new.document_id,new.version_number,new.uploaded_by,new.filename,new.mime_type,
  new.byte_size,new.sha256,new.sealed_path,new.key_id,new.wrapped_key,
  new.wrap_nonce,new.wrap_tag,new.content_nonce,new.content_tag
 ) is distinct from row(
  old.document_id,old.version_number,old.uploaded_by,old.filename,old.mime_type,
  old.byte_size,old.sha256,old.sealed_path,old.key_id,old.wrapped_key,
  old.wrap_nonce,old.wrap_tag,old.content_nonce,old.content_tag
 ) then raise exception 'Sealed version evidence is immutable'; end if;
 if old.scan_state<>'QUARANTINED' and new.scan_state is distinct from old.scan_state
 then raise exception 'A scanner verdict is immutable'; end if;
 if old.review_state<>'PENDING' and new.review_state is distinct from old.review_state
 then raise exception 'Reviewed evidence is immutable'; end if;
 return new;
end; $$;
revoke all on function public.office_vault_secret_version_immutability() from public,anon,authenticated;
grant execute on function public.office_vault_secret_version_immutability() to service_role;
drop trigger if exists office_vault_secret_version_no_overwrite on public.office_vault_secret_versions;
create trigger office_vault_secret_version_no_overwrite before update
 on public.office_vault_secret_versions for each row
 execute function public.office_vault_secret_version_immutability();

create or replace function public.office_vault_secret_register(
 p_actor uuid,p_document uuid,p_version uuid,p_title text,p_classification text,
 p_filename text,p_mime text,p_size bigint,p_sha text,p_path text,p_key_id text,
 p_wrapped_key text,p_wrap_nonce text,p_wrap_tag text,p_content_nonce text,p_content_tag text
) returns uuid language plpgsql security invoker set search_path=public as $$
declare v_document uuid;v_owner uuid;v_number integer;
begin
 if p_actor is null or not exists(select 1 from public.office_identity_users
   where user_id=p_actor and status='ACTIVE')
 or not public.office_effective_permission(p_actor,'vault.secret.upload','COMPANY',null,null)
 then raise exception 'Sealed document upload authority required'; end if;
 if p_document is null then raise exception 'A controlled document identifier is required'; end if;
 v_document:=p_document;
 select owner_user_id into v_owner from public.office_vault_secret_documents
  where id=v_document and state='ACTIVE' for update;
 if v_owner is null then
   insert into public.office_vault_secret_documents(id,owner_user_id,title,classification)
   values(v_document,p_actor,trim(p_title),p_classification);
 elsif v_owner<>p_actor then
   raise exception 'Only the original document custodian may submit a new version';
 end if;
 select coalesce(max(version_number),0)+1 into v_number
   from public.office_vault_secret_versions where document_id=v_document;
 if p_path<>v_document::text||'/'||p_version::text||'.sealed'
 then raise exception 'Sealed object location is not canonical'; end if;
 insert into public.office_vault_secret_versions(
  id,document_id,version_number,uploaded_by,filename,mime_type,
  byte_size,sha256,sealed_path,key_id,wrapped_key,wrap_nonce,wrap_tag,
  content_nonce,content_tag
 )values(p_version,v_document,v_number,p_actor,p_filename,p_mime,
  p_size,p_sha,p_path,p_key_id,p_wrapped_key,p_wrap_nonce,p_wrap_tag,
  p_content_nonce,p_content_tag);
 update public.office_vault_secret_documents set updated_at=now() where id=v_document;
 insert into public.office_vault_secret_events(document_id,version_id,actor_user_id,event_type)
 values(v_document,p_version,p_actor,'SEALED');
 return v_document;
end; $$;

create or replace function public.office_vault_secret_scan_result(
 p_actor uuid,p_version uuid,p_sha text,p_clean boolean
) returns text language plpgsql security invoker set search_path=public as $$
declare v public.office_vault_secret_versions%rowtype;
begin
 select * into v from public.office_vault_secret_versions where id=p_version for update;
 if v.id is null or v.uploaded_by<>p_actor or v.scan_state<>'QUARANTINED'
  or v.sha256 is distinct from p_sha
 then raise exception 'Quarantined matching upload unavailable'; end if;
 update public.office_vault_secret_versions
  set scan_state=case when p_clean then 'CLEAN' else 'BLOCKED' end,scanner_at=now()
  where id=p_version;
 insert into public.office_vault_secret_events(document_id,version_id,actor_user_id,event_type)
 values(v.document_id,v.id,p_actor,case when p_clean then 'SCAN_CLEAN' else 'SCAN_BLOCKED' end);
 return case when p_clean then 'CLEAN' else 'BLOCKED' end;
end; $$;

create or replace function public.office_vault_secret_review(
 p_actor uuid,p_version uuid,p_approve boolean,p_note text
) returns text language plpgsql security invoker set search_path=public as $$
declare v public.office_vault_secret_versions%rowtype;
begin
 select * into v from public.office_vault_secret_versions where id=p_version for update;
 if v.id is null or v.review_state<>'PENDING'
 then raise exception 'Pending sealed version unavailable'; end if;
 if p_actor=v.uploaded_by or p_actor is null or not exists(
   select 1 from public.office_identity_users where user_id=p_actor and status='ACTIVE')
 or not public.office_effective_permission(p_actor,'vault.secret.review','COMPANY',null,null)
 then raise exception 'Independent approved reviewer required'; end if;
 if p_approve and v.scan_state<>'CLEAN'
 then raise exception 'Scanner-clean result is required before approval'; end if;
 if length(trim(coalesce(p_note,'')))<12
 then raise exception 'A recorded independent evidence rationale is required'; end if;
 update public.office_vault_secret_versions set
  review_state=case when p_approve then 'APPROVED' else 'REJECTED' end,
  reviewed_by=p_actor,reviewed_at=now(),review_note=trim(p_note)
 where id=v.id;
 insert into public.office_vault_secret_events(document_id,version_id,actor_user_id,event_type)
 values(v.document_id,v.id,p_actor,case when p_approve then 'APPROVED' else 'REJECTED' end);
 return case when p_approve then 'APPROVED' else 'REJECTED' end;
end; $$;

revoke all on function public.office_vault_secret_register(
 uuid,uuid,uuid,text,text,text,text,bigint,text,text,text,text,text,text,text,text)
 from public,anon,authenticated;
revoke all on function public.office_vault_secret_scan_result(uuid,uuid,text,boolean)
 from public,anon,authenticated;
revoke all on function public.office_vault_secret_review(uuid,uuid,boolean,text)
 from public,anon,authenticated;
grant execute on function public.office_vault_secret_register(
 uuid,uuid,uuid,text,text,text,text,bigint,text,text,text,text,text,text,text,text)
 to service_role;
grant execute on function public.office_vault_secret_scan_result(uuid,uuid,text,boolean)
 to service_role;
grant execute on function public.office_vault_secret_review(uuid,uuid,boolean,text)
 to service_role;

alter table public.office_vault_access_requests
 drop constraint if exists office_vault_access_requests_category_slug_check;
alter table public.office_vault_access_requests
 add constraint office_vault_access_requests_category_slug_check
 check(category_slug in ('identity','registrations','banking','legal','people',
  'technology','documents','custody','secrets'));

-- Update existing independently reviewed Vault request/grant RPCs to recognize
-- the new sealed-file category. All other source categories keep their existing
-- semantics and independent maker-checker requirements.

create or replace function public.office_vault_source_review_permission(p_category text)
returns text language sql immutable set search_path=public as $$
 select case p_category
 when 'identity' then 'registration.review'
 when 'registrations' then 'registration.review'
 when 'banking' then 'finance.bank.read'
 when 'legal' then 'legal.contract.review'
 when 'people' then 'people.sensitive.read'
 when 'technology' then 'operations.asset.manage'
 when 'documents' then 'document.instance.review'
 when 'custody' then 'custody.review'
 when 'secrets' then 'vault.secret.review'
 else null end;
$$;

create or replace function public.office_vault_request_access(
 p_actor uuid,p_category text,p_resource uuid,p_action text,p_justification text,p_until timestamptz
) returns uuid language plpgsql security invoker set search_path=public as $$
declare v_id uuid;
begin
 if p_actor is null or not exists(select 1 from public.office_identity_users
   where user_id=p_actor and status='ACTIVE') then raise exception 'Active Office identity required'; end if;
 if public.office_vault_source_review_permission(p_category) is null
   or p_action not in ('READ','PREVIEW','DOWNLOAD')
   or length(trim(coalesce(p_justification,''))) not between 15 and 500
   or p_until is null or p_until<=now() or p_until>now()+interval '90 days'
 then raise exception 'Invalid access request scope or expiry'; end if;
 if p_resource is not null and p_category not in ('identity','registrations','documents','custody','secrets') then
   raise exception 'Per-record scope is not supported for this category';
 end if;
 -- Intentionally do not resolve record titles or existence to the requester.
 insert into public.office_vault_access_requests(
 requester_user_id,category_slug,resource_id,action,justification,requested_until
 ) values(p_actor,p_category,p_resource,p_action,trim(p_justification),p_until)
 returning id into v_id;
 insert into public.office_vault_access_events(request_id,actor_user_id,event_type,category_slug,resource_id)
 values(v_id,p_actor,'REQUESTED',p_category,p_resource);
 return v_id;
end; $$;

create or replace function public.office_vault_review_access(
 p_actor uuid,p_request uuid,p_approve boolean,p_note text
) returns text language plpgsql security invoker set search_path=public as $$
declare r public.office_vault_access_requests%rowtype; v_grant uuid;
begin
 select * into r from public.office_vault_access_requests where id=p_request for update;
 if r.id is null or r.status<>'PENDING' then raise exception 'Pending request unavailable'; end if;
 if p_actor is null or p_actor=r.requester_user_id or not exists(
   select 1 from public.office_identity_users where user_id=p_actor and status='ACTIVE'
 ) then raise exception 'An independent active reviewer is required'; end if;
 if not public.office_effective_permission(p_actor,'access.profile.assign','COMPANY',null,null)
   or not public.office_effective_permission(p_actor,
     public.office_vault_source_review_permission(r.category_slug),'COMPANY',null,null)
 then raise exception 'Independent source and access-review authority required'; end if;
 if p_approve and r.requested_until<=now() then raise exception 'Expired request cannot be granted'; end if;
 if not p_approve and length(trim(coalesce(p_note,'')))<10 then
   raise exception 'Denial reason must contain at least 10 characters'; end if;
 -- Validate the requested source record without displaying confidential labels.
 if p_approve and r.resource_id is not null then
   if r.category_slug in ('identity','registrations') then
     if not exists(select 1 from public.office_company_registrations where id=r.resource_id) then
       raise exception 'Requested source record is unavailable'; end if;
   elsif r.category_slug='documents' then
     if not exists(select 1 from public.office_document_instances where id=r.resource_id) then
       raise exception 'Requested source record is unavailable'; end if;
   elsif r.category_slug='custody' then
     if not exists(select 1 from public.office_secure_custody_items where id=r.resource_id) then
       raise exception 'Requested source record is unavailable'; end if;
   elsif r.category_slug='secrets' then
     if not exists(select 1 from public.office_vault_secret_documents where id=r.resource_id and state='ACTIVE') then
       raise exception 'Requested source record is unavailable'; end if;
   else raise exception 'Source record cannot be verified'; end if;
 end if;
 update public.office_vault_access_requests
 set status=case when p_approve then 'APPROVED' else 'DENIED' end,
   reviewer_user_id=p_actor,review_note=nullif(trim(coalesce(p_note,'')),''),
   decided_at=now()
 where id=r.id;
 if p_approve then
   insert into public.office_vault_access_grants(
    request_id,grantee_user_id,category_slug,resource_id,action,expires_at,granted_by
   ) values(r.id,r.requester_user_id,r.category_slug,r.resource_id,r.action,r.requested_until,p_actor)
   returning id into v_grant;
 end if;
 insert into public.office_vault_access_events(
  request_id,grant_id,actor_user_id,event_type,category_slug,resource_id
 ) values(r.id,v_grant,p_actor,case when p_approve then 'APPROVED' else 'DENIED' end,r.category_slug,r.resource_id);
 return case when p_approve then 'APPROVED' else 'DENIED' end;
end; $$;

comment on table public.office_vault_secret_versions is
 'Immutable client-inaccessible sealed file versions. Scanner clean and independent approval are mandatory; additional per-record grants never override canonical IAM.';
