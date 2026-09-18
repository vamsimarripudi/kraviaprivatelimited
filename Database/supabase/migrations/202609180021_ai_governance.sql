-- KRAVIA Office OS — AI governance and approved-tool control.
-- No raw prompt or raw model-output column is stored in the governance ledger.
-- Approved use does not itself invoke an external AI provider.

insert into public.office_permission_catalog(code,module,action,label,description,sensitivity,high_risk,requires_managed_device,active) values
 ('ai.tool.read','AI_GOVERNANCE','READ_TOOL','Read approved AI tools','Read AI provider/tool governance records and approved data boundaries.','STANDARD',false,false,true),
 ('ai.tool.manage','AI_GOVERNANCE','MANAGE_TOOL','Manage AI tool review','Create and submit AI provider/tool assessments without independently approving own submission.','HIGH',true,true,true),
 ('ai.tool.review','AI_GOVERNANCE','REVIEW_TOOL','Review AI tool','Independently approve, reject or retire AI provider/tool records.','CRITICAL',true,true,true),
 ('ai.use.request','AI_GOVERNANCE','REQUEST_USE','Request AI use case','Request an approved AI use case for the actor''s own work.','STANDARD',false,false,true),
 ('ai.use.read','AI_GOVERNANCE','READ_USE','Read AI use cases','Read own or authorised AI use-case decisions.','SENSITIVE',false,true,true),
 ('ai.use.review','AI_GOVERNANCE','REVIEW_USE','Review AI use case','Independently approve/reject scoped AI use cases and expiry.','HIGH',true,true,true),
 ('ai.usage.audit','AI_GOVERNANCE','AUDIT_USAGE','Audit AI usage metadata','Read approved AI usage metadata without raw prompt/output content.','CRITICAL',true,true,true)
on conflict(code) do update set module=excluded.module,action=excluded.action,label=excluded.label,description=excluded.description,sensitivity=excluded.sensitivity,high_risk=excluded.high_risk,requires_managed_device=excluded.requires_managed_device,active=true;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type)
select code,'ai.tool.read','ALLOW','COMPANY' from public.office_access_profile_catalog
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;
insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type)
select code,'ai.use.request','ALLOW','OWN' from public.office_access_profile_catalog
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;
insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type)
select code,'ai.use.read','ALLOW','OWN' from public.office_access_profile_catalog
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type) values
 ('SECURITY_OPERATOR','ai.tool.read','ALLOW','COMPANY'),
 ('SECURITY_OPERATOR','ai.tool.manage','ALLOW','COMPANY'),
 ('SECURITY_OPERATOR','ai.tool.review','ALLOW','COMPANY'),
 ('SECURITY_OPERATOR','ai.use.read','ALLOW','COMPANY'),
 ('SECURITY_OPERATOR','ai.use.review','ALLOW','COMPANY'),
 ('SECURITY_OPERATOR','ai.usage.audit','ALLOW','COMPANY'),
 ('LEGAL_COUNSEL','ai.tool.read','ALLOW','COMPANY'),
 ('LEGAL_COUNSEL','ai.tool.review','ALLOW','COMPANY'),
 ('LEGAL_COUNSEL','ai.use.read','ALLOW','COMPANY'),
 ('LEGAL_COUNSEL','ai.use.review','ALLOW','COMPANY'),
 ('RISK_MANAGER','ai.tool.read','ALLOW','COMPANY'),
 ('RISK_MANAGER','ai.tool.review','ALLOW','COMPANY'),
 ('RISK_MANAGER','ai.use.read','ALLOW','COMPANY'),
 ('RISK_MANAGER','ai.use.review','ALLOW','COMPANY'),
 ('AUDITOR_READONLY','ai.tool.read','ALLOW','COMPANY'),
 ('AUDITOR_READONLY','ai.use.read','ALLOW','COMPANY'),
 ('AUDITOR_READONLY','ai.usage.audit','ALLOW','COMPANY'),
 ('OPERATIONS_MANAGER','ai.tool.manage','ALLOW','COMPANY'),
 ('OPERATIONS_MANAGER','ai.use.read','ALLOW','DEPARTMENT'),
 ('PRODUCT_MANAGER','ai.tool.manage','ALLOW','COMPANY'),
 ('PRODUCT_MANAGER','ai.use.read','ALLOW','DEPARTMENT')
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

