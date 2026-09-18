-- KRAVIA Office OS — employee emergency contacts.
-- Contacts are private safety records. Employees maintain their own records.
-- Privileged read is explicit and owner-bypass is disabled so executive/OWNER status alone does not expose them.

insert into public.office_permission_catalog(
  code,module,action,label,description,sensitivity,high_risk,requires_managed_device,active,owner_bypass
) values
 ('people.emergency_contact.own','PEOPLE','MANAGE_OWN_EMERGENCY_CONTACT','Manage own emergency contact','Create, update, confirm and deactivate the actor''s own emergency contacts.','SENSITIVE',false,false,true,true),
 ('people.emergency_contact.read','PEOPLE','READ_EMERGENCY_CONTACT','Read emergency contacts','Read restricted employee emergency contacts for legitimate HR/safety use only. OWNER/executive status does not bypass this permission.','CRITICAL',true,true,true,false)
on conflict(code) do update set
 module=excluded.module,action=excluded.action,label=excluded.label,description=excluded.description,
 sensitivity=excluded.sensitivity,high_risk=excluded.high_risk,
 requires_managed_device=excluded.requires_managed_device,active=true,owner_bypass=excluded.owner_bypass;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type)
select code,'people.emergency_contact.own','ALLOW','OWN'
from public.office_access_profile_catalog
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type) values
 ('HR_MANAGER','people.emergency_contact.read','ALLOW','COMPANY'),
 ('SECURITY_OPERATOR','people.emergency_contact.read','ALLOW','COMPANY'),
 ('OPERATIONS_MANAGER','people.emergency_contact.read','ALLOW','COMPANY')
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

create table if not exists public.office_emergency_contacts(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 priority smallint not null check(priority between 1 and 3),
 full_name text not null check(char_length(trim(full_name)) between 2 and 180),
 relationship text not null check(char_length(trim(relationship)) between 2 and 100),
 phone_e164 text not null check(phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
 email text,
 notes text check(notes is null or char_length(notes)<=1000),
 active boolean not null default true,
 confirmed_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index if not exists office_emergency_contacts_active_priority_idx
  on public.office_emergency_contacts(user_id,priority) where active=true;
create index if not exists office_emergency_contacts_user_idx
  on public.office_emergency_contacts(user_id,active,priority);

create table if not exists public.office_emergency_contact_events(
 id bigint generated always as identity primary key,
 contact_id uuid not null references public.office_emergency_contacts(id) on delete restrict,
 actor_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 event_type text not null check(event_type in ('CREATED','UPDATED','CONFIRMED','DEACTIVATED','VIEWED_BY_SAFETY')),
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists office_emergency_contact_events_contact_idx
  on public.office_emergency_contact_events(contact_id,created_at desc);

alter table public.office_emergency_contacts enable row level security;
alter table public.office_emergency_contact_events enable row level security;
revoke all on public.office_emergency_contacts,public.office_emergency_contact_events from public,anon,authenticated;
grant select,insert,update on public.office_emergency_contacts to service_role;
grant select,insert on public.office_emergency_contact_events to service_role;

create or replace function public.office_emergency_contact_upsert(
 p_actor uuid,p_contact uuid,p_priority smallint,p_name text,p_relationship text,p_phone text,p_email text,p_notes text,p_attest boolean
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare c public.office_emergency_contacts%rowtype; v_id uuid; v_event text;
begin
 if not public.office_effective_permission(p_actor,'people.emergency_contact.own','OWN',p_actor::text,null) then
   raise exception 'Own emergency-contact permission is required';
 end if;
 if coalesce(p_attest,false)=false then
   raise exception 'Employee attestation is required';
 end if;
 if p_phone !~ '^\+[1-9][0-9]{7,14}$' then
   raise exception 'Emergency-contact phone must use E.164 format';
 end if;
 if p_email is not null and trim(p_email)<>'' and trim(p_email) !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
   raise exception 'Invalid emergency-contact email';
 end if;

 if p_contact is null then
   insert into public.office_emergency_contacts(user_id,priority,full_name,relationship,phone_e164,email,notes,confirmed_at)
   values(p_actor,p_priority,trim(p_name),trim(p_relationship),trim(p_phone),nullif(lower(trim(coalesce(p_email,''))),''),nullif(trim(coalesce(p_notes,'')),''),now())
   returning id into v_id;
   v_event:='CREATED';
 else
   select * into c from public.office_emergency_contacts where id=p_contact for update;
   if c.id is null or c.user_id<>p_actor or c.active=false then raise exception 'Active own emergency contact is required'; end if;
   update public.office_emergency_contacts
   set priority=p_priority,full_name=trim(p_name),relationship=trim(p_relationship),phone_e164=trim(p_phone),
       email=nullif(lower(trim(coalesce(p_email,''))),''),notes=nullif(trim(coalesce(p_notes,'')),''),
       confirmed_at=now(),updated_at=now()
   where id=c.id
   returning id into v_id;
   v_event:='UPDATED';
 end if;

 insert into public.office_emergency_contact_events(contact_id,actor_user_id,event_type,metadata)
 values(v_id,p_actor,v_event,jsonb_build_object('priority',p_priority,'attested',true));
 return v_id;
end;
$$;

create or replace function public.office_emergency_contact_confirm(p_actor uuid,p_contact uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare c public.office_emergency_contacts%rowtype;
begin
 if not public.office_effective_permission(p_actor,'people.emergency_contact.own','OWN',p_actor::text,null) then
   raise exception 'Own emergency-contact permission is required';
 end if;
 select * into c from public.office_emergency_contacts where id=p_contact for update;
 if c.id is null or c.user_id<>p_actor or c.active=false then raise exception 'Active own emergency contact is required'; end if;
 update public.office_emergency_contacts set confirmed_at=now(),updated_at=now() where id=c.id;
 insert into public.office_emergency_contact_events(contact_id,actor_user_id,event_type)
 values(c.id,p_actor,'CONFIRMED');
 return true;
end;
$$;

create or replace function public.office_emergency_contact_deactivate(p_actor uuid,p_contact uuid,p_reason text)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare c public.office_emergency_contacts%rowtype;
begin
 if not public.office_effective_permission(p_actor,'people.emergency_contact.own','OWN',p_actor::text,null) then
   raise exception 'Own emergency-contact permission is required';
 end if;
 select * into c from public.office_emergency_contacts where id=p_contact for update;
 if c.id is null or c.user_id<>p_actor or c.active=false then raise exception 'Active own emergency contact is required'; end if;
 if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'Deactivation reason is required'; end if;
 update public.office_emergency_contacts set active=false,updated_at=now() where id=c.id;
 insert into public.office_emergency_contact_events(contact_id,actor_user_id,event_type,metadata)
 values(c.id,p_actor,'DEACTIVATED',jsonb_build_object('reason',left(trim(p_reason),1000)));
 return true;
end;
$$;

revoke all on function public.office_emergency_contact_upsert(uuid,uuid,smallint,text,text,text,text,text,boolean) from public,anon,authenticated;
revoke all on function public.office_emergency_contact_confirm(uuid,uuid) from public,anon,authenticated;
revoke all on function public.office_emergency_contact_deactivate(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.office_emergency_contact_upsert(uuid,uuid,smallint,text,text,text,text,text,boolean) to service_role;
grant execute on function public.office_emergency_contact_confirm(uuid,uuid) to service_role;
grant execute on function public.office_emergency_contact_deactivate(uuid,uuid,text) to service_role;
