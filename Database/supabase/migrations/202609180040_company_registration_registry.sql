-- KRAVIA Office OS — company registration registry.
-- Operational references are masked. Creation is UNVERIFIED and independent review is required
-- before a registration may be represented as ACTIVE. No authority credentials or portal secrets are stored.

insert into public.office_permission_catalog(code,module,action,label,description,sensitivity,high_risk,requires_managed_device,active) values
 ('registration.read','REGISTRATIONS','READ','Read registrations','Read company registration metadata, masked references, renewal dates and evidence references.','SENSITIVE',false,true,true),
 ('registration.manage','REGISTRATIONS','MANAGE','Manage registrations','Create and maintain company registration and renewal metadata without storing authority credentials.','HIGH',true,true,true),
 ('registration.review','REGISTRATIONS','REVIEW','Review registrations','Independently verify or reject registration records against authoritative evidence.','CRITICAL',true,true,true)
on conflict(code) do update set module=excluded.module,action=excluded.action,label=excluded.label,description=excluded.description,sensitivity=excluded.sensitivity,high_risk=excluded.high_risk,requires_managed_device=excluded.requires_managed_device,active=true;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type) values
 ('CS_SECRETARIAL','registration.read','ALLOW','COMPANY'),
 ('CS_SECRETARIAL','registration.manage','ALLOW','COMPANY'),
 ('CS_SECRETARIAL','registration.review','ALLOW','COMPANY'),
 ('LEGAL_COUNSEL','registration.read','ALLOW','COMPANY'),
 ('LEGAL_COUNSEL','registration.review','ALLOW','COMPANY'),
 ('CA_TAX','registration.read','ALLOW','COMPANY'),
 ('CA_TAX','registration.review','ALLOW','COMPANY'),
 ('AUDITOR_READONLY','registration.read','ALLOW','COMPANY')
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

create sequence if not exists public.office_registration_seq;
grant usage,select on sequence public.office_registration_seq to service_role;

create table if not exists public.office_company_registrations(
 id uuid primary key default gen_random_uuid(),
 registration_code text not null unique default ('KR-REG-'||lpad(nextval('public.office_registration_seq')::text,7,'0')),
 registration_type text not null check(char_length(trim(registration_type)) between 2 and 100),
 title text not null check(char_length(trim(title)) between 2 and 220),
 authority text not null check(char_length(trim(authority)) between 2 and 220),
 jurisdiction text not null default 'IN' check(char_length(trim(jurisdiction)) between 2 and 80),
 identifier_masked text not null check(char_length(trim(identifier_masked)) between 6 and 40),
 issued_on date,
 expires_on date,
 renewal_due_on date,
 status text not null default 'UNVERIFIED' check(status in ('UNVERIFIED','ACTIVE','RENEWAL_DUE','EXPIRED','REJECTED','SUPERSEDED','CANCELLED')),
 source_reference text not null check(char_length(trim(source_reference)) between 3 and 1200),
 evidence_reference text,
 owner_user_id uuid references public.office_identity_users(user_id) on delete restrict,
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 verified_by uuid references public.office_identity_users(user_id) on delete restrict,
 verified_at timestamptz,
 review_note text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(expires_on is null or issued_on is null or expires_on>=issued_on),
 check(renewal_due_on is null or issued_on is null or renewal_due_on>=issued_on)
);
create index if not exists office_company_registrations_status_idx on public.office_company_registrations(status,renewal_due_on,expires_on);
create index if not exists office_company_registrations_type_idx on public.office_company_registrations(registration_type,authority);

create table if not exists public.office_registration_events(
 id bigint generated always as identity primary key,
 actor_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 registration_id uuid not null references public.office_company_registrations(id) on delete restrict,
 event_type text not null,
 previous_status text,
 new_status text,
 note text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists office_registration_events_record_idx on public.office_registration_events(registration_id,created_at desc);

alter table public.office_company_registrations enable row level security;
alter table public.office_registration_events enable row level security;
revoke all on public.office_company_registrations,public.office_registration_events from public,anon,authenticated;
grant select,insert,update on public.office_company_registrations to service_role;
grant select,insert on public.office_registration_events to service_role;
