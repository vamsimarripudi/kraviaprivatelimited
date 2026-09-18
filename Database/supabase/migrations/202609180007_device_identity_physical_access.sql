-- KRAVIA Office OS — device trust, digital identity and physical-access foundation.
-- Credentials store opaque token hashes only. They never store reusable secrets or raw NFC payloads.

insert into public.office_permission_catalog(code,module,action,label,description,sensitivity,high_risk,requires_managed_device,active) values
 ('identity.card.read','IDENTITY','READ','Read digital identity','Read an authorised digital identity credential in assigned scope.','SENSITIVE',false,false,true),
 ('identity.card.manage','IDENTITY','MANAGE','Manage digital identity','Issue, suspend and revoke digital or NFC-backed employee credentials.','HIGH',true,true,true),
 ('device.posture.read','ACCESS','READ','Read device posture','Read trusted-device compliance posture in assigned scope.','SENSITIVE',false,true,true),
 ('device.posture.manage','ACCESS','MANAGE','Manage device posture','Record or attest managed-device security posture.','HIGH',true,true,true),
 ('physical.access.read','ACCESS','READ','Read physical access','Read authorised physical access zones and current grants.','SENSITIVE',false,true,true),
 ('physical.access.manage','ACCESS','MANAGE','Manage physical access','Grant or revoke physical office access without changing employment authority.','CRITICAL',true,true,true)
on conflict(code) do update set module=excluded.module,action=excluded.action,label=excluded.label,description=excluded.description,sensitivity=excluded.sensitivity,high_risk=excluded.high_risk,requires_managed_device=excluded.requires_managed_device,active=true;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type)
select p.code,'identity.card.read','ALLOW','OWN' from public.office_access_profiles p
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type) values
 ('OFFICE_ADMIN','identity.card.manage','ALLOW','COMPANY'),
 ('OFFICE_ADMIN','device.posture.read','ALLOW','COMPANY'),
 ('OFFICE_ADMIN','physical.access.read','ALLOW','COMPANY'),
 ('SECURITY_OPERATOR','device.posture.read','ALLOW','COMPANY'),
 ('SECURITY_OPERATOR','device.posture.manage','ALLOW','COMPANY'),
 ('SECURITY_OPERATOR','physical.access.read','ALLOW','COMPANY'),
 ('SECURITY_OPERATOR','physical.access.manage','ALLOW','COMPANY'),
 ('HR_MANAGER','identity.card.manage','ALLOW','COMPANY'),
 ('HR_MANAGER','identity.card.read','ALLOW','COMPANY'),
 ('OPERATIONS_MANAGER','physical.access.read','ALLOW','COMPANY'),
 ('OPERATIONS_MANAGER','physical.access.manage','ALLOW','COMPANY')
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

create sequence if not exists public.office_identity_credential_seq;

create table if not exists public.office_identity_credentials(
 id uuid primary key default gen_random_uuid(),
 credential_code text not null unique default ('KR-ID-'||lpad(nextval('public.office_identity_credential_seq')::text,7,'0')),
 user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 credential_kind text not null check(credential_kind in ('DIGITAL_ID','NFC_CARD')),
 credential_token_hash text not null unique check(char_length(credential_token_hash)=64),
 status text not null default 'ACTIVE' check(status in ('ACTIVE','SUSPENDED','REVOKED','EXPIRED','LOST')),
 issued_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 issued_at timestamptz not null default now(),
 expires_at timestamptz,
 revoked_by uuid references public.office_identity_users(user_id) on delete restrict,
 revoked_at timestamptz,
 revocation_reason text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(expires_at is null or expires_at>issued_at)
);
create unique index if not exists office_identity_credentials_active_kind_idx on public.office_identity_credentials(user_id,credential_kind) where status='ACTIVE';
create index if not exists office_identity_credentials_user_idx on public.office_identity_credentials(user_id,status,expires_at);

