-- KRAVIA Office OS — Vendor Assurance + Customer Trust Center.
-- Existing vendors/customers remain canonical in the core schema.
-- This layer stores governed assessments/requests and evidence references; it does not fabricate certifications.

insert into public.office_permission_catalog(code,module,action,label,description,sensitivity,high_risk,requires_managed_device,active) values
 ('vendor.assurance.read','PROCUREMENT','READ_VENDOR_ASSURANCE','Read vendor assurance','Read vendor security/privacy/legal/continuity assurance within authorised scope.','SENSITIVE',false,true,true),
 ('vendor.assurance.manage','PROCUREMENT','MANAGE_VENDOR_ASSURANCE','Manage vendor assurance','Create vendor assurance assessments and remediation work without independently approving own assessment.','HIGH',true,true,true),
 ('vendor.assurance.review','PROCUREMENT','REVIEW_VENDOR_ASSURANCE','Review vendor assurance','Independently approve/reject vendor assurance assessments with evidence and expiry.','CRITICAL',true,true,true),
 ('customer.trust.read','CUSTOMER_TRUST','READ_TRUST','Read customer trust requests','Read customer security/privacy/compliance trust requests within authorised scope.','SENSITIVE',false,true,true),
 ('customer.trust.manage','CUSTOMER_TRUST','MANAGE_TRUST','Manage customer trust requests','Create/update customer trust requests and response references without independently approving own response.','HIGH',true,true,true),
 ('customer.trust.review','CUSTOMER_TRUST','REVIEW_TRUST','Review customer trust response','Independently verify trust responses before they are marked ready/sent.','CRITICAL',true,true,true)
on conflict(code) do update set module=excluded.module,action=excluded.action,label=excluded.label,description=excluded.description,sensitivity=excluded.sensitivity,high_risk=excluded.high_risk,requires_managed_device=excluded.requires_managed_device,active=true;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type) values
 ('PROCUREMENT_USER','vendor.assurance.read','ALLOW','COMPANY'),
 ('PROCUREMENT_USER','vendor.assurance.manage','ALLOW','COMPANY'),
 ('OPERATIONS_MANAGER','vendor.assurance.read','ALLOW','COMPANY'),
 ('OPERATIONS_MANAGER','vendor.assurance.manage','ALLOW','COMPANY'),
 ('SECURITY_OPERATOR','vendor.assurance.read','ALLOW','COMPANY'),
 ('SECURITY_OPERATOR','vendor.assurance.review','ALLOW','COMPANY'),
 ('LEGAL_COUNSEL','vendor.assurance.read','ALLOW','COMPANY'),
 ('LEGAL_COUNSEL','vendor.assurance.review','ALLOW','COMPANY'),
 ('FINANCE_MANAGER','vendor.assurance.read','ALLOW','COMPANY'),
 ('FINANCE_MANAGER','vendor.assurance.review','ALLOW','COMPANY'),
 ('AUDITOR_READONLY','vendor.assurance.read','ALLOW','COMPANY'),
 ('SALES_USER','customer.trust.read','ALLOW','COMPANY'),
 ('SALES_USER','customer.trust.manage','ALLOW','COMPANY'),
 ('SALES_MANAGER','customer.trust.read','ALLOW','COMPANY'),
 ('SALES_MANAGER','customer.trust.manage','ALLOW','COMPANY'),
 ('SUPPORT_MANAGER','customer.trust.read','ALLOW','COMPANY'),
 ('SECURITY_OPERATOR','customer.trust.read','ALLOW','COMPANY'),
 ('SECURITY_OPERATOR','customer.trust.review','ALLOW','COMPANY'),
 ('LEGAL_COUNSEL','customer.trust.read','ALLOW','COMPANY'),
 ('LEGAL_COUNSEL','customer.trust.review','ALLOW','COMPANY'),
 ('AUDITOR_READONLY','customer.trust.read','ALLOW','COMPANY')
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

