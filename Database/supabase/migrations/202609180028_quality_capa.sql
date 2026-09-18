-- KRAVIA Office OS — quality management and CAPA.
-- Quality outcomes are human/evidence based. No passive telemetry or employee activity is converted into a quality score.

insert into public.office_permission_catalog(code,module,action,label,description,sensitivity,high_risk,requires_managed_device,active) values
 ('quality.read','QUALITY','READ','Read quality records','Read process, nonconformance and CAPA records in authorised scope.','STANDARD',false,false,true),
 ('quality.process.manage','QUALITY','MANAGE_PROCESS','Manage quality process','Create controlled process drafts and revisions.','HIGH',true,true,true),
 ('quality.process.publish','QUALITY','PUBLISH_PROCESS','Publish quality process','Independently publish or retire controlled process revisions.','HIGH',true,true,true),
 ('quality.nonconformance.report','QUALITY','REPORT_NONCONFORMANCE','Report nonconformance','Report a process/product/service nonconformance from the actor''s work.','STANDARD',false,false,true),
 ('quality.nonconformance.manage','QUALITY','MANAGE_NONCONFORMANCE','Manage nonconformance','Triage, assign, contain and close nonconformances.','HIGH',true,true,true),
 ('quality.capa.manage','QUALITY','MANAGE_CAPA','Manage CAPA','Create and execute corrective/preventive actions.','HIGH',true,true,true),
 ('quality.capa.review','QUALITY','REVIEW_CAPA','Review CAPA effectiveness','Independently verify corrective/preventive action effectiveness.','CRITICAL',true,true,true)
on conflict(code) do update set module=excluded.module,action=excluded.action,label=excluded.label,description=excluded.description,sensitivity=excluded.sensitivity,high_risk=excluded.high_risk,requires_managed_device=excluded.requires_managed_device,active=true;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type)
select code,'quality.nonconformance.report','ALLOW','OWN' from public.office_access_profile_catalog
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type) values
 ('QA_ENGINEER','quality.read','ALLOW','DEPARTMENT'),
 ('QA_ENGINEER','quality.nonconformance.manage','ALLOW','DEPARTMENT'),
 ('QA_ENGINEER','quality.capa.manage','ALLOW','DEPARTMENT'),
 ('QA_ENGINEER','quality.capa.review','ALLOW','DEPARTMENT'),
 ('ENGINEERING_MANAGER','quality.read','ALLOW','DEPARTMENT'),
 ('ENGINEERING_MANAGER','quality.process.manage','ALLOW','DEPARTMENT'),
 ('ENGINEERING_MANAGER','quality.process.publish','ALLOW','DEPARTMENT'),
 ('ENGINEERING_MANAGER','quality.nonconformance.manage','ALLOW','DEPARTMENT'),
 ('ENGINEERING_MANAGER','quality.capa.manage','ALLOW','DEPARTMENT'),
 ('PRODUCT_MANAGER','quality.read','ALLOW','DEPARTMENT'),
 ('PRODUCT_MANAGER','quality.process.manage','ALLOW','DEPARTMENT'),
 ('PRODUCT_MANAGER','quality.nonconformance.manage','ALLOW','DEPARTMENT'),
 ('PRODUCT_MANAGER','quality.capa.manage','ALLOW','DEPARTMENT'),
 ('OPERATIONS_MANAGER','quality.read','ALLOW','DEPARTMENT'),
 ('OPERATIONS_MANAGER','quality.process.manage','ALLOW','DEPARTMENT'),
 ('OPERATIONS_MANAGER','quality.process.publish','ALLOW','DEPARTMENT'),
 ('OPERATIONS_MANAGER','quality.nonconformance.manage','ALLOW','DEPARTMENT'),
 ('OPERATIONS_MANAGER','quality.capa.manage','ALLOW','DEPARTMENT'),
 ('RISK_MANAGER','quality.read','ALLOW','COMPANY'),
 ('RISK_MANAGER','quality.capa.review','ALLOW','COMPANY'),
 ('AUDITOR_READONLY','quality.read','ALLOW','COMPANY')
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

