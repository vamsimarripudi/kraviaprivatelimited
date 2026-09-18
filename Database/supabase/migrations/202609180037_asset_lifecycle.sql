-- KRAVIA Office OS — governed asset lifecycle extension.
-- Extends the legacy office_assets registry without replacing it.
-- No device passwords, recovery keys, wipe credentials, or secrets are stored here.

insert into public.office_permission_catalog(code,module,action,label,description,sensitivity,high_risk,requires_managed_device,active) values
 ('operations.asset.read','OPERATIONS','READ_ASSET','Read assets','Read asset lifecycle, assignment, maintenance and custody metadata.','SENSITIVE',false,true,true),
 ('operations.asset.manage','OPERATIONS','MANAGE_ASSET','Manage assets','Register lifecycle metadata, assign, return and send assets for repair.','HIGH',true,true,true),
 ('operations.asset.wipe','OPERATIONS','VERIFY_WIPE','Verify asset wipe','Record/verify secure-wipe evidence before reissue or disposal.','CRITICAL',true,true,true),
 ('operations.asset.dispose','OPERATIONS','DISPOSE_ASSET','Dispose asset','Independently approve evidence-backed asset disposal.','CRITICAL',true,true,true)
on conflict(code) do update set module=excluded.module,action=excluded.action,label=excluded.label,description=excluded.description,sensitivity=excluded.sensitivity,high_risk=excluded.high_risk,requires_managed_device=excluded.requires_managed_device,active=true;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type) values
 ('OPERATIONS_MANAGER','operations.asset.read','ALLOW','COMPANY'),
 ('OPERATIONS_MANAGER','operations.asset.manage','ALLOW','COMPANY'),
 ('SECURITY_OPERATOR','operations.asset.read','ALLOW','COMPANY'),
 ('SECURITY_OPERATOR','operations.asset.wipe','ALLOW','COMPANY'),
 ('SECURITY_OPERATOR','operations.asset.dispose','ALLOW','COMPANY'),
 ('AUDITOR_READONLY','operations.asset.read','ALLOW','COMPANY')
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type)
select code,'operations.asset.read','ALLOW','OWN'
from public.office_access_profile_catalog
on conflict(profile_code,permission_code) do nothing;

create sequence if not exists public.office_asset_event_seq;
grant usage,select on sequence public.office_asset_event_seq to service_role;