create table if not exists public.office_device_posture_snapshots(
 id bigint generated always as identity primary key,
 device_id uuid not null references public.office_device_registry(id) on delete restrict,
 recorded_by uuid references public.office_identity_users(user_id) on delete restrict,
 checked_at timestamptz not null default now(),
 os_version text,
 encryption_enabled boolean,
 screen_lock_enabled boolean,
 security_agent_healthy boolean,
 patch_current boolean,
 firewall_enabled boolean,
 compromise_detected boolean not null default false,
 compliance_status text not null check(compliance_status in ('COMPLIANT','DEGRADED','NON_COMPLIANT','UNKNOWN')),
 source text not null default 'KRAVIA_OFFICE' check(source in ('KRAVIA_OFFICE','MDM','EDR','MANUAL_ATTESTATION','OTHER')),
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists office_device_posture_device_idx on public.office_device_posture_snapshots(device_id,checked_at desc);

create table if not exists public.office_physical_access_zones(
 id uuid primary key default gen_random_uuid(),
 zone_code text not null unique,
 name text not null,
 classification text not null default 'INTERNAL' check(classification in ('PUBLIC','INTERNAL','CONFIDENTIAL','RESTRICTED','CRITICAL')),
 description text,
 active boolean not null default true,
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.office_physical_access_grants(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 zone_id uuid not null references public.office_physical_access_zones(id) on delete restrict,
 credential_id uuid references public.office_identity_credentials(id) on delete restrict,
 effective_from timestamptz not null default now(),
 effective_to timestamptz,
 status text not null default 'ACTIVE' check(status in ('ACTIVE','SUSPENDED','REVOKED','EXPIRED')),
 approved_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 reason text not null,
 revoked_by uuid references public.office_identity_users(user_id) on delete restrict,
 revoked_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(effective_to is null or effective_to>effective_from)
);
create unique index if not exists office_physical_access_active_grant_idx on public.office_physical_access_grants(user_id,zone_id) where status='ACTIVE';
create index if not exists office_physical_access_user_idx on public.office_physical_access_grants(user_id,status,effective_to);

create table if not exists public.office_physical_access_events(
 id bigint generated always as identity primary key,
 user_id uuid references public.office_identity_users(user_id) on delete restrict,
 credential_id uuid references public.office_identity_credentials(id) on delete restrict,
 zone_id uuid references public.office_physical_access_zones(id) on delete restrict,
 event_type text not null check(event_type in ('CREDENTIAL_ISSUED','CREDENTIAL_SUSPENDED','CREDENTIAL_REVOKED','ZONE_GRANTED','ZONE_REVOKED','ACCESS_ALLOWED','ACCESS_DENIED')),
 actor_user_id uuid references public.office_identity_users(user_id) on delete restrict,
 reason text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

alter table public.office_identity_credentials enable row level security;
alter table public.office_device_posture_snapshots enable row level security;
alter table public.office_physical_access_zones enable row level security;
alter table public.office_physical_access_grants enable row level security;
alter table public.office_physical_access_events enable row level security;
revoke all on public.office_identity_credentials,public.office_device_posture_snapshots,public.office_physical_access_zones,public.office_physical_access_grants,public.office_physical_access_events from anon,authenticated,public;
grant select,insert,update on public.office_identity_credentials,public.office_physical_access_zones,public.office_physical_access_grants to service_role;
grant select,insert on public.office_device_posture_snapshots,public.office_physical_access_events to service_role;
grant usage,select on sequence public.office_identity_credential_seq to service_role;

create or replace function public.office_issue_identity_credential(p_actor uuid,p_user uuid,p_kind text,p_token_hash text,p_expires_at timestamptz,p_metadata jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_kind text:=upper(trim(p_kind));
begin
 if not public.office_effective_permission(p_actor,'identity.card.manage','COMPANY',null,null) then raise exception 'Digital identity management permission is required'; end if;
 if not exists(select 1 from public.office_identity_users where user_id=p_user and status='ACTIVE') then raise exception 'Active Office identity is required'; end if;
 if v_kind not in ('DIGITAL_ID','NFC_CARD') then raise exception 'Unsupported credential kind'; end if;
 if p_actor=p_user and not exists(select 1 from public.office_user_roles where user_id=p_actor and role='OWNER' and (expires_at is null or expires_at>now())) then raise exception 'Self-issuance is not allowed'; end if;
 update public.office_identity_credentials set status='REVOKED',revoked_by=p_actor,revoked_at=now(),revocation_reason='SUPERSEDED',updated_at=now() where user_id=p_user and credential_kind=v_kind and status='ACTIVE';
 insert into public.office_identity_credentials(user_id,credential_kind,credential_token_hash,issued_by,expires_at,metadata) values(p_user,v_kind,lower(trim(p_token_hash)),p_actor,p_expires_at,coalesce(p_metadata,'{}'::jsonb)) returning id into v_id;
 insert into public.office_physical_access_events(user_id,credential_id,event_type,actor_user_id,metadata) values(p_user,v_id,'CREDENTIAL_ISSUED',p_actor,jsonb_build_object('credential_kind',v_kind));
 return v_id;
end; $$;

create or replace function public.office_revoke_identity_credential(p_actor uuid,p_credential uuid,p_reason text)
returns boolean language plpgsql security definer set search_path='' as $$
declare c public.office_identity_credentials%rowtype;
begin
 if not public.office_effective_permission(p_actor,'identity.card.manage','COMPANY',null,null) then raise exception 'Digital identity management permission is required'; end if;
 select * into c from public.office_identity_credentials where id=p_credential for update;
 if c.id is null then raise exception 'Credential not found'; end if;
 if c.status='REVOKED' then return true; end if;
 update public.office_identity_credentials set status='REVOKED',revoked_by=p_actor,revoked_at=now(),revocation_reason=left(trim(p_reason),500),updated_at=now() where id=p_credential;
 update public.office_physical_access_grants set status='REVOKED',revoked_by=p_actor,revoked_at=now(),updated_at=now() where credential_id=p_credential and status='ACTIVE';
 insert into public.office_physical_access_events(user_id,credential_id,event_type,actor_user_id,reason) values(c.user_id,c.id,'CREDENTIAL_REVOKED',p_actor,left(trim(p_reason),500));
 return true;
end; $$;

create or replace function public.office_record_device_posture(p_actor uuid,p_device uuid,p_os text,p_encryption boolean,p_screen_lock boolean,p_agent boolean,p_patch boolean,p_firewall boolean,p_compromise boolean,p_status text,p_source text,p_details jsonb default '{}'::jsonb)
returns bigint language plpgsql security definer set search_path='' as $$
declare v_id bigint; d public.office_device_registry%rowtype; v_status text:=upper(trim(p_status)); v_source text:=upper(trim(p_source));
begin
 if not public.office_effective_permission(p_actor,'device.posture.manage','COMPANY',null,null) then raise exception 'Device posture management permission is required'; end if;
 select * into d from public.office_device_registry where id=p_device;
 if d.id is null then raise exception 'Device not found'; end if;
 if v_status not in ('COMPLIANT','DEGRADED','NON_COMPLIANT','UNKNOWN') then raise exception 'Invalid compliance status'; end if;
 if v_source not in ('KRAVIA_OFFICE','MDM','EDR','MANUAL_ATTESTATION','OTHER') then raise exception 'Invalid posture source'; end if;
 insert into public.office_device_posture_snapshots(device_id,recorded_by,os_version,encryption_enabled,screen_lock_enabled,security_agent_healthy,patch_current,firewall_enabled,compromise_detected,compliance_status,source,details)
 values(p_device,p_actor,nullif(trim(coalesce(p_os,'')),''),p_encryption,p_screen_lock,p_agent,p_patch,p_firewall,coalesce(p_compromise,false),v_status,v_source,coalesce(p_details,'{}'::jsonb)) returning id into v_id;
 update public.office_device_registry set last_seen_at=now(),updated_at=now(),trust_state=case when v_status='COMPLIANT' and not coalesce(p_compromise,false) then trust_state when v_status='NON_COMPLIANT' or coalesce(p_compromise,false) then 'REVOKED' else trust_state end,revoked_at=case when v_status='NON_COMPLIANT' or coalesce(p_compromise,false) then coalesce(revoked_at,now()) else revoked_at end where id=p_device;
 return v_id;
end; $$;

create or replace function public.office_grant_physical_access(p_actor uuid,p_user uuid,p_zone uuid,p_credential uuid,p_from timestamptz,p_to timestamptz,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; z public.office_physical_access_zones%rowtype; c public.office_identity_credentials%rowtype;
begin
 if not public.office_effective_permission(p_actor,'physical.access.manage','COMPANY',null,null) then raise exception 'Physical access management permission is required'; end if;
 if p_actor=p_user then raise exception 'Self-grant is not allowed'; end if;
 if not exists(select 1 from public.office_identity_users where user_id=p_user and status='ACTIVE') then raise exception 'Active Office identity is required'; end if;
 select * into z from public.office_physical_access_zones where id=p_zone and active=true;
 if z.id is null then raise exception 'Active access zone is required'; end if;
 if p_credential is not null then
  select * into c from public.office_identity_credentials where id=p_credential and user_id=p_user and status='ACTIVE';
  if c.id is null then raise exception 'Active credential does not belong to user'; end if;
 end if;
 update public.office_physical_access_grants set status='REVOKED',revoked_by=p_actor,revoked_at=now(),updated_at=now() where user_id=p_user and zone_id=p_zone and status='ACTIVE';
 insert into public.office_physical_access_grants(user_id,zone_id,credential_id,effective_from,effective_to,approved_by,reason)
 values(p_user,p_zone,p_credential,coalesce(p_from,now()),p_to,p_actor,trim(p_reason)) returning id into v_id;
 insert into public.office_physical_access_events(user_id,credential_id,zone_id,event_type,actor_user_id,reason) values(p_user,p_credential,p_zone,'ZONE_GRANTED',p_actor,left(trim(p_reason),500));
 return v_id;
end; $$;

create or replace function public.office_revoke_physical_access(p_actor uuid,p_grant uuid,p_reason text)
returns boolean language plpgsql security definer set search_path='' as $$
declare g public.office_physical_access_grants%rowtype;
begin
 if not public.office_effective_permission(p_actor,'physical.access.manage','COMPANY',null,null) then raise exception 'Physical access management permission is required'; end if;
 select * into g from public.office_physical_access_grants where id=p_grant for update;
 if g.id is null then raise exception 'Physical access grant not found'; end if;
 if g.status='REVOKED' then return true; end if;
 update public.office_physical_access_grants set status='REVOKED',revoked_by=p_actor,revoked_at=now(),updated_at=now() where id=p_grant;
 insert into public.office_physical_access_events(user_id,credential_id,zone_id,event_type,actor_user_id,reason) values(g.user_id,g.credential_id,g.zone_id,'ZONE_REVOKED',p_actor,left(trim(p_reason),500));
 return true;
end; $$;

revoke all on function public.office_issue_identity_credential(uuid,uuid,text,text,timestamptz,jsonb) from public,anon,authenticated;
revoke all on function public.office_revoke_identity_credential(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.office_record_device_posture(uuid,uuid,text,boolean,boolean,boolean,boolean,boolean,boolean,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.office_grant_physical_access(uuid,uuid,uuid,uuid,timestamptz,timestamptz,text) from public,anon,authenticated;
revoke all on function public.office_revoke_physical_access(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.office_issue_identity_credential(uuid,uuid,text,text,timestamptz,jsonb) to service_role;
grant execute on function public.office_revoke_identity_credential(uuid,uuid,text) to service_role;
grant execute on function public.office_record_device_posture(uuid,uuid,text,boolean,boolean,boolean,boolean,boolean,boolean,text,text,jsonb) to service_role;
grant execute on function public.office_grant_physical_access(uuid,uuid,uuid,uuid,timestamptz,timestamptz,text) to service_role;
grant execute on function public.office_revoke_physical_access(uuid,uuid,text) to service_role;
