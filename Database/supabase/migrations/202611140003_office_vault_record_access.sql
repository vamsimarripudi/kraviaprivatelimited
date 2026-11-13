-- KRAVIA Office 5.0 K-Vault: auditable additional record-level access overlay.
-- These grants never bypass canonical Office permissions or source-system checks.
-- Apply only after isolated migration rehearsal and explicit production approval.
create table if not exists public.office_vault_access_requests(
 id uuid primary key default gen_random_uuid(),
 requester_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 category_slug text not null check(category_slug in ('identity','registrations','banking','legal','people','technology','documents','custody')),
 resource_id uuid,
 action text not null check(action in ('READ','PREVIEW','DOWNLOAD')),
 justification text not null check(char_length(trim(justification)) between 15 and 500),
 requested_until timestamptz not null,
 status text not null default 'PENDING' check(status in ('PENDING','APPROVED','DENIED','WITHDRAWN')),
 reviewer_user_id uuid references public.office_identity_users(user_id) on delete restrict,
 review_note text,
 decided_at timestamptz,
 created_at timestamptz not null default now(),
 constraint office_vault_request_pending_review check(
  (status='PENDING' and reviewer_user_id is null and decided_at is null)
  or (status<>'PENDING' and decided_at is not null)
 )
);
create index if not exists office_vault_requests_own_idx
 on public.office_vault_access_requests(requester_user_id,created_at desc);
create index if not exists office_vault_requests_pending_idx
 on public.office_vault_access_requests(status,category_slug,created_at);

create table if not exists public.office_vault_access_grants(
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null unique references public.office_vault_access_requests(id) on delete restrict,
 grantee_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 category_slug text not null,
 resource_id uuid,
 action text not null check(action in ('READ','PREVIEW','DOWNLOAD')),
 expires_at timestamptz not null,
 granted_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 granted_at timestamptz not null default now(),
 revoked_by uuid references public.office_identity_users(user_id) on delete restrict,
 revoked_at timestamptz,
 revoke_reason text,
 constraint office_vault_grant_revoked_by check((revoked_at is null and revoked_by is null) or
  (revoked_at is not null and revoked_by is not null))
);
create index if not exists office_vault_grants_active_idx
 on public.office_vault_access_grants(grantee_user_id,category_slug,expires_at)
 where revoked_at is null;

create table if not exists public.office_vault_access_events(
 id bigint generated always as identity primary key,
 request_id uuid references public.office_vault_access_requests(id) on delete restrict,
 grant_id uuid references public.office_vault_access_grants(id) on delete restrict,
 actor_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 event_type text not null check(event_type in ('REQUESTED','APPROVED','DENIED','WITHDRAWN','REVOKED','RECORD_READ','DOCUMENT_DOWNLOAD')),
 category_slug text not null,
 resource_id uuid,
 occurred_at timestamptz not null default now()
);
create index if not exists office_vault_events_actor_idx
 on public.office_vault_access_events(actor_user_id,occurred_at desc);
create index if not exists office_vault_events_source_idx
 on public.office_vault_access_events(category_slug,resource_id,occurred_at desc);

alter table public.office_vault_access_requests enable row level security;
alter table public.office_vault_access_grants enable row level security;
alter table public.office_vault_access_events enable row level security;
revoke all on public.office_vault_access_requests,
 public.office_vault_access_grants,public.office_vault_access_events from public,anon,authenticated;
grant select,insert,update on public.office_vault_access_requests,public.office_vault_access_grants to service_role;
grant select,insert on public.office_vault_access_events to service_role;
grant usage,select on sequence public.office_vault_access_events_id_seq to service_role;

-- Anonymous/browser code is never allowed to invoke these identity-bound RPCs.
-- All request decisions must also pass canonical access.profile.assign and
-- a category-specific source reviewer capability, and cannot approve self.
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
 if p_resource is not null and p_category not in ('identity','registrations','documents','custody') then
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

create or replace function public.office_vault_revoke_access(
 p_actor uuid,p_grant uuid,p_reason text
) returns boolean language plpgsql security invoker set search_path=public as $$
declare g public.office_vault_access_grants%rowtype;
begin
 select * into g from public.office_vault_access_grants where id=p_grant for update;
 if g.id is null or g.revoked_at is not null then raise exception 'Current grant unavailable'; end if;
 if not exists(select 1 from public.office_identity_users where user_id=p_actor and status='ACTIVE')
 or not public.office_effective_permission(p_actor,'access.profile.assign','COMPANY',null,null)
 or not public.office_effective_permission(p_actor,
   public.office_vault_source_review_permission(g.category_slug),'COMPANY',null,null)
 then raise exception 'Access revocation authority required'; end if;
 if length(trim(coalesce(p_reason,'')))<10 then raise exception 'Revocation rationale required'; end if;
 update public.office_vault_access_grants set revoked_at=now(),revoked_by=p_actor,
   revoke_reason=trim(p_reason) where id=g.id;
 insert into public.office_vault_access_events(
  request_id,grant_id,actor_user_id,event_type,category_slug,resource_id
 ) values(g.request_id,g.id,p_actor,'REVOKED',g.category_slug,g.resource_id);
 return true;
end; $$;

revoke all on function public.office_vault_source_review_permission(text) from public,anon,authenticated;
revoke all on function public.office_vault_request_access(uuid,text,uuid,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.office_vault_review_access(uuid,uuid,boolean,text) from public,anon,authenticated;
revoke all on function public.office_vault_revoke_access(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.office_vault_source_review_permission(text) to service_role;
grant execute on function public.office_vault_request_access(uuid,text,uuid,text,text,timestamptz) to service_role;
grant execute on function public.office_vault_review_access(uuid,uuid,boolean,text) to service_role;
grant execute on function public.office_vault_revoke_access(uuid,uuid,text) to service_role;
comment on table public.office_vault_access_grants is
 'Additional revocable scoped Vault capability; NEVER supersedes canonical Office identity, department ownership, MFA, source record or action permissions.';
