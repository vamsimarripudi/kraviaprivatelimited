-- KRAVIA Office OS — engineering on-call and maintenance-window control.
-- Scheduling does not itself execute infrastructure changes or provider deployments.

insert into public.office_permission_catalog(code,module,action,label,description,sensitivity,high_risk,requires_managed_device,active) values
 ('engineering.oncall.read','ENGINEERING','READ_ONCALL','Read on-call','Read service on-call rotations in assigned project scope.','STANDARD',false,false,true),
 ('engineering.oncall.manage','ENGINEERING','MANAGE_ONCALL','Manage on-call','Create/cancel service on-call rotations in assigned project scope.','HIGH',true,true,true),
 ('engineering.maintenance.read','ENGINEERING','READ_MAINTENANCE','Read maintenance','Read maintenance windows and evidence in assigned project scope.','STANDARD',false,false,true),
 ('engineering.maintenance.manage','ENGINEERING','MANAGE_MAINTENANCE','Manage maintenance','Propose and execute approved maintenance windows; does not independently approve/verify own change.','CRITICAL',true,true,true),
 ('engineering.maintenance.approve','ENGINEERING','APPROVE_MAINTENANCE','Approve maintenance','Independently approve/reject proposed maintenance windows.','CRITICAL',true,true,true),
 ('engineering.maintenance.verify','ENGINEERING','VERIFY_MAINTENANCE','Verify maintenance','Independently verify maintenance completion evidence.','CRITICAL',true,true,true)
on conflict(code) do update set module=excluded.module,action=excluded.action,label=excluded.label,description=excluded.description,sensitivity=excluded.sensitivity,high_risk=excluded.high_risk,requires_managed_device=excluded.requires_managed_device,active=true;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type) values
 ('DEVELOPER_STANDARD','engineering.oncall.read','ALLOW','PROJECT'),
 ('DEVELOPER_STANDARD','engineering.maintenance.read','ALLOW','PROJECT'),
 ('DEVELOPER_SENIOR','engineering.oncall.read','ALLOW','PROJECT'),
 ('DEVELOPER_SENIOR','engineering.maintenance.read','ALLOW','PROJECT'),
 ('QA_ENGINEER','engineering.oncall.read','ALLOW','PROJECT'),
 ('QA_ENGINEER','engineering.maintenance.read','ALLOW','PROJECT'),
 ('QA_ENGINEER','engineering.maintenance.verify','ALLOW','PROJECT'),
 ('DEVOPS_OPERATOR','engineering.oncall.read','ALLOW','PROJECT'),
 ('DEVOPS_OPERATOR','engineering.oncall.manage','ALLOW','PROJECT'),
 ('DEVOPS_OPERATOR','engineering.maintenance.read','ALLOW','PROJECT'),
 ('DEVOPS_OPERATOR','engineering.maintenance.manage','ALLOW','PROJECT'),
 ('ENGINEERING_MANAGER','engineering.oncall.read','ALLOW','PROJECT'),
 ('ENGINEERING_MANAGER','engineering.oncall.manage','ALLOW','PROJECT'),
 ('ENGINEERING_MANAGER','engineering.maintenance.read','ALLOW','PROJECT'),
 ('ENGINEERING_MANAGER','engineering.maintenance.manage','ALLOW','PROJECT'),
 ('ENGINEERING_MANAGER','engineering.maintenance.approve','ALLOW','PROJECT'),
 ('SECURITY_OPERATOR','engineering.maintenance.read','ALLOW','PROJECT'),
 ('SECURITY_OPERATOR','engineering.maintenance.approve','ALLOW','PROJECT'),
 ('SECURITY_OPERATOR','engineering.maintenance.verify','ALLOW','PROJECT'),
 ('OPERATIONS_MANAGER','engineering.oncall.read','ALLOW','PROJECT'),
 ('OPERATIONS_MANAGER','engineering.maintenance.read','ALLOW','PROJECT')
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

create sequence if not exists public.office_oncall_rotation_seq;
create sequence if not exists public.office_maintenance_window_seq;
grant usage,select on sequence public.office_oncall_rotation_seq,public.office_maintenance_window_seq to service_role;

create table if not exists public.office_oncall_rotations(
 id uuid primary key default gen_random_uuid(),
 rotation_code text not null unique default ('KR-ONC-'||lpad(nextval('public.office_oncall_rotation_seq')::text,7,'0')),
 service_id uuid not null references public.office_engineering_services(id) on delete restrict,
 primary_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 secondary_user_id uuid references public.office_identity_users(user_id) on delete restrict,
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 status text not null default 'SCHEDULED' check(status in ('SCHEDULED','CANCELLED','COMPLETED')),
 note text,
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 cancelled_by uuid references public.office_identity_users(user_id) on delete restrict,
 cancelled_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(ends_at>starts_at),
 check(secondary_user_id is null or secondary_user_id<>primary_user_id)
);
create index if not exists office_oncall_service_idx on public.office_oncall_rotations(service_id,status,starts_at,ends_at);
create index if not exists office_oncall_primary_idx on public.office_oncall_rotations(primary_user_id,status,starts_at);