create sequence if not exists public.office_ai_tool_seq;
create sequence if not exists public.office_ai_use_seq;
grant usage,select on sequence public.office_ai_tool_seq,public.office_ai_use_seq to service_role;

create table if not exists public.office_ai_tools(
 id uuid primary key default gen_random_uuid(),
 tool_code text not null unique default ('KR-AIT-'||lpad(nextval('public.office_ai_tool_seq')::text,6,'0')),
 provider_name text not null check(char_length(trim(provider_name)) between 2 and 180),
 tool_name text not null check(char_length(trim(tool_name)) between 2 and 180),
 purpose text not null check(char_length(trim(purpose)) between 3 and 8000),
 external_service boolean not null default true,
 allowed_data_classes jsonb not null default '["PUBLIC","INTERNAL"]'::jsonb check(jsonb_typeof(allowed_data_classes)='array'),
 prohibited_data_classes jsonb not null default '[]'::jsonb check(jsonb_typeof(prohibited_data_classes)='array'),
 retention_policy text not null,
 provider_training_policy text not null,
 data_residency text,
 privacy_security_reference text,
 human_review_required boolean not null default true,
 status text not null default 'DRAFT' check(status in ('DRAFT','SUBMITTED','APPROVED','REJECTED','RETIRED')),
 owner_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 reviewed_by uuid references public.office_identity_users(user_id) on delete restrict,
 reviewed_at timestamptz,
 review_note text,
 expires_on date,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(provider_name,tool_name)
);
create index if not exists office_ai_tools_status_idx on public.office_ai_tools(status,expires_on,provider_name);