create table if not exists public.office_asset_lifecycle(
 asset_id varchar primary key,
 device_id uuid,
 custodian_user_id uuid references public.office_identity_users(user_id) on delete restrict,
 supplier_name text,
 warranty_expires_on date,
 condition text not null default 'GOOD' check(condition in ('NEW','GOOD','FAIR','DAMAGED','LOST')),
 lifecycle_status text not null default 'IN_STOCK' check(lifecycle_status in ('IN_STOCK','ASSIGNED','REPAIR','RETURN_PENDING','WIPE_PENDING','READY_FOR_REISSUE','DISPOSAL_PENDING','DISPOSED','LOST')),
 security_wipe_required boolean not null default false,
 wipe_evidence_reference text,
 wipe_verified_by uuid references public.office_identity_users(user_id) on delete restrict,
 wipe_verified_at timestamptz,
 maintenance_due_on date,
 disposal_evidence_reference text,
 disposal_approved_by uuid references public.office_identity_users(user_id) on delete restrict,
 disposal_approved_at timestamptz,
 updated_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists office_asset_lifecycle_custodian_idx on public.office_asset_lifecycle(custodian_user_id,lifecycle_status);
create index if not exists office_asset_lifecycle_maintenance_idx on public.office_asset_lifecycle(maintenance_due_on,lifecycle_status);

create table if not exists public.office_asset_events(
 id bigint generated always as identity primary key,
 event_code text not null unique default ('KR-AEV-'||lpad(nextval('public.office_asset_event_seq')::text,8,'0')),
 asset_id varchar not null,
 actor_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 event_type text not null check(event_type in ('REGISTERED','ASSIGNED','RETURN_REQUESTED','RETURNED','REPAIR_SENT','REPAIR_RETURNED','WIPE_REQUIRED','WIPE_VERIFIED','REISSUE_READY','DISPOSAL_REQUESTED','DISPOSED','LOST','NOTE')),
 previous_status text,
 new_status text,
 evidence_reference text,
 note text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists office_asset_events_asset_idx on public.office_asset_events(asset_id,created_at desc);

alter table public.office_asset_lifecycle enable row level security;
alter table public.office_asset_events enable row level security;
revoke all on public.office_asset_lifecycle,public.office_asset_events from public,anon,authenticated;
grant select,insert,update on public.office_asset_lifecycle to service_role;
grant select,insert on public.office_asset_events to service_role;

create or replace function public.office_asset_lifecycle_register(
 p_actor uuid,p_asset varchar,p_device uuid,p_supplier text,p_warranty date,p_condition text,p_wipe_required boolean,p_maintenance_due date
) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not public.office_effective_permission(p_actor,'operations.asset.manage','COMPANY',null,null) then raise exception 'Asset management permission is required'; end if;
 if not exists(select 1 from public.office_assets where id=p_asset) then raise exception 'Canonical asset not found'; end if;
 if p_device is not null and not exists(select 1 from public.office_device_registry where id=p_device) then raise exception 'Device registry reference not found'; end if;
 insert into public.office_asset_lifecycle(asset_id,device_id,supplier_name,warranty_expires_on,condition,security_wipe_required,maintenance_due_on,updated_by)
 values(p_asset,p_device,nullif(trim(coalesce(p_supplier,'')),''),p_warranty,upper(trim(p_condition)),coalesce(p_wipe_required,false),p_maintenance_due,p_actor)
 on conflict(asset_id) do update set
   device_id=excluded.device_id,
   supplier_name=excluded.supplier_name,
   warranty_expires_on=excluded.warranty_expires_on,
   condition=excluded.condition,
   security_wipe_required=excluded.security_wipe_required,
   maintenance_due_on=excluded.maintenance_due_on,
   updated_by=p_actor,
   updated_at=now();
 insert into public.office_asset_events(asset_id,actor_user_id,event_type,new_status,metadata)
 select p_asset,p_actor,'REGISTERED',lifecycle_status,jsonb_build_object('device_id',p_device,'condition',condition)
 from public.office_asset_lifecycle where asset_id=p_asset;
 return true;
end; $$;

create or replace function public.office_asset_assign(
 p_actor uuid,p_asset varchar,p_user uuid,p_location text,p_note text
) returns text language plpgsql security definer set search_path='' as $$
declare a public.office_asset_lifecycle%rowtype; employment_code text;
begin
 if not public.office_effective_permission(p_actor,'operations.asset.manage','COMPANY',null,null) then raise exception 'Asset management permission is required'; end if;
 select * into a from public.office_asset_lifecycle where asset_id=p_asset for update;
 if a.asset_id is null then raise exception 'Asset lifecycle record not found'; end if;
 if a.lifecycle_status not in ('IN_STOCK','READY_FOR_REISSUE') then raise exception 'Asset is not available for assignment'; end if;
 select er.employment_code into employment_code from public.office_employment_registry er where er.identity_user_id=p_user and er.status='ACTIVE' order by er.start_date desc limit 1;
 if employment_code is null then raise exception 'Active employment record is required'; end if;
 update public.office_asset_lifecycle set custodian_user_id=p_user,lifecycle_status='ASSIGNED',updated_by=p_actor,updated_at=now() where asset_id=p_asset;
 update public.office_assets set assigned_employee_id=employment_code,location=nullif(trim(coalesce(p_location,'')),''),status='ASSIGNED' where id=p_asset;
 insert into public.office_asset_events(asset_id,actor_user_id,event_type,previous_status,new_status,note,metadata)
 values(p_asset,p_actor,'ASSIGNED',a.lifecycle_status,'ASSIGNED',left(p_note,2000),jsonb_build_object('custodian_user_id',p_user,'employment_code',employment_code));
 return 'ASSIGNED';
end; $$;

create or replace function public.office_asset_transition(
 p_actor uuid,p_asset varchar,p_action text,p_condition text,p_evidence text,p_note text
) returns text language plpgsql security definer set search_path='' as $$
declare a public.office_asset_lifecycle%rowtype; act text:=upper(trim(p_action)); target text;
begin
 if not public.office_effective_permission(p_actor,'operations.asset.manage','COMPANY',null,null) then raise exception 'Asset management permission is required'; end if;
 select * into a from public.office_asset_lifecycle where asset_id=p_asset for update;
 if a.asset_id is null then raise exception 'Asset lifecycle record not found'; end if;
 if act='REQUEST_RETURN' then
   if a.lifecycle_status<>'ASSIGNED' then raise exception 'Assigned asset is required'; end if;
   target:='RETURN_PENDING';
 elsif act='RETURN' then
   if a.lifecycle_status not in ('ASSIGNED','RETURN_PENDING') then raise exception 'Assigned/return-pending asset is required'; end if;
   target:=case when a.security_wipe_required then 'WIPE_PENDING' else 'IN_STOCK' end;
 elsif act='SEND_REPAIR' then
   if a.lifecycle_status not in ('ASSIGNED','IN_STOCK','READY_FOR_REISSUE') then raise exception 'Asset cannot enter repair from current state'; end if;
   target:='REPAIR';
 elsif act='RETURN_REPAIR' then
   if a.lifecycle_status<>'REPAIR' then raise exception 'Repair asset is required'; end if;
   target:=case when a.security_wipe_required then 'WIPE_PENDING' else 'READY_FOR_REISSUE' end;
 elsif act='REQUEST_DISPOSAL' then
   if a.lifecycle_status not in ('IN_STOCK','READY_FOR_REISSUE','DAMAGED','WIPE_PENDING') and a.condition<>'DAMAGED' then raise exception 'Asset cannot enter disposal from current state'; end if;
   target:='DISPOSAL_PENDING';
 elsif act='LOST' then
   if a.lifecycle_status='DISPOSED' then raise exception 'Disposed asset cannot be marked lost'; end if;
   target:='LOST';
 else raise exception 'Invalid asset lifecycle action';
 end if;
 update public.office_asset_lifecycle
 set lifecycle_status=target,
     condition=coalesce(nullif(upper(trim(coalesce(p_condition,''))),''),condition),
     custodian_user_id=case when act='RETURN' then null else custodian_user_id end,
     updated_by=p_actor,updated_at=now()
 where asset_id=p_asset;
 if act='RETURN' then update public.office_assets set assigned_employee_id=null,status=case when target='IN_STOCK' then 'AVAILABLE' else status end where id=p_asset; end if;
 if act='LOST' then update public.office_assets set status='LOST' where id=p_asset; end if;
 insert into public.office_asset_events(asset_id,actor_user_id,event_type,previous_status,new_status,evidence_reference,note)
 values(p_asset,p_actor,case act when 'REQUEST_RETURN' then 'RETURN_REQUESTED' when 'RETURN' then 'RETURNED' when 'SEND_REPAIR' then 'REPAIR_SENT' when 'RETURN_REPAIR' then 'REPAIR_RETURNED' when 'REQUEST_DISPOSAL' then 'DISPOSAL_REQUESTED' else 'LOST' end,a.lifecycle_status,target,nullif(trim(coalesce(p_evidence,'')),''),left(p_note,2000));
 return target;
end; $$;

create or replace function public.office_asset_verify_wipe(
 p_actor uuid,p_asset varchar,p_evidence text,p_note text
) returns text language plpgsql security definer set search_path='' as $$
declare a public.office_asset_lifecycle%rowtype;
begin
 if not public.office_effective_permission(p_actor,'operations.asset.wipe','COMPANY',null,null) then raise exception 'Secure-wipe verification permission is required'; end if;
 select * into a from public.office_asset_lifecycle where asset_id=p_asset for update;
 if a.asset_id is null or a.lifecycle_status not in ('WIPE_PENDING','DISPOSAL_PENDING') then raise exception 'Wipe-pending/disposal-pending asset is required'; end if;
 if nullif(trim(coalesce(p_evidence,'')),'') is null then raise exception 'Secure-wipe evidence reference is required'; end if;
 update public.office_asset_lifecycle set wipe_evidence_reference=trim(p_evidence),wipe_verified_by=p_actor,wipe_verified_at=now(),lifecycle_status=case when a.lifecycle_status='WIPE_PENDING' then 'READY_FOR_REISSUE' else a.lifecycle_status end,updated_by=p_actor,updated_at=now() where asset_id=p_asset;
 insert into public.office_asset_events(asset_id,actor_user_id,event_type,previous_status,new_status,evidence_reference,note)
 values(p_asset,p_actor,'WIPE_VERIFIED',a.lifecycle_status,case when a.lifecycle_status='WIPE_PENDING' then 'READY_FOR_REISSUE' else a.lifecycle_status end,trim(p_evidence),left(p_note,2000));
 return case when a.lifecycle_status='WIPE_PENDING' then 'READY_FOR_REISSUE' else a.lifecycle_status end;
end; $$;

create or replace function public.office_asset_dispose(
 p_actor uuid,p_asset varchar,p_evidence text,p_note text
) returns text language plpgsql security definer set search_path='' as $$
declare a public.office_asset_lifecycle%rowtype;
begin
 if not public.office_effective_permission(p_actor,'operations.asset.dispose','COMPANY',null,null) then raise exception 'Independent asset-disposal approval permission is required'; end if;
 select * into a from public.office_asset_lifecycle where asset_id=p_asset for update;
 if a.asset_id is null or a.lifecycle_status<>'DISPOSAL_PENDING' then raise exception 'Disposal-pending asset is required'; end if;
 if p_actor=a.updated_by then raise exception 'Last lifecycle operator cannot independently approve disposal'; end if;
 if a.security_wipe_required and a.wipe_evidence_reference is null then raise exception 'Verified secure-wipe evidence is required before disposal'; end if;
 if nullif(trim(coalesce(p_evidence,'')),'') is null then raise exception 'Disposal evidence reference is required'; end if;
 update public.office_asset_lifecycle set lifecycle_status='DISPOSED',custodian_user_id=null,disposal_evidence_reference=trim(p_evidence),disposal_approved_by=p_actor,disposal_approved_at=now(),updated_by=p_actor,updated_at=now() where asset_id=p_asset;
 update public.office_assets set assigned_employee_id=null,status='DISPOSED' where id=p_asset;
 insert into public.office_asset_events(asset_id,actor_user_id,event_type,previous_status,new_status,evidence_reference,note)
 values(p_asset,p_actor,'DISPOSED',a.lifecycle_status,'DISPOSED',trim(p_evidence),left(p_note,2000));
 return 'DISPOSED';
end; $$;

revoke all on function public.office_asset_lifecycle_register(uuid,varchar,uuid,text,date,text,boolean,date) from public,anon,authenticated;
revoke all on function public.office_asset_assign(uuid,varchar,uuid,text,text) from public,anon,authenticated;
revoke all on function public.office_asset_transition(uuid,varchar,text,text,text,text) from public,anon,authenticated;
revoke all on function public.office_asset_verify_wipe(uuid,varchar,text,text) from public,anon,authenticated;
revoke all on function public.office_asset_dispose(uuid,varchar,text,text) from public,anon,authenticated;

grant execute on function public.office_asset_lifecycle_register(uuid,varchar,uuid,text,date,text,boolean,date) to service_role;
grant execute on function public.office_asset_assign(uuid,varchar,uuid,text,text) to service_role;
grant execute on function public.office_asset_transition(uuid,varchar,text,text,text,text) to service_role;
grant execute on function public.office_asset_verify_wipe(uuid,varchar,text,text) to service_role;
grant execute on function public.office_asset_dispose(uuid,varchar,text,text) to service_role;
