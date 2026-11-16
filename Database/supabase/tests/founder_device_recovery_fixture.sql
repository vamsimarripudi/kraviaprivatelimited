-- Disposable, synthetic PostgreSQL fixture; never use production identities.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create extension if not exists pgcrypto;
create table public.office_identity_users(
 user_id uuid primary key,status text not null,display_name text
);
create table public.office_user_roles(
 user_id uuid not null references public.office_identity_users(user_id),
 role text not null, expires_at timestamptz,
 primary key(user_id,role)
);
create table public.office_device_registry(
 id uuid primary key,
 user_id uuid not null references public.office_identity_users(user_id),
 device_label text, device_kind text,platform text,trust_state text,
 company_managed boolean default false,approved_by uuid,approved_at timestamptz,
 revoked_at timestamptz,last_seen_at timestamptz,created_at timestamptz default now(),
 updated_at timestamptz default now(),
 binding_token_hash text,bound_at timestamptz,bound_user_agent_hash text
);
create table public.office_device_posture_snapshots(
 id bigint generated always as identity primary key,
 device_id uuid not null references public.office_device_registry(id),
 recorded_by uuid not null references public.office_identity_users(user_id),
 checked_at timestamptz not null default now(),os_version text,
 encryption_enabled boolean,screen_lock_enabled boolean,
 security_agent_healthy boolean,patch_current boolean,
 firewall_enabled boolean,compromise_detected boolean not null default false,
 compliance_status text not null,source text not null,details jsonb not null default '{}'
);
create table public.office_access_audit(
 id bigint generated always as identity primary key,
 actor_user_id uuid,actor_roles text[],target_user_id uuid,action text,
 reason text,metadata jsonb,created_at timestamptz default now()
);
create table public.office_access_profile_catalog(
 code text primary key,max_active_devices integer
);
create table public.office_user_access_profiles(
 user_id uuid not null,profile_code text not null,
 status text,expires_at timestamptz
);
create or replace function public.office_actor_can_administer_target(p_actor uuid,p_target uuid)
returns boolean language sql stable as $$
 select p_actor<>p_target and exists(select 1 from public.office_user_roles
 where user_id=p_actor and role='ADMIN');
$$;
insert into public.office_identity_users(user_id,status,display_name) values
 ('00000000-0000-0000-0000-000000000001','ACTIVE','Sample Founder'),
 ('00000000-0000-0000-0000-000000000002','ACTIVE','Sample Director'),
 ('00000000-0000-0000-0000-000000000003','ACTIVE','Sample Admin');
insert into public.office_user_roles(user_id,role) values
 ('00000000-0000-0000-0000-000000000001','OWNER'),
 ('00000000-0000-0000-0000-000000000002','DIRECTOR'),
 ('00000000-0000-0000-0000-000000000003','ADMIN');
insert into public.office_device_registry(
id,user_id,device_label,device_kind,platform,trust_state,company_managed,revoked_at,binding_token_hash,bound_at,bound_user_agent_hash)
values(
'00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001',
'Sample Founder laptop','LAPTOP','Windows 11','REVOKED',false,
now()-interval '1 hour',repeat('a',64),now()-interval '2 hours',repeat('b',64));
-- Preserve historical erroneous observation; migration must not rewrite it.
insert into public.office_device_posture_snapshots(
device_id,recorded_by,os_version,encryption_enabled,screen_lock_enabled,security_agent_healthy,
patch_current,firewall_enabled,compromise_detected,compliance_status,source)
values('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001',
'Windows 11',true,true,true,true,true,true,'COMPLIANT','KRAVIA_OFFICE');