create table if not exists public.office_ai_use_cases(
 id uuid primary key default gen_random_uuid(),
 use_case_code text not null unique default ('KR-AIU-'||lpad(nextval('public.office_ai_use_seq')::text,7,'0')),
 requester_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 department_code text,
 tool_id uuid not null references public.office_ai_tools(id) on delete restrict,
 title text not null check(char_length(trim(title)) between 3 and 220),
 purpose text not null check(char_length(trim(purpose)) between 3 and 8000),
 intended_data_classes jsonb not null default '[]'::jsonb check(jsonb_typeof(intended_data_classes)='array'),
 action_mode text not null default 'DRAFT' check(action_mode in ('QUERY','ANALYZE','DRAFT','RECOMMENDATION','ACTION_PROPOSAL')),
 human_review_required boolean not null default true,
 status text not null default 'REQUESTED' check(status in ('REQUESTED','APPROVED','REJECTED','EXPIRED','CANCELLED')),
 reviewer_user_id uuid references public.office_identity_users(user_id) on delete restrict,
 reviewed_at timestamptz,
 review_note text,
 expires_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists office_ai_use_requester_idx on public.office_ai_use_cases(requester_user_id,status,expires_at);
create index if not exists office_ai_use_department_idx on public.office_ai_use_cases(department_code,status,expires_at);

create table if not exists public.office_ai_usage_events(
 id bigint generated always as identity primary key,
 use_case_id uuid not null references public.office_ai_use_cases(id) on delete restrict,
 actor_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 action_kind text not null check(action_kind in ('QUERY','ANALYZE','DRAFT','RECOMMENDATION','ACTION_PROPOSAL')),
 data_classes jsonb not null default '[]'::jsonb check(jsonb_typeof(data_classes)='array'),
 content_sha256 text check(content_sha256 is null or char_length(content_sha256)=64),
 provider_reference text,
 result_reference text,
 human_review_reference text,
 created_at timestamptz not null default now()
);
create index if not exists office_ai_usage_use_idx on public.office_ai_usage_events(use_case_id,created_at desc);
create index if not exists office_ai_usage_actor_idx on public.office_ai_usage_events(actor_user_id,created_at desc);

create table if not exists public.office_ai_governance_events(
 id bigint generated always as identity primary key,
 actor_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 tool_id uuid references public.office_ai_tools(id) on delete restrict,
 use_case_id uuid references public.office_ai_use_cases(id) on delete restrict,
 event_type text not null,
 previous_status text,
 new_status text,
 note text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

alter table public.office_ai_tools enable row level security;
alter table public.office_ai_use_cases enable row level security;
alter table public.office_ai_usage_events enable row level security;
alter table public.office_ai_governance_events enable row level security;
revoke all on public.office_ai_tools,public.office_ai_use_cases,public.office_ai_usage_events,public.office_ai_governance_events from public,anon,authenticated;
grant select,insert,update on public.office_ai_tools,public.office_ai_use_cases to service_role;
grant select,insert on public.office_ai_usage_events,public.office_ai_governance_events to service_role;

create or replace function public.office_ai_classes_allowed(p_requested jsonb,p_allowed jsonb,p_prohibited jsonb)
returns boolean
language sql
immutable
set search_path=''
as $$
 select
   jsonb_typeof(coalesce(p_requested,'[]'::jsonb))='array'
   and not exists(
     select 1
     from jsonb_array_elements_text(coalesce(p_requested,'[]'::jsonb)) r(value)
     where not exists(
       select 1 from jsonb_array_elements_text(coalesce(p_allowed,'[]'::jsonb)) a(value)
       where upper(a.value)=upper(r.value)
     )
   )
   and not exists(
     select 1
     from jsonb_array_elements_text(coalesce(p_requested,'[]'::jsonb)) r(value)
     join jsonb_array_elements_text(coalesce(p_prohibited,'[]'::jsonb)) p(value)
       on upper(p.value)=upper(r.value)
   );
$$;

create or replace function public.office_ai_tool_create(
 p_actor uuid,p_provider text,p_tool text,p_purpose text,p_external boolean,p_allowed jsonb,p_prohibited jsonb,p_retention text,p_training text,p_residency text,p_reference text,p_human_review boolean,p_owner uuid,p_expires date
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not public.office_effective_permission(p_actor,'ai.tool.manage','COMPANY',null,null) then raise exception 'AI tool management permission is required'; end if;
 if not exists(select 1 from public.office_identity_users where user_id=p_owner and status='ACTIVE') then raise exception 'Active AI tool owner is required'; end if;
 if jsonb_typeof(coalesce(p_allowed,'[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_allowed,'[]'::jsonb))=0 then raise exception 'At least one allowed data classification is required'; end if;
 if jsonb_typeof(coalesce(p_prohibited,'[]'::jsonb))<>'array' then raise exception 'Prohibited data classifications must be an array'; end if;
 if not public.office_ai_classes_allowed('[]'::jsonb,p_allowed,p_prohibited) then raise exception 'Invalid AI data-classification policy'; end if;
 insert into public.office_ai_tools(provider_name,tool_name,purpose,external_service,allowed_data_classes,prohibited_data_classes,retention_policy,provider_training_policy,data_residency,privacy_security_reference,human_review_required,owner_user_id,created_by,expires_on)
 values(trim(p_provider),trim(p_tool),trim(p_purpose),coalesce(p_external,true),coalesce(p_allowed,'[]'::jsonb),coalesce(p_prohibited,'[]'::jsonb),trim(p_retention),trim(p_training),nullif(trim(coalesce(p_residency,'')),''),nullif(trim(coalesce(p_reference,'')),''),coalesce(p_human_review,true),p_owner,p_actor,p_expires)
 returning id into v_id;
 insert into public.office_ai_governance_events(actor_user_id,tool_id,event_type,new_status) values(p_actor,v_id,'AI_TOOL_CREATED','DRAFT');
 return v_id;
end; $$;

create or replace function public.office_ai_tool_transition(p_actor uuid,p_tool uuid,p_status text,p_note text)
returns text language plpgsql security definer set search_path='' as $$
declare t public.office_ai_tools%rowtype; target text:=upper(trim(p_status)); reviewer boolean;
begin
 select * into t from public.office_ai_tools where id=p_tool for update;
 if t.id is null then raise exception 'AI tool not found'; end if;
 reviewer:=target in ('APPROVED','REJECTED','RETIRED');
 if reviewer then
  if not public.office_effective_permission(p_actor,'ai.tool.review','COMPANY',null,null) then raise exception 'Independent AI tool review permission is required'; end if;
  if p_actor=t.owner_user_id or p_actor=t.created_by then raise exception 'AI tool owner/creator cannot independently review the same tool'; end if;
 else
  if not public.office_effective_permission(p_actor,'ai.tool.manage','COMPANY',null,null) and p_actor<>t.owner_user_id then raise exception 'AI tool management permission is required'; end if;
 end if;
 if t.status='DRAFT' and target<>'SUBMITTED' then raise exception 'Draft AI tool must be submitted for review'; end if;
 if t.status='SUBMITTED' and target not in ('APPROVED','REJECTED') then raise exception 'Submitted AI tool must be approved or rejected'; end if;
 if t.status='APPROVED' and target<>'RETIRED' then raise exception 'Approved AI tool may only be retired'; end if;
 if t.status in ('REJECTED','RETIRED') then raise exception 'Finalized AI tool cannot be transitioned'; end if;
 update public.office_ai_tools set status=target,reviewed_by=case when reviewer then p_actor else reviewed_by end,reviewed_at=case when reviewer then now() else reviewed_at end,review_note=coalesce(nullif(trim(coalesce(p_note,'')),''),review_note),updated_at=now() where id=t.id;
 insert into public.office_ai_governance_events(actor_user_id,tool_id,event_type,previous_status,new_status,note) values(p_actor,t.id,'AI_TOOL_TRANSITION',t.status,target,left(p_note,2000));
 return target;
end; $$;

create or replace function public.office_ai_use_request(
 p_actor uuid,p_tool uuid,p_title text,p_purpose text,p_classes jsonb,p_mode text,p_human_review boolean
) returns uuid language plpgsql security definer set search_path='' as $$
declare t public.office_ai_tools%rowtype; v_id uuid; dept text; mode text:=upper(trim(p_mode));
begin
 if not public.office_effective_permission(p_actor,'ai.use.request','OWN',p_actor::text,null) then raise exception 'AI use-case request permission is required'; end if;
 select * into t from public.office_ai_tools where id=p_tool and status='APPROVED' and (expires_on is null or expires_on>=current_date);
 if t.id is null then raise exception 'Currently approved AI tool is required'; end if;
 if not public.office_ai_classes_allowed(coalesce(p_classes,'[]'::jsonb),t.allowed_data_classes,t.prohibited_data_classes) then raise exception 'Requested data classifications exceed the approved tool boundary'; end if;
 if mode not in ('QUERY','ANALYZE','DRAFT','RECOMMENDATION','ACTION_PROPOSAL') then raise exception 'Invalid AI use mode'; end if;
 select primary_department into dept from public.office_identity_users where user_id=p_actor;
 insert into public.office_ai_use_cases(requester_user_id,department_code,tool_id,title,purpose,intended_data_classes,action_mode,human_review_required)
 values(p_actor,dept,p_tool,trim(p_title),trim(p_purpose),coalesce(p_classes,'[]'::jsonb),mode,(coalesce(p_human_review,true) or t.human_review_required))
 returning id into v_id;
 insert into public.office_ai_governance_events(actor_user_id,tool_id,use_case_id,event_type,new_status) values(p_actor,p_tool,v_id,'AI_USE_REQUESTED','REQUESTED');
 return v_id;
end; $$;

create or replace function public.office_ai_use_review(p_actor uuid,p_use uuid,p_status text,p_expires timestamptz,p_note text)
returns text language plpgsql security definer set search_path='' as $$
declare u public.office_ai_use_cases%rowtype; t public.office_ai_tools%rowtype; target text:=upper(trim(p_status));
begin
 if not public.office_effective_permission(p_actor,'ai.use.review','COMPANY',null,null) then raise exception 'AI use-case review permission is required'; end if;
 select * into u from public.office_ai_use_cases where id=p_use for update;
 if u.id is null or u.status<>'REQUESTED' then raise exception 'Requested AI use case is required'; end if;
 if p_actor=u.requester_user_id then raise exception 'Requester cannot approve their own AI use case'; end if;
 if target not in ('APPROVED','REJECTED') then raise exception 'Invalid AI use-case decision'; end if;
 select * into t from public.office_ai_tools where id=u.tool_id;
 if target='APPROVED' then
  if t.status<>'APPROVED' or (t.expires_on is not null and t.expires_on<current_date) then raise exception 'AI tool is no longer approved'; end if;
  if not public.office_ai_classes_allowed(u.intended_data_classes,t.allowed_data_classes,t.prohibited_data_classes) then raise exception 'Requested data classifications are no longer permitted'; end if;
  if p_expires is null or p_expires<=now() then raise exception 'Future AI use-case expiry is required'; end if;
 end if;
 update public.office_ai_use_cases set status=target,reviewer_user_id=p_actor,reviewed_at=now(),review_note=nullif(trim(coalesce(p_note,'')),''),expires_at=case when target='APPROVED' then p_expires else null end,updated_at=now() where id=u.id;
 insert into public.office_ai_governance_events(actor_user_id,tool_id,use_case_id,event_type,previous_status,new_status,note) values(p_actor,u.tool_id,u.id,'AI_USE_REVIEW',u.status,target,left(p_note,2000));
 return target;
end; $$;

create or replace function public.office_ai_usage_record(
 p_actor uuid,p_use uuid,p_action text,p_classes jsonb,p_content_sha256 text,p_provider_reference text,p_result_reference text,p_human_review_reference text
) returns bigint language plpgsql security definer set search_path='' as $$
declare u public.office_ai_use_cases%rowtype; t public.office_ai_tools%rowtype; v_id bigint; act text:=upper(trim(p_action));
begin
 select * into u from public.office_ai_use_cases where id=p_use;
 if u.id is null or u.status<>'APPROVED' or u.expires_at is null or u.expires_at<=now() then raise exception 'Active approved AI use case is required'; end if;
 if p_actor<>u.requester_user_id then raise exception 'AI use case is not assigned to this actor'; end if;
 select * into t from public.office_ai_tools where id=u.tool_id and status='APPROVED';
 if t.id is null then raise exception 'AI tool is not currently approved'; end if;
 if act<>u.action_mode then raise exception 'AI action mode exceeds approved use case'; end if;
 if not public.office_ai_classes_allowed(coalesce(p_classes,'[]'::jsonb),u.intended_data_classes,t.prohibited_data_classes) then raise exception 'Usage data classifications exceed approved use case'; end if;
 if p_content_sha256 is not null and p_content_sha256 !~ '^[0-9a-fA-F]{64}$' then raise exception 'Content hash must be SHA-256 hex'; end if;
 if u.human_review_required and act='ACTION_PROPOSAL' and nullif(trim(coalesce(p_human_review_reference,'')),'') is null then raise exception 'Human review reference is required for this action proposal'; end if;
 insert into public.office_ai_usage_events(use_case_id,actor_user_id,action_kind,data_classes,content_sha256,provider_reference,result_reference,human_review_reference)
 values(u.id,p_actor,act,coalesce(p_classes,'[]'::jsonb),lower(p_content_sha256),nullif(trim(coalesce(p_provider_reference,'')),''),nullif(trim(coalesce(p_result_reference,'')),''),nullif(trim(coalesce(p_human_review_reference,'')),''))
 returning id into v_id;
 return v_id;
end; $$;

revoke all on function public.office_ai_classes_allowed(jsonb,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.office_ai_tool_create(uuid,text,text,text,boolean,jsonb,jsonb,text,text,text,text,boolean,uuid,date) from public,anon,authenticated;
revoke all on function public.office_ai_tool_transition(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.office_ai_use_request(uuid,uuid,text,text,jsonb,text,boolean) from public,anon,authenticated;
revoke all on function public.office_ai_use_review(uuid,uuid,text,timestamptz,text) from public,anon,authenticated;
revoke all on function public.office_ai_usage_record(uuid,uuid,text,jsonb,text,text,text,text) from public,anon,authenticated;

grant execute on function public.office_ai_classes_allowed(jsonb,jsonb,jsonb) to service_role;
grant execute on function public.office_ai_tool_create(uuid,text,text,text,boolean,jsonb,jsonb,text,text,text,text,boolean,uuid,date) to service_role;
grant execute on function public.office_ai_tool_transition(uuid,uuid,text,text) to service_role;
grant execute on function public.office_ai_use_request(uuid,uuid,text,text,jsonb,text,boolean) to service_role;
grant execute on function public.office_ai_use_review(uuid,uuid,text,timestamptz,text) to service_role;
grant execute on function public.office_ai_usage_record(uuid,uuid,text,jsonb,text,text,text,text) to service_role;