create sequence if not exists public.office_quality_process_seq;
create sequence if not exists public.office_quality_nc_seq;
create sequence if not exists public.office_quality_capa_seq;
grant usage,select on sequence public.office_quality_process_seq,public.office_quality_nc_seq,public.office_quality_capa_seq to service_role;

create table if not exists public.office_quality_processes(
 id uuid primary key default gen_random_uuid(),
 process_code text not null unique default ('KR-QP-'||lpad(nextval('public.office_quality_process_seq')::text,6,'0')),
 title text not null check(char_length(trim(title)) between 3 and 220),
 department_code text not null,
 owner_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 status text not null default 'DRAFT' check(status in ('DRAFT','PUBLISHED','RETIRED')),
 current_version integer,
 next_review_on date,
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists office_quality_process_department_idx on public.office_quality_processes(department_code,status,next_review_on);

create table if not exists public.office_quality_process_versions(
 id uuid primary key default gen_random_uuid(),
 process_id uuid not null references public.office_quality_processes(id) on delete restrict,
 version integer not null check(version>0),
 purpose text not null check(char_length(trim(purpose))>=3),
 scope_text text not null check(char_length(trim(scope_text))>=3),
 procedure_text text not null check(char_length(trim(procedure_text))>=10),
 control_points jsonb not null default '[]'::jsonb check(jsonb_typeof(control_points)='array'),
 evidence_requirements jsonb not null default '[]'::jsonb check(jsonb_typeof(evidence_requirements)='array'),
 standard_reference text,
 change_summary text,
 content_sha256 text not null check(content_sha256 ~ '^[0-9a-f]{64}$'),
 status text not null default 'DRAFT' check(status in ('DRAFT','PUBLISHED','SUPERSEDED','RETIRED')),
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 published_by uuid references public.office_identity_users(user_id) on delete restrict,
 published_at timestamptz,
 created_at timestamptz not null default now(),
 unique(process_id,version)
);

create table if not exists public.office_quality_nonconformances(
 id uuid primary key default gen_random_uuid(),
 nc_code text not null unique default ('KR-NC-'||lpad(nextval('public.office_quality_nc_seq')::text,7,'0')),
 process_id uuid references public.office_quality_processes(id) on delete restrict,
 reporter_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 department_code text,
 source_type text not null check(source_type in ('PROCESS','AUDIT','CUSTOMER','INCIDENT','SECURITY','SUPPLIER','PRODUCT','OTHER')),
 severity text not null check(severity in ('LOW','MEDIUM','HIGH','CRITICAL')),
 title text not null check(char_length(trim(title)) between 3 and 220),
 description text not null check(char_length(trim(description))>=3),
 evidence_reference text,
 immediate_containment text,
 owner_user_id uuid references public.office_identity_users(user_id) on delete restrict,
 status text not null default 'REPORTED' check(status in ('REPORTED','TRIAGED','CONTAINED','CAPA_REQUIRED','AWAITING_CLOSE_REVIEW','CLOSED','CANCELLED')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 closed_at timestamptz
);
create index if not exists office_quality_nc_department_idx on public.office_quality_nonconformances(department_code,status,severity,created_at desc);
create index if not exists office_quality_nc_owner_idx on public.office_quality_nonconformances(owner_user_id,status,created_at desc);

create table if not exists public.office_quality_capas(
 id uuid primary key default gen_random_uuid(),
 capa_code text not null unique default ('KR-CAPA-'||lpad(nextval('public.office_quality_capa_seq')::text,7,'0')),
 nonconformance_id uuid not null references public.office_quality_nonconformances(id) on delete restrict,
 action_type text not null check(action_type in ('CORRECTIVE','PREVENTIVE','BOTH')),
 owner_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 root_cause text not null check(char_length(trim(root_cause))>=3),
 action_plan text not null check(char_length(trim(action_plan))>=3),
 due_on date,
 status text not null default 'DRAFT' check(status in ('DRAFT','IN_PROGRESS','AWAITING_VERIFICATION','VERIFIED_EFFECTIVE','VERIFIED_INEFFECTIVE','CLOSED','CANCELLED')),
 completion_evidence_reference text,
 effectiveness_evidence_reference text,
 reviewer_user_id uuid references public.office_identity_users(user_id) on delete restrict,
 reviewed_at timestamptz,
 review_note text,
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists office_quality_capa_nc_idx on public.office_quality_capas(nonconformance_id,status,due_on);

create table if not exists public.office_quality_events(
 id bigint generated always as identity primary key,
 actor_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 process_id uuid references public.office_quality_processes(id) on delete restrict,
 process_version_id uuid references public.office_quality_process_versions(id) on delete restrict,
 nonconformance_id uuid references public.office_quality_nonconformances(id) on delete restrict,
 capa_id uuid references public.office_quality_capas(id) on delete restrict,
 event_type text not null,
 previous_status text,
 new_status text,
 note text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

alter table public.office_quality_processes enable row level security;
alter table public.office_quality_process_versions enable row level security;
alter table public.office_quality_nonconformances enable row level security;
alter table public.office_quality_capas enable row level security;
alter table public.office_quality_events enable row level security;
revoke all on public.office_quality_processes,public.office_quality_process_versions,public.office_quality_nonconformances,public.office_quality_capas,public.office_quality_events from public,anon,authenticated;
grant select,insert,update on public.office_quality_processes,public.office_quality_process_versions,public.office_quality_nonconformances,public.office_quality_capas to service_role;
grant select,insert on public.office_quality_events to service_role;

create or replace function public.office_quality_process_create(
 p_actor uuid,p_title text,p_department text,p_owner uuid,p_purpose text,p_scope text,p_procedure text,p_controls jsonb,p_evidence jsonb,p_standard text,p_review_on date
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_process uuid; v_version uuid; dept text:=upper(trim(p_department)); hash text;
begin
 if not public.office_effective_permission(p_actor,'quality.process.manage','COMPANY',null,null)
    and not public.office_effective_permission(p_actor,'quality.process.manage','DEPARTMENT',dept,null) then raise exception 'Quality-process management permission is required'; end if;
 if not exists(select 1 from public.office_identity_users where user_id=p_owner and status='ACTIVE') then raise exception 'Active process owner is required'; end if;
 hash:=encode(extensions.digest(convert_to(p_purpose||E'\n'||p_scope||E'\n'||p_procedure||E'\n'||coalesce(p_controls,'[]'::jsonb)::text||E'\n'||coalesce(p_evidence,'[]'::jsonb)::text,'UTF8'),'sha256'),'hex');
 insert into public.office_quality_processes(title,department_code,owner_user_id,next_review_on,created_by)
 values(trim(p_title),dept,p_owner,p_review_on,p_actor) returning id into v_process;
 insert into public.office_quality_process_versions(process_id,version,purpose,scope_text,procedure_text,control_points,evidence_requirements,standard_reference,content_sha256,created_by)
 values(v_process,1,trim(p_purpose),trim(p_scope),trim(p_procedure),coalesce(p_controls,'[]'::jsonb),coalesce(p_evidence,'[]'::jsonb),nullif(trim(coalesce(p_standard,'')),''),hash,p_actor) returning id into v_version;
 insert into public.office_quality_events(actor_user_id,process_id,process_version_id,event_type,new_status) values(p_actor,v_process,v_version,'PROCESS_CREATED','DRAFT');
 return v_process;
end; $$;

create or replace function public.office_quality_process_new_version(
 p_actor uuid,p_process uuid,p_purpose text,p_scope text,p_procedure text,p_controls jsonb,p_evidence jsonb,p_standard text,p_summary text
) returns uuid language plpgsql security definer set search_path='' as $$
declare p public.office_quality_processes%rowtype; v integer; v_id uuid; hash text;
begin
 select * into p from public.office_quality_processes where id=p_process for update;
 if p.id is null or p.status='RETIRED' then raise exception 'Active process is required'; end if;
 if not public.office_effective_permission(p_actor,'quality.process.manage','COMPANY',null,null)
    and not public.office_effective_permission(p_actor,'quality.process.manage','DEPARTMENT',p.department_code,null) then raise exception 'Quality-process management permission is required'; end if;
 select coalesce(max(version),0)+1 into v from public.office_quality_process_versions where process_id=p.id;
 hash:=encode(extensions.digest(convert_to(p_purpose||E'\n'||p_scope||E'\n'||p_procedure||E'\n'||coalesce(p_controls,'[]'::jsonb)::text||E'\n'||coalesce(p_evidence,'[]'::jsonb)::text,'UTF8'),'sha256'),'hex');
 insert into public.office_quality_process_versions(process_id,version,purpose,scope_text,procedure_text,control_points,evidence_requirements,standard_reference,change_summary,content_sha256,created_by)
 values(p.id,v,trim(p_purpose),trim(p_scope),trim(p_procedure),coalesce(p_controls,'[]'::jsonb),coalesce(p_evidence,'[]'::jsonb),nullif(trim(coalesce(p_standard,'')),''),nullif(trim(coalesce(p_summary,'')),''),hash,p_actor) returning id into v_id;
 insert into public.office_quality_events(actor_user_id,process_id,process_version_id,event_type,metadata) values(p_actor,p.id,v_id,'PROCESS_VERSION_CREATED',jsonb_build_object('version',v));
 return v_id;
end; $$;

create or replace function public.office_quality_process_publish(p_actor uuid,p_version uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v public.office_quality_process_versions%rowtype; p public.office_quality_processes%rowtype;
begin
 select * into v from public.office_quality_process_versions where id=p_version for update;
 if v.id is null or v.status<>'DRAFT' then raise exception 'Draft process version is required'; end if;
 select * into p from public.office_quality_processes where id=v.process_id for update;
 if not public.office_effective_permission(p_actor,'quality.process.publish','COMPANY',null,null)
    and not public.office_effective_permission(p_actor,'quality.process.publish','DEPARTMENT',p.department_code,null) then raise exception 'Quality-process publishing permission is required'; end if;
 if p_actor=v.created_by then raise exception 'Process version creator cannot independently publish the same revision'; end if;
 update public.office_quality_process_versions set status='SUPERSEDED' where process_id=p.id and status='PUBLISHED';
 update public.office_quality_process_versions set status='PUBLISHED',published_by=p_actor,published_at=now() where id=v.id;
 update public.office_quality_processes set status='PUBLISHED',current_version=v.version,updated_at=now() where id=p.id;
 insert into public.office_quality_events(actor_user_id,process_id,process_version_id,event_type,new_status) values(p_actor,p.id,v.id,'PROCESS_PUBLISHED','PUBLISHED');
 return true;
end; $$;

create or replace function public.office_quality_nc_report(
 p_actor uuid,p_process uuid,p_source text,p_severity text,p_title text,p_description text,p_evidence text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; dept text;
begin
 if not public.office_effective_permission(p_actor,'quality.nonconformance.report','OWN',p_actor::text,null) then raise exception 'Nonconformance reporting permission is required'; end if;
 if p_process is not null then
   select department_code into dept from public.office_quality_processes where id=p_process and status='PUBLISHED';
   if dept is null then raise exception 'Published process is required'; end if;
 else
   select primary_department into dept from public.office_identity_users where user_id=p_actor;
 end if;
 insert into public.office_quality_nonconformances(process_id,reporter_user_id,department_code,source_type,severity,title,description,evidence_reference)
 values(p_process,p_actor,dept,upper(trim(p_source)),upper(trim(p_severity)),trim(p_title),trim(p_description),nullif(trim(coalesce(p_evidence,'')),'')) returning id into v_id;
 insert into public.office_quality_events(actor_user_id,process_id,nonconformance_id,event_type,new_status) values(p_actor,p_process,v_id,'NONCONFORMANCE_REPORTED','REPORTED');
 return v_id;
end; $$;

create or replace function public.office_quality_nc_manage(
 p_actor uuid,p_nc uuid,p_status text,p_owner uuid,p_containment text,p_note text
) returns text language plpgsql security definer set search_path='' as $$
declare n public.office_quality_nonconformances%rowtype; target text:=upper(trim(p_status));
begin
 select * into n from public.office_quality_nonconformances where id=p_nc for update;
 if n.id is null then raise exception 'Nonconformance not found'; end if;
 if not public.office_effective_permission(p_actor,'quality.nonconformance.manage','COMPANY',null,null)
    and not public.office_effective_permission(p_actor,'quality.nonconformance.manage','DEPARTMENT',n.department_code,null) then raise exception 'Nonconformance management permission is required'; end if;
 if p_owner is not null and not exists(select 1 from public.office_identity_users where user_id=p_owner and status='ACTIVE') then raise exception 'Active nonconformance owner is required'; end if;
 if target not in ('TRIAGED','CONTAINED','CAPA_REQUIRED','AWAITING_CLOSE_REVIEW','CANCELLED') then raise exception 'Invalid nonconformance transition'; end if;
 if target='CONTAINED' and nullif(trim(coalesce(p_containment,'')),'') is null then raise exception 'Containment summary is required'; end if;
 if n.status='REPORTED' and target not in ('TRIAGED','CANCELLED') then raise exception 'Reported nonconformance must be triaged first'; end if;
 if n.status='TRIAGED' and target not in ('CONTAINED','CAPA_REQUIRED','AWAITING_CLOSE_REVIEW','CANCELLED') then raise exception 'Triaged nonconformance transition is invalid'; end if;
 if n.status='CONTAINED' and target not in ('CAPA_REQUIRED','AWAITING_CLOSE_REVIEW') then raise exception 'Contained nonconformance must enter CAPA or close review'; end if;
 if n.status='CAPA_REQUIRED' and target<>'AWAITING_CLOSE_REVIEW' then raise exception 'CAPA-required nonconformance must await closure review after CAPA completion'; end if;
 if n.status in ('AWAITING_CLOSE_REVIEW','CLOSED','CANCELLED') then raise exception 'Current nonconformance state cannot be managed'; end if;
 if target='AWAITING_CLOSE_REVIEW' and exists(select 1 from public.office_quality_capas where nonconformance_id=n.id and status not in ('CLOSED','CANCELLED')) then raise exception 'Open CAPA must be closed before nonconformance closure review'; end if;
 update public.office_quality_nonconformances set status=target,owner_user_id=coalesce(p_owner,owner_user_id),immediate_containment=coalesce(nullif(trim(coalesce(p_containment,'')),''),immediate_containment),updated_at=now() where id=n.id;
 insert into public.office_quality_events(actor_user_id,process_id,nonconformance_id,event_type,previous_status,new_status,note) values(p_actor,n.process_id,n.id,'NONCONFORMANCE_TRANSITION',n.status,target,left(p_note,2000));
 return target;
end; $$;

create or replace function public.office_quality_nc_close(
 p_actor uuid,p_nc uuid,p_evidence text,p_note text
) returns text language plpgsql security definer set search_path='' as $$
declare n public.office_quality_nonconformances%rowtype;
begin
 select * into n from public.office_quality_nonconformances where id=p_nc for update;
 if n.id is null or n.status<>'AWAITING_CLOSE_REVIEW' then raise exception 'Nonconformance awaiting closure review is required'; end if;
 if not public.office_effective_permission(p_actor,'quality.capa.review','COMPANY',null,null)
    and not public.office_effective_permission(p_actor,'quality.capa.review','DEPARTMENT',n.department_code,null) then raise exception 'Independent quality review permission is required'; end if;
 if p_actor=n.reporter_user_id or p_actor=n.owner_user_id then raise exception 'Reporter/owner cannot independently close the same nonconformance'; end if;
 if nullif(trim(coalesce(p_evidence,'')),'') is null then raise exception 'Closure evidence is required'; end if;
 update public.office_quality_nonconformances set status='CLOSED',closed_at=now(),updated_at=now() where id=n.id;
 insert into public.office_quality_events(actor_user_id,process_id,nonconformance_id,event_type,previous_status,new_status,note,metadata) values(p_actor,n.process_id,n.id,'NONCONFORMANCE_CLOSED',n.status,'CLOSED',left(p_note,2000),jsonb_build_object('evidence_reference',trim(p_evidence)));
 return 'CLOSED';
end; $$;

create or replace function public.office_quality_capa_create(
 p_actor uuid,p_nc uuid,p_type text,p_owner uuid,p_root_cause text,p_action_plan text,p_due date
) returns uuid language plpgsql security definer set search_path='' as $$
declare n public.office_quality_nonconformances%rowtype; v_id uuid;
begin
 select * into n from public.office_quality_nonconformances where id=p_nc for update;
 if n.id is null or n.status not in ('TRIAGED','CONTAINED','CAPA_REQUIRED') then raise exception 'Open triaged/contained nonconformance is required'; end if;
 if not public.office_effective_permission(p_actor,'quality.capa.manage','COMPANY',null,null)
    and not public.office_effective_permission(p_actor,'quality.capa.manage','DEPARTMENT',n.department_code,null) then raise exception 'CAPA management permission is required'; end if;
 if not exists(select 1 from public.office_identity_users where user_id=p_owner and status='ACTIVE') then raise exception 'Active CAPA owner is required'; end if;
 insert into public.office_quality_capas(nonconformance_id,action_type,owner_user_id,root_cause,action_plan,due_on,created_by)
 values(n.id,upper(trim(p_type)),p_owner,trim(p_root_cause),trim(p_action_plan),p_due,p_actor) returning id into v_id;
 update public.office_quality_nonconformances set status='CAPA_REQUIRED',owner_user_id=coalesce(owner_user_id,p_owner),updated_at=now() where id=n.id;
 insert into public.office_quality_events(actor_user_id,process_id,nonconformance_id,capa_id,event_type,new_status) values(p_actor,n.process_id,n.id,v_id,'CAPA_CREATED','DRAFT');
 return v_id;
end; $$;

create or replace function public.office_quality_capa_transition(
 p_actor uuid,p_capa uuid,p_status text,p_completion_evidence text,p_effectiveness_evidence text,p_note text
) returns text language plpgsql security definer set search_path='' as $$
declare c public.office_quality_capas%rowtype; n public.office_quality_nonconformances%rowtype; target text:=upper(trim(p_status)); review boolean;
begin
 select * into c from public.office_quality_capas where id=p_capa for update;
 if c.id is null then raise exception 'CAPA not found'; end if;
 select * into n from public.office_quality_nonconformances where id=c.nonconformance_id;
 review:=target in ('VERIFIED_EFFECTIVE','VERIFIED_INEFFECTIVE','CLOSED');
 if review then
   if not public.office_effective_permission(p_actor,'quality.capa.review','COMPANY',null,null)
      and not public.office_effective_permission(p_actor,'quality.capa.review','DEPARTMENT',n.department_code,null) then raise exception 'Independent CAPA review permission is required'; end if;
   if p_actor=c.owner_user_id or p_actor=c.created_by then raise exception 'CAPA owner/creator cannot independently verify the same CAPA'; end if;
 else
   if p_actor<>c.owner_user_id
      and not public.office_effective_permission(p_actor,'quality.capa.manage','COMPANY',null,null)
      and not public.office_effective_permission(p_actor,'quality.capa.manage','DEPARTMENT',n.department_code,null) then raise exception 'CAPA ownership or management permission is required'; end if;
 end if;
 if c.status='DRAFT' and target<>'IN_PROGRESS' then raise exception 'Draft CAPA must enter progress'; end if;
 if c.status='IN_PROGRESS' and target not in ('AWAITING_VERIFICATION','CANCELLED') then raise exception 'In-progress CAPA must await verification or be cancelled'; end if;
 if c.status='AWAITING_VERIFICATION' and target not in ('VERIFIED_EFFECTIVE','VERIFIED_INEFFECTIVE') then raise exception 'CAPA awaiting verification requires effectiveness result'; end if;
 if c.status='VERIFIED_EFFECTIVE' and target<>'CLOSED' then raise exception 'Effective CAPA may only be closed'; end if;
 if c.status='VERIFIED_INEFFECTIVE' and target<>'IN_PROGRESS' then raise exception 'Ineffective CAPA must return to progress'; end if;
 if c.status in ('CLOSED','CANCELLED') then raise exception 'Finalized CAPA cannot be transitioned'; end if;
 if target='AWAITING_VERIFICATION' and nullif(trim(coalesce(p_completion_evidence,'')),'') is null then raise exception 'CAPA completion evidence is required'; end if;
 if target in ('VERIFIED_EFFECTIVE','VERIFIED_INEFFECTIVE') and nullif(trim(coalesce(p_effectiveness_evidence,'')),'') is null then raise exception 'CAPA effectiveness evidence is required'; end if;
 update public.office_quality_capas set status=target,completion_evidence_reference=coalesce(nullif(trim(coalesce(p_completion_evidence,'')),''),completion_evidence_reference),effectiveness_evidence_reference=coalesce(nullif(trim(coalesce(p_effectiveness_evidence,'')),''),effectiveness_evidence_reference),reviewer_user_id=case when review then p_actor else reviewer_user_id end,reviewed_at=case when review then now() else reviewed_at end,review_note=coalesce(nullif(trim(coalesce(p_note,'')),''),review_note),updated_at=now() where id=c.id;
 insert into public.office_quality_events(actor_user_id,process_id,nonconformance_id,capa_id,event_type,previous_status,new_status,note) values(p_actor,n.process_id,n.id,c.id,'CAPA_TRANSITION',c.status,target,left(p_note,2000));
 return target;
end; $$;

revoke all on function public.office_quality_process_create(uuid,text,text,uuid,text,text,text,jsonb,jsonb,text,date) from public,anon,authenticated;
revoke all on function public.office_quality_process_new_version(uuid,uuid,text,text,text,jsonb,jsonb,text,text) from public,anon,authenticated;
revoke all on function public.office_quality_process_publish(uuid,uuid) from public,anon,authenticated;
revoke all on function public.office_quality_nc_report(uuid,uuid,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.office_quality_nc_manage(uuid,uuid,text,uuid,text,text) from public,anon,authenticated;
revoke all on function public.office_quality_nc_close(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.office_quality_capa_create(uuid,uuid,text,uuid,text,text,date) from public,anon,authenticated;
revoke all on function public.office_quality_capa_transition(uuid,uuid,text,text,text,text) from public,anon,authenticated;

grant execute on function public.office_quality_process_create(uuid,text,text,uuid,text,text,text,jsonb,jsonb,text,date) to service_role;
grant execute on function public.office_quality_process_new_version(uuid,uuid,text,text,text,jsonb,jsonb,text,text) to service_role;
grant execute on function public.office_quality_process_publish(uuid,uuid) to service_role;
grant execute on function public.office_quality_nc_report(uuid,uuid,text,text,text,text,text) to service_role;
grant execute on function public.office_quality_nc_manage(uuid,uuid,text,uuid,text,text) to service_role;
grant execute on function public.office_quality_nc_close(uuid,uuid,text,text) to service_role;
grant execute on function public.office_quality_capa_create(uuid,uuid,text,uuid,text,text,date) to service_role;
grant execute on function public.office_quality_capa_transition(uuid,uuid,text,text,text,text) to service_role;