create sequence if not exists public.office_vendor_assessment_seq;
create sequence if not exists public.office_customer_trust_seq;
grant usage,select on sequence public.office_vendor_assessment_seq,public.office_customer_trust_seq to service_role;

create table if not exists public.office_vendor_assessments(
 id uuid primary key default gen_random_uuid(),
 assessment_code text not null unique default ('KR-VAS-'||lpad(nextval('public.office_vendor_assessment_seq')::text,7,'0')),
 vendor_id varchar not null,
 assessment_type text not null check(assessment_type in ('SECURITY','PRIVACY','LEGAL','FINANCIAL','BUSINESS_CONTINUITY','AI','OTHER')),
 scope_summary text not null check(char_length(trim(scope_summary)) between 3 and 10000),
 risk_level text not null default 'MEDIUM' check(risk_level in ('LOW','MEDIUM','HIGH','CRITICAL')),
 evidence_reference text,
 remediation_summary text,
 owner_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 status text not null default 'DRAFT' check(status in ('DRAFT','SUBMITTED','APPROVED','REJECTED','EXPIRED','CANCELLED')),
 expires_on date,
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 reviewed_by uuid references public.office_identity_users(user_id) on delete restrict,
 reviewed_at timestamptz,
 review_note text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists office_vendor_assessment_vendor_idx on public.office_vendor_assessments(vendor_id,status,expires_on);
create index if not exists office_vendor_assessment_status_idx on public.office_vendor_assessments(status,risk_level,expires_on);

create table if not exists public.office_customer_trust_requests(
 id uuid primary key default gen_random_uuid(),
 trust_code text not null unique default ('KR-CTR-'||lpad(nextval('public.office_customer_trust_seq')::text,7,'0')),
 customer_id varchar not null,
 request_type text not null check(request_type in ('SECURITY_QUESTIONNAIRE','DPA','COMPLIANCE_EVIDENCE','PEN_TEST','SLA','SUBPROCESSOR','ARCHITECTURE','PRIVACY','OTHER')),
 title text not null check(char_length(trim(title)) between 3 and 220),
 request_summary text not null check(char_length(trim(request_summary)) between 3 and 12000),
 owner_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 due_at timestamptz,
 status text not null default 'OPEN' check(status in ('OPEN','IN_PROGRESS','AWAITING_REVIEW','READY','SENT','CLOSED','REJECTED','CANCELLED')),
 response_reference text,
 evidence_reference text,
 sent_reference text,
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 reviewed_by uuid references public.office_identity_users(user_id) on delete restrict,
 reviewed_at timestamptz,
 review_note text,
 sent_at timestamptz,
 closed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists office_customer_trust_customer_idx on public.office_customer_trust_requests(customer_id,status,due_at);
create index if not exists office_customer_trust_owner_idx on public.office_customer_trust_requests(owner_user_id,status,due_at);

create table if not exists public.office_trust_events(
 id bigint generated always as identity primary key,
 actor_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 vendor_assessment_id uuid references public.office_vendor_assessments(id) on delete restrict,
 customer_trust_id uuid references public.office_customer_trust_requests(id) on delete restrict,
 event_type text not null,
 previous_status text,
 new_status text,
 note text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

alter table public.office_vendor_assessments enable row level security;
alter table public.office_customer_trust_requests enable row level security;
alter table public.office_trust_events enable row level security;
revoke all on public.office_vendor_assessments,public.office_customer_trust_requests,public.office_trust_events from public,anon,authenticated;
grant select,insert,update on public.office_vendor_assessments,public.office_customer_trust_requests to service_role;
grant select,insert on public.office_trust_events to service_role;

create or replace function public.office_vendor_assessment_create(
 p_actor uuid,p_vendor varchar,p_type text,p_scope text,p_risk text,p_evidence text,p_remediation text,p_owner uuid,p_expires date
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not public.office_effective_permission(p_actor,'vendor.assurance.manage','COMPANY',null,null) then raise exception 'Vendor-assurance management permission is required'; end if;
 if not exists(select 1 from public.vendors where id=p_vendor) then raise exception 'Canonical vendor not found'; end if;
 if not exists(select 1 from public.office_identity_users where user_id=p_owner and status='ACTIVE') then raise exception 'Active assessment owner is required'; end if;
 insert into public.office_vendor_assessments(vendor_id,assessment_type,scope_summary,risk_level,evidence_reference,remediation_summary,owner_user_id,expires_on,created_by)
 values(p_vendor,upper(trim(p_type)),trim(p_scope),upper(trim(p_risk)),nullif(trim(coalesce(p_evidence,'')),''),nullif(trim(coalesce(p_remediation,'')),''),p_owner,p_expires,p_actor)
 returning id into v_id;
 insert into public.office_trust_events(actor_user_id,vendor_assessment_id,event_type,new_status) values(p_actor,v_id,'VENDOR_ASSESSMENT_CREATED','DRAFT');
 return v_id;
end; $$;

create or replace function public.office_vendor_assessment_transition(
 p_actor uuid,p_assessment uuid,p_status text,p_evidence text,p_remediation text,p_expires date,p_note text
) returns text language plpgsql security definer set search_path='' as $$
declare a public.office_vendor_assessments%rowtype; target text:=upper(trim(p_status)); review boolean;
begin
 select * into a from public.office_vendor_assessments where id=p_assessment for update;
 if a.id is null then raise exception 'Vendor assessment not found'; end if;
 review:=target in ('APPROVED','REJECTED');
 if review then
  if not public.office_effective_permission(p_actor,'vendor.assurance.review','COMPANY',null,null) then raise exception 'Independent vendor-assurance review permission is required'; end if;
  if p_actor=a.owner_user_id or p_actor=a.created_by then raise exception 'Assessment owner/creator cannot independently review the same vendor assessment'; end if;
 else
  if not public.office_effective_permission(p_actor,'vendor.assurance.manage','COMPANY',null,null) and p_actor<>a.owner_user_id then raise exception 'Vendor-assurance management permission is required'; end if;
 end if;
 if a.status='DRAFT' and target<>'SUBMITTED' then raise exception 'Draft assessment must be submitted'; end if;
 if a.status='SUBMITTED' and target not in ('APPROVED','REJECTED') then raise exception 'Submitted assessment must be approved or rejected'; end if;
 if a.status='APPROVED' and target<>'EXPIRED' then raise exception 'Approved assessment may only expire'; end if;
 if a.status in ('REJECTED','EXPIRED','CANCELLED') then raise exception 'Finalized assessment cannot transition'; end if;
 if target='APPROVED' and (nullif(trim(coalesce(p_evidence,a.evidence_reference,'')),'') is null or p_expires is null or p_expires<=current_date) then raise exception 'Approval requires evidence and future expiry'; end if;
 update public.office_vendor_assessments
 set status=target,
     evidence_reference=coalesce(nullif(trim(coalesce(p_evidence,'')),''),evidence_reference),
     remediation_summary=coalesce(nullif(trim(coalesce(p_remediation,'')),''),remediation_summary),
     expires_on=case when target='APPROVED' then p_expires else expires_on end,
     reviewed_by=case when review then p_actor else reviewed_by end,
     reviewed_at=case when review then now() else reviewed_at end,
     review_note=coalesce(nullif(trim(coalesce(p_note,'')),''),review_note),
     updated_at=now()
 where id=a.id;
 insert into public.office_trust_events(actor_user_id,vendor_assessment_id,event_type,previous_status,new_status,note)
 values(p_actor,a.id,'VENDOR_ASSESSMENT_TRANSITION',a.status,target,left(p_note,2000));
 return target;
end; $$;

create or replace function public.office_customer_trust_create(
 p_actor uuid,p_customer varchar,p_type text,p_title text,p_summary text,p_owner uuid,p_due timestamptz
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not public.office_effective_permission(p_actor,'customer.trust.manage','COMPANY',null,null) then raise exception 'Customer-trust management permission is required'; end if;
 if not exists(select 1 from public.customers where id=p_customer) then raise exception 'Canonical customer not found'; end if;
 if not exists(select 1 from public.office_identity_users where user_id=p_owner and status='ACTIVE') then raise exception 'Active trust-request owner is required'; end if;
 insert into public.office_customer_trust_requests(customer_id,request_type,title,request_summary,owner_user_id,due_at,created_by)
 values(p_customer,upper(trim(p_type)),trim(p_title),trim(p_summary),p_owner,p_due,p_actor) returning id into v_id;
 insert into public.office_trust_events(actor_user_id,customer_trust_id,event_type,new_status) values(p_actor,v_id,'CUSTOMER_TRUST_CREATED','OPEN');
 return v_id;
end; $$;

create or replace function public.office_customer_trust_prepare(
 p_actor uuid,p_trust uuid,p_status text,p_response text,p_evidence text,p_note text
) returns text language plpgsql security definer set search_path='' as $$
declare t public.office_customer_trust_requests%rowtype; target text:=upper(trim(p_status));
begin
 select * into t from public.office_customer_trust_requests where id=p_trust for update;
 if t.id is null then raise exception 'Customer-trust request not found'; end if;
 if not public.office_effective_permission(p_actor,'customer.trust.manage','COMPANY',null,null) and p_actor<>t.owner_user_id then raise exception 'Customer-trust management permission is required'; end if;
 if p_actor<>t.owner_user_id and p_actor<>t.created_by and not public.office_effective_permission(p_actor,'customer.trust.manage','COMPANY',null,null) then raise exception 'Trust request is outside actor authority'; end if;
 if t.status='OPEN' and target not in ('IN_PROGRESS','CANCELLED') then raise exception 'Open trust request must enter progress or cancel'; end if;
 if t.status='IN_PROGRESS' and target<>'AWAITING_REVIEW' then raise exception 'In-progress trust request must be submitted for independent review'; end if;
 if target='AWAITING_REVIEW' and (nullif(trim(coalesce(p_response,'')),'') is null or nullif(trim(coalesce(p_evidence,'')),'') is null) then raise exception 'Response and evidence references are required before review'; end if;
 update public.office_customer_trust_requests
 set status=target,response_reference=coalesce(nullif(trim(coalesce(p_response,'')),''),response_reference),evidence_reference=coalesce(nullif(trim(coalesce(p_evidence,'')),''),evidence_reference),updated_at=now()
 where id=t.id;
 insert into public.office_trust_events(actor_user_id,customer_trust_id,event_type,previous_status,new_status,note)
 values(p_actor,t.id,'CUSTOMER_TRUST_PREPARE',t.status,target,left(p_note,2000));
 return target;
end; $$;

create or replace function public.office_customer_trust_review(
 p_actor uuid,p_trust uuid,p_status text,p_note text
) returns text language plpgsql security definer set search_path='' as $$
declare t public.office_customer_trust_requests%rowtype; target text:=upper(trim(p_status));
begin
 if not public.office_effective_permission(p_actor,'customer.trust.review','COMPANY',null,null) then raise exception 'Independent customer-trust review permission is required'; end if;
 select * into t from public.office_customer_trust_requests where id=p_trust for update;
 if t.id is null or t.status<>'AWAITING_REVIEW' then raise exception 'Trust request awaiting independent review is required'; end if;
 if p_actor=t.owner_user_id or p_actor=t.created_by then raise exception 'Trust-request owner/creator cannot independently review the same response'; end if;
 if target not in ('READY','REJECTED') then raise exception 'Invalid trust-review decision'; end if;
 if target='READY' and (t.response_reference is null or t.evidence_reference is null) then raise exception 'Response and evidence references are required'; end if;
 update public.office_customer_trust_requests set status=target,reviewed_by=p_actor,reviewed_at=now(),review_note=nullif(trim(coalesce(p_note,'')),''),updated_at=now() where id=t.id;
 insert into public.office_trust_events(actor_user_id,customer_trust_id,event_type,previous_status,new_status,note)
 values(p_actor,t.id,'CUSTOMER_TRUST_REVIEW',t.status,target,left(p_note,2000));
 return target;
end; $$;

create or replace function public.office_customer_trust_send(
 p_actor uuid,p_trust uuid,p_sent_reference text
) returns text language plpgsql security definer set search_path='' as $$
declare t public.office_customer_trust_requests%rowtype;
begin
 select * into t from public.office_customer_trust_requests where id=p_trust for update;
 if t.id is null or t.status<>'READY' then raise exception 'Reviewed ready trust response is required'; end if;
 if not public.office_effective_permission(p_actor,'customer.trust.manage','COMPANY',null,null) and p_actor<>t.owner_user_id then raise exception 'Customer-trust management permission is required'; end if;
 if nullif(trim(coalesce(p_sent_reference,'')),'') is null then raise exception 'External delivery/reference evidence is required'; end if;
 update public.office_customer_trust_requests set status='SENT',sent_reference=trim(p_sent_reference),sent_at=now(),updated_at=now() where id=t.id;
 insert into public.office_trust_events(actor_user_id,customer_trust_id,event_type,previous_status,new_status,metadata)
 values(p_actor,t.id,'CUSTOMER_TRUST_SENT',t.status,'SENT',jsonb_build_object('sent_reference',trim(p_sent_reference)));
 return 'SENT';
end; $$;

create or replace function public.office_customer_trust_close(
 p_actor uuid,p_trust uuid,p_note text
) returns text language plpgsql security definer set search_path='' as $$
declare t public.office_customer_trust_requests%rowtype;
begin
 select * into t from public.office_customer_trust_requests where id=p_trust for update;
 if t.id is null or t.status<>'SENT' then raise exception 'Sent trust response is required before closure'; end if;
 if not public.office_effective_permission(p_actor,'customer.trust.manage','COMPANY',null,null) and p_actor<>t.owner_user_id then raise exception 'Customer-trust management permission is required'; end if;
 update public.office_customer_trust_requests set status='CLOSED',closed_at=now(),updated_at=now() where id=t.id;
 insert into public.office_trust_events(actor_user_id,customer_trust_id,event_type,previous_status,new_status,note)
 values(p_actor,t.id,'CUSTOMER_TRUST_CLOSED',t.status,'CLOSED',left(p_note,2000));
 return 'CLOSED';
end; $$;

revoke all on function public.office_vendor_assessment_create(uuid,varchar,text,text,text,text,text,uuid,date) from public,anon,authenticated;
revoke all on function public.office_vendor_assessment_transition(uuid,uuid,text,text,text,date,text) from public,anon,authenticated;
revoke all on function public.office_customer_trust_create(uuid,varchar,text,text,text,uuid,timestamptz) from public,anon,authenticated;
revoke all on function public.office_customer_trust_prepare(uuid,uuid,text,text,text,text) from public,anon,authenticated;
revoke all on function public.office_customer_trust_review(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.office_customer_trust_send(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.office_customer_trust_close(uuid,uuid,text) from public,anon,authenticated;

grant execute on function public.office_vendor_assessment_create(uuid,varchar,text,text,text,text,text,uuid,date) to service_role;
grant execute on function public.office_vendor_assessment_transition(uuid,uuid,text,text,text,date,text) to service_role;
grant execute on function public.office_customer_trust_create(uuid,varchar,text,text,text,uuid,timestamptz) to service_role;
grant execute on function public.office_customer_trust_prepare(uuid,uuid,text,text,text,text) to service_role;
grant execute on function public.office_customer_trust_review(uuid,uuid,text,text) to service_role;
grant execute on function public.office_customer_trust_send(uuid,uuid,text) to service_role;
grant execute on function public.office_customer_trust_close(uuid,uuid,text) to service_role;