create table if not exists public.office_maintenance_windows(
 id uuid primary key default gen_random_uuid(),
 maintenance_code text not null unique default ('KR-MNT-'||lpad(nextval('public.office_maintenance_window_seq')::text,7,'0')),
 service_id uuid not null references public.office_engineering_services(id) on delete restrict,
 title text not null check(char_length(trim(title)) between 3 and 220),
 reason text not null check(char_length(trim(reason))>=3),
 expected_impact text not null check(char_length(trim(expected_impact))>=3),
 implementation_plan text not null check(char_length(trim(implementation_plan))>=3),
 rollback_plan text not null check(char_length(trim(rollback_plan))>=3),
 owner_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 status text not null default 'PROPOSED' check(status in ('PROPOSED','APPROVED','REJECTED','IN_PROGRESS','VERIFIED','ROLLED_BACK','CANCELLED')),
 approval_reference text,
 approved_by uuid references public.office_identity_users(user_id) on delete restrict,
 approved_at timestamptz,
 verification_evidence_reference text,
 health_reference text,
 verified_by uuid references public.office_identity_users(user_id) on delete restrict,
 verified_at timestamptz,
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(ends_at>starts_at)
);
create index if not exists office_maintenance_service_idx on public.office_maintenance_windows(service_id,status,starts_at,ends_at);

