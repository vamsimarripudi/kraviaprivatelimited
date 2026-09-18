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


create or replace function public.office_registration_create(
 p_actor uuid,p_type text,p_title text,p_authority text,p_jurisdiction text,p_identifier_masked text,
 p_issued date,p_expires date,p_renewal date,p_source text,p_evidence text,p_owner uuid
) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid;
begin
 if not exists(select 1 from public.office_identity_users where user_id=p_actor and status='ACTIVE') then raise exception 'Active Office identity required'; end if;
 if p_owner is not null and not exists(select 1 from public.office_identity_users where user_id=p_owner and status='ACTIVE') then raise exception 'Active registration owner required'; end if;
 insert into public.office_company_registrations(registration_type,title,authority,jurisdiction,identifier_masked,issued_on,expires_on,renewal_due_on,source_reference,evidence_reference,owner_user_id,created_by)
 values(upper(trim(p_type)),trim(p_title),trim(p_authority),upper(trim(coalesce(nullif(p_jurisdiction,''),'IN'))),trim(p_identifier_masked),p_issued,p_expires,p_renewal,trim(p_source),nullif(trim(coalesce(p_evidence,'')),''),p_owner,p_actor)
 returning id into v_id;
 insert into public.office_registration_events(actor_user_id,registration_id,event_type,new_status,metadata)
 values(p_actor,v_id,'REGISTRATION_CREATED','UNVERIFIED',jsonb_build_object('registration_type',upper(trim(p_type)),'authority',trim(p_authority)));
 return v_id;
end; $$;

create or replace function public.office_registration_review(
 p_actor uuid,p_registration uuid,p_status text,p_note text,p_evidence text
) returns text language plpgsql security invoker set search_path='' as $$
declare r public.office_company_registrations%rowtype; target text:=upper(trim(p_status));
begin
 if not exists(select 1 from public.office_identity_users where user_id=p_actor and status='ACTIVE') then raise exception 'Active Office identity required'; end if;
 select * into r from public.office_company_registrations where id=p_registration for update;
 if r.id is null then raise exception 'Registration not found'; end if;
 if r.status<>'UNVERIFIED' then raise exception 'Only unverified registrations can receive initial independent review'; end if;
 if r.created_by=p_actor then raise exception 'Registration creator cannot independently verify the same record'; end if;
 if target not in ('ACTIVE','REJECTED') then raise exception 'Registration review must be ACTIVE or REJECTED'; end if;
 if target='ACTIVE' and nullif(trim(coalesce(p_evidence,r.evidence_reference,'')),'') is null then raise exception 'Verification evidence reference is required'; end if;
 update public.office_company_registrations set status=target,evidence_reference=coalesce(nullif(trim(coalesce(p_evidence,'')),''),evidence_reference),verified_by=p_actor,verified_at=now(),review_note=nullif(trim(coalesce(p_note,'')),''),updated_at=now() where id=r.id;
 insert into public.office_registration_events(actor_user_id,registration_id,event_type,previous_status,new_status,note)
 values(p_actor,r.id,'REGISTRATION_REVIEWED',r.status,target,left(trim(coalesce(p_note,'')),2000));
 return target;
end; $$;

create or replace function public.office_registration_update(
 p_actor uuid,p_registration uuid,p_expires date,p_renewal date,p_status text,p_source text,p_evidence text,p_owner uuid,p_note text
) returns text language plpgsql security invoker set search_path='' as $$
declare r public.office_company_registrations%rowtype; target text:=upper(trim(p_status));
begin
 if not exists(select 1 from public.office_identity_users where user_id=p_actor and status='ACTIVE') then raise exception 'Active Office identity required'; end if;
 select * into r from public.office_company_registrations where id=p_registration for update;
 if r.id is null then raise exception 'Registration not found'; end if;
 if r.status in ('UNVERIFIED','REJECTED') then raise exception 'Complete independent registration verification before lifecycle updates'; end if;
 if target not in ('ACTIVE','RENEWAL_DUE','EXPIRED','SUPERSEDED','CANCELLED') then raise exception 'Invalid registration lifecycle status'; end if;
 if p_owner is not null and not exists(select 1 from public.office_identity_users where user_id=p_owner and status='ACTIVE') then raise exception 'Active registration owner required'; end if;
 if p_expires is not null and r.issued_on is not null and p_expires<r.issued_on then raise exception 'Expiry cannot precede issue date'; end if;
 if p_renewal is not null and r.issued_on is not null and p_renewal<r.issued_on then raise exception 'Renewal due date cannot precede issue date'; end if;
 update public.office_company_registrations set expires_on=p_expires,renewal_due_on=p_renewal,status=target,source_reference=coalesce(nullif(trim(coalesce(p_source,'')),''),source_reference),evidence_reference=coalesce(nullif(trim(coalesce(p_evidence,'')),''),evidence_reference),owner_user_id=p_owner,updated_at=now() where id=r.id;
 insert into public.office_registration_events(actor_user_id,registration_id,event_type,previous_status,new_status,note,metadata)
 values(p_actor,r.id,'REGISTRATION_UPDATED',r.status,target,left(trim(coalesce(p_note,'')),2000),jsonb_build_object('expires_on',p_expires,'renewal_due_on',p_renewal));
 return target;
end; $$;

revoke all on function public.office_registration_create(uuid,text,text,text,text,text,date,date,date,text,text,uuid) from public,anon,authenticated;
revoke all on function public.office_registration_review(uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.office_registration_update(uuid,uuid,date,date,text,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.office_registration_create(uuid,text,text,text,text,text,date,date,date,text,text,uuid) to service_role;
grant execute on function public.office_registration_review(uuid,uuid,text,text,text) to service_role;
grant execute on function public.office_registration_update(uuid,uuid,date,date,text,text,text,uuid,text) to service_role;