create table if not exists public.office_engineering_operations_events(
 id bigint generated always as identity primary key,
 actor_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 rotation_id uuid references public.office_oncall_rotations(id) on delete restrict,
 maintenance_id uuid references public.office_maintenance_windows(id) on delete restrict,
 event_type text not null,
 previous_status text,
 new_status text,
 note text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

alter table public.office_oncall_rotations enable row level security;
alter table public.office_maintenance_windows enable row level security;
alter table public.office_engineering_operations_events enable row level security;
revoke all on public.office_oncall_rotations,public.office_maintenance_windows,public.office_engineering_operations_events from public,anon,authenticated;
grant select,insert,update on public.office_oncall_rotations,public.office_maintenance_windows to service_role;
grant select,insert on public.office_engineering_operations_events to service_role;

create or replace function public.office_oncall_create(
 p_actor uuid,p_service uuid,p_primary uuid,p_secondary uuid,p_start timestamptz,p_end timestamptz,p_note text
) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.office_engineering_services%rowtype; v_id uuid;
begin
 select * into s from public.office_engineering_services where id=p_service and status='ACTIVE';
 if s.id is null then raise exception 'Active engineering service is required'; end if;
 if not public.office_effective_permission(p_actor,'engineering.oncall.manage','PROJECT',s.project_key,null) then raise exception 'On-call management permission is required for this project'; end if;
 if not exists(select 1 from public.office_identity_users where user_id=p_primary and status='ACTIVE') then raise exception 'Active primary on-call user is required'; end if;
 if p_secondary is not null and not exists(select 1 from public.office_identity_users where user_id=p_secondary and status='ACTIVE') then raise exception 'Active secondary on-call user is required'; end if;
 if p_secondary=p_primary then raise exception 'Primary and secondary on-call users must differ'; end if;
 if p_end<=p_start then raise exception 'On-call end must follow start'; end if;
 if exists(select 1 from public.office_oncall_rotations where service_id=s.id and status='SCHEDULED' and tstzrange(starts_at,ends_at,'[)') && tstzrange(p_start,p_end,'[)')) then raise exception 'On-call rotation overlaps an existing scheduled rotation'; end if;
 insert into public.office_oncall_rotations(service_id,primary_user_id,secondary_user_id,starts_at,ends_at,note,created_by)
 values(s.id,p_primary,p_secondary,p_start,p_end,nullif(trim(coalesce(p_note,'')),''),p_actor) returning id into v_id;
 insert into public.office_engineering_operations_events(actor_user_id,rotation_id,event_type,new_status,metadata)
 values(p_actor,v_id,'ONCALL_CREATED','SCHEDULED',jsonb_build_object('service_id',s.id,'primary_user_id',p_primary,'secondary_user_id',p_secondary));
 return v_id;
end; $$;

create or replace function public.office_oncall_cancel(p_actor uuid,p_rotation uuid,p_reason text)
returns boolean language plpgsql security definer set search_path='' as $$
declare r public.office_oncall_rotations%rowtype; s public.office_engineering_services%rowtype;
begin
 select * into r from public.office_oncall_rotations where id=p_rotation for update;
 if r.id is null or r.status<>'SCHEDULED' then raise exception 'Scheduled on-call rotation is required'; end if;
 select * into s from public.office_engineering_services where id=r.service_id;
 if not public.office_effective_permission(p_actor,'engineering.oncall.manage','PROJECT',s.project_key,null) then raise exception 'On-call management permission is required for this project'; end if;
 if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'Cancellation reason is required'; end if;
 update public.office_oncall_rotations set status='CANCELLED',cancelled_by=p_actor,cancelled_at=now(),updated_at=now() where id=r.id;
 insert into public.office_engineering_operations_events(actor_user_id,rotation_id,event_type,previous_status,new_status,note) values(p_actor,r.id,'ONCALL_CANCELLED',r.status,'CANCELLED',left(p_reason,2000));
 return true;
end; $$;

create or replace function public.office_maintenance_create(
 p_actor uuid,p_service uuid,p_title text,p_reason text,p_impact text,p_implementation text,p_rollback text,p_owner uuid,p_start timestamptz,p_end timestamptz
) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.office_engineering_services%rowtype; v_id uuid;
begin
 select * into s from public.office_engineering_services where id=p_service and status='ACTIVE';
 if s.id is null then raise exception 'Active engineering service is required'; end if;
 if not public.office_effective_permission(p_actor,'engineering.maintenance.manage','PROJECT',s.project_key,null)
    or not public.office_effective_permission(p_actor,'engineering.infrastructure.change','PROJECT',s.project_key,null) then
   raise exception 'Maintenance and infrastructure-change permission are required for this project';
 end if;
 if not exists(select 1 from public.office_identity_users where user_id=p_owner and status='ACTIVE') then raise exception 'Active maintenance owner is required'; end if;
 if p_end<=p_start then raise exception 'Maintenance end must follow start'; end if;
 insert into public.office_maintenance_windows(service_id,title,reason,expected_impact,implementation_plan,rollback_plan,owner_user_id,starts_at,ends_at,created_by)
 values(s.id,trim(p_title),trim(p_reason),trim(p_impact),trim(p_implementation),trim(p_rollback),p_owner,p_start,p_end,p_actor) returning id into v_id;
 insert into public.office_engineering_operations_events(actor_user_id,maintenance_id,event_type,new_status,metadata) values(p_actor,v_id,'MAINTENANCE_PROPOSED','PROPOSED',jsonb_build_object('service_id',s.id));
 return v_id;
end; $$;

create or replace function public.office_maintenance_review(p_actor uuid,p_maintenance uuid,p_decision text,p_reference text,p_note text)
returns text language plpgsql security definer set search_path='' as $$
declare m public.office_maintenance_windows%rowtype; s public.office_engineering_services%rowtype; target text:=upper(trim(p_decision));
begin
 select * into m from public.office_maintenance_windows where id=p_maintenance for update;
 if m.id is null or m.status<>'PROPOSED' then raise exception 'Proposed maintenance window is required'; end if;
 select * into s from public.office_engineering_services where id=m.service_id;
 if not public.office_effective_permission(p_actor,'engineering.maintenance.approve','PROJECT',s.project_key,null) then raise exception 'Independent maintenance approval permission is required'; end if;
 if p_actor=m.owner_user_id or p_actor=m.created_by then raise exception 'Maintenance owner/creator cannot approve their own window'; end if;
 if target not in ('APPROVED','REJECTED') then raise exception 'Invalid maintenance review decision'; end if;
 if target='APPROVED' and nullif(trim(coalesce(p_reference,'')),'') is null then raise exception 'Approval reference is required'; end if;
 if target='APPROVED' and exists(select 1 from public.office_maintenance_windows x where x.service_id=m.service_id and x.id<>m.id and x.status in ('APPROVED','IN_PROGRESS') and tstzrange(x.starts_at,x.ends_at,'[)') && tstzrange(m.starts_at,m.ends_at,'[)')) then raise exception 'Maintenance window overlaps another approved/in-progress window'; end if;
 update public.office_maintenance_windows set status=target,approval_reference=case when target='APPROVED' then trim(p_reference) else approval_reference end,approved_by=p_actor,approved_at=now(),updated_at=now() where id=m.id;
 insert into public.office_engineering_operations_events(actor_user_id,maintenance_id,event_type,previous_status,new_status,note) values(p_actor,m.id,'MAINTENANCE_REVIEW',m.status,target,left(p_note,2000));
 return target;
end; $$;

create or replace function public.office_maintenance_execute(p_actor uuid,p_maintenance uuid,p_action text,p_evidence text,p_note text)
returns text language plpgsql security definer set search_path='' as $$
declare m public.office_maintenance_windows%rowtype; s public.office_engineering_services%rowtype; target text:=upper(trim(p_action));
begin
 select * into m from public.office_maintenance_windows where id=p_maintenance for update;
 if m.id is null then raise exception 'Maintenance window not found'; end if;
 select * into s from public.office_engineering_services where id=m.service_id;
 if not public.office_effective_permission(p_actor,'engineering.maintenance.manage','PROJECT',s.project_key,null) then raise exception 'Maintenance execution permission is required for this project'; end if;
 if p_actor<>m.owner_user_id and p_actor<>m.created_by then raise exception 'Maintenance execution is restricted to the owner/creator'; end if;
 if target='IN_PROGRESS' and m.status<>'APPROVED' then raise exception 'Approved maintenance is required to start'; end if;
 if target='ROLLED_BACK' and m.status<>'IN_PROGRESS' then raise exception 'In-progress maintenance is required to record rollback'; end if;
 if target='CANCELLED' and m.status not in ('PROPOSED','APPROVED') then raise exception 'Current maintenance state cannot be cancelled'; end if;
 if target not in ('IN_PROGRESS','ROLLED_BACK','CANCELLED') then raise exception 'Invalid maintenance execution action'; end if;
 if target='ROLLED_BACK' and nullif(trim(coalesce(p_evidence,'')),'') is null then raise exception 'Rollback evidence is required'; end if;
 update public.office_maintenance_windows set status=target,verification_evidence_reference=case when target='ROLLED_BACK' then trim(p_evidence) else verification_evidence_reference end,updated_at=now() where id=m.id;
 insert into public.office_engineering_operations_events(actor_user_id,maintenance_id,event_type,previous_status,new_status,note,metadata) values(p_actor,m.id,'MAINTENANCE_EXECUTION',m.status,target,left(p_note,2000),jsonb_build_object('evidence_reference',nullif(trim(coalesce(p_evidence,'')),'')));
 return target;
end; $$;

create or replace function public.office_maintenance_verify(p_actor uuid,p_maintenance uuid,p_evidence text,p_health text,p_note text)
returns text language plpgsql security definer set search_path='' as $$
declare m public.office_maintenance_windows%rowtype; s public.office_engineering_services%rowtype;
begin
 select * into m from public.office_maintenance_windows where id=p_maintenance for update;
 if m.id is null or m.status<>'IN_PROGRESS' then raise exception 'In-progress maintenance is required for verification'; end if;
 select * into s from public.office_engineering_services where id=m.service_id;
 if not public.office_effective_permission(p_actor,'engineering.maintenance.verify','PROJECT',s.project_key,null) then raise exception 'Independent maintenance verification permission is required'; end if;
 if p_actor=m.owner_user_id or p_actor=m.created_by then raise exception 'Maintenance owner/creator cannot independently verify their own work'; end if;
 if nullif(trim(coalesce(p_evidence,'')),'') is null or nullif(trim(coalesce(p_health,'')),'') is null then raise exception 'Verification evidence and health reference are required'; end if;
 update public.office_maintenance_windows set status='VERIFIED',verification_evidence_reference=trim(p_evidence),health_reference=trim(p_health),verified_by=p_actor,verified_at=now(),updated_at=now() where id=m.id;
 insert into public.office_engineering_operations_events(actor_user_id,maintenance_id,event_type,previous_status,new_status,note,metadata) values(p_actor,m.id,'MAINTENANCE_VERIFIED',m.status,'VERIFIED',left(p_note,2000),jsonb_build_object('evidence_reference',trim(p_evidence),'health_reference',trim(p_health)));
 return 'VERIFIED';
end; $$;

revoke all on function public.office_oncall_create(uuid,uuid,uuid,uuid,timestamptz,timestamptz,text) from public,anon,authenticated;
revoke all on function public.office_oncall_cancel(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.office_maintenance_create(uuid,uuid,text,text,text,text,text,uuid,timestamptz,timestamptz) from public,anon,authenticated;
revoke all on function public.office_maintenance_review(uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.office_maintenance_execute(uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.office_maintenance_verify(uuid,uuid,text,text,text) from public,anon,authenticated;

grant execute on function public.office_oncall_create(uuid,uuid,uuid,uuid,timestamptz,timestamptz,text) to service_role;
grant execute on function public.office_oncall_cancel(uuid,uuid,text) to service_role;
grant execute on function public.office_maintenance_create(uuid,uuid,text,text,text,text,text,uuid,timestamptz,timestamptz) to service_role;
grant execute on function public.office_maintenance_review(uuid,uuid,text,text,text) to service_role;
grant execute on function public.office_maintenance_execute(uuid,uuid,text,text,text) to service_role;
grant execute on function public.office_maintenance_verify(uuid,uuid,text,text,text) to service_role;
