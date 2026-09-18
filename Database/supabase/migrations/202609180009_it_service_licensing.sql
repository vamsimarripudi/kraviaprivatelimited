-- KRAVIA Office OS — IT service desk and software licence control.
insert into public.office_permission_catalog(code,module,action,label,description,sensitivity,high_risk,requires_managed_device,active) values
 ('it.service.request','IT','REQUEST','Request IT service','Create a tracked IT support or access/service request.','STANDARD',false,false,true),
 ('it.service.read','IT','READ','Read IT service','Read IT service tickets within assigned scope.','SENSITIVE',false,false,true),
 ('it.service.manage','IT','MANAGE','Manage IT service','Assign, update and resolve IT service tickets.','HIGH',false,true,true),
 ('it.license.read','IT','READ','Read software licences','Read company software licence inventory and assignments.','SENSITIVE',false,true,true),
 ('it.license.manage','IT','MANAGE','Manage software licences','Create licence records and assign or revoke seats.','HIGH',true,true,true)
on conflict(code) do update set module=excluded.module,action=excluded.action,label=excluded.label,description=excluded.description,sensitivity=excluded.sensitivity,high_risk=excluded.high_risk,requires_managed_device=excluded.requires_managed_device,active=true;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type)
select code,'it.service.request','ALLOW','OWN' from public.office_access_profile_catalog
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type) values
 ('OFFICE_ADMIN','it.service.read','ALLOW','COMPANY'),
 ('OFFICE_ADMIN','it.service.manage','ALLOW','COMPANY'),
 ('OFFICE_ADMIN','it.license.read','ALLOW','COMPANY'),
 ('OFFICE_ADMIN','it.license.manage','ALLOW','COMPANY'),
 ('OPERATIONS_MANAGER','it.service.read','ALLOW','COMPANY'),
 ('OPERATIONS_MANAGER','it.service.manage','ALLOW','COMPANY'),
 ('OPERATIONS_MANAGER','it.license.read','ALLOW','COMPANY'),
 ('SECURITY_OPERATOR','it.service.read','ALLOW','COMPANY'),
 ('SECURITY_OPERATOR','it.license.read','ALLOW','COMPANY'),
 ('AUDITOR_READONLY','it.license.read','ALLOW','COMPANY')
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

create sequence if not exists public.office_it_ticket_seq;
create sequence if not exists public.office_software_license_seq;

create table if not exists public.office_it_service_tickets(
 id uuid primary key default gen_random_uuid(),
 ticket_code text not null unique default ('KR-IT-'||lpad(nextval('public.office_it_ticket_seq')::text,7,'0')),
 requester_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 owner_user_id uuid references public.office_identity_users(user_id) on delete restrict,
 department_code text,
 category text not null check(category in ('DEVICE','SOFTWARE','ACCESS','EMAIL','MFA','NETWORK','VPN','PRINTER','SECURITY','OTHER')),
 priority text not null default 'NORMAL' check(priority in ('LOW','NORMAL','HIGH','URGENT')),
 title text not null check(char_length(trim(title)) between 3 and 180),
 description text not null check(char_length(trim(description)) between 3 and 5000),
 status text not null default 'OPEN' check(status in ('OPEN','TRIAGED','IN_PROGRESS','WAITING_USER','WAITING_VENDOR','RESOLVED','CLOSED','CANCELLED')),
 related_device_id uuid references public.office_device_registry(id) on delete restrict,
 related_request_id uuid references public.office_requests(id) on delete restrict,
 resolution text,
 due_at timestamptz,
 resolved_at timestamptz,
 closed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists office_it_service_requester_idx on public.office_it_service_tickets(requester_user_id,status,created_at desc);
create index if not exists office_it_service_owner_idx on public.office_it_service_tickets(owner_user_id,status,priority);

create table if not exists public.office_software_licenses(
 id uuid primary key default gen_random_uuid(),
 license_code text not null unique default ('KR-LIC-'||lpad(nextval('public.office_software_license_seq')::text,7,'0')),
 vendor_name text not null,
 product_name text not null,
 plan_name text,
 billing_cycle text check(billing_cycle is null or billing_cycle in ('MONTHLY','ANNUAL','MULTI_YEAR','PERPETUAL','USAGE')),
 total_seats integer check(total_seats is null or total_seats>=0),
 currency text check(currency is null or char_length(currency)=3),
 cost_minor bigint check(cost_minor is null or cost_minor>=0),
 renewal_at timestamptz,
 notice_at timestamptz,
 auto_renew boolean not null default false,
 contract_reference text,
 procurement_reference text,
 status text not null default 'ACTIVE' check(status in ('PLANNED','ACTIVE','SUSPENDED','CANCEL_SCHEDULED','CANCELLED','EXPIRED')),
 owner_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists office_software_licenses_renewal_idx on public.office_software_licenses(status,renewal_at);

create table if not exists public.office_software_license_assignments(
 id uuid primary key default gen_random_uuid(),
 license_id uuid not null references public.office_software_licenses(id) on delete restrict,
 user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 assigned_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 assigned_at timestamptz not null default now(),
 expires_at timestamptz,
 status text not null default 'ACTIVE' check(status in ('ACTIVE','REVOKED','EXPIRED')),
 external_seat_reference text,
 revoked_by uuid references public.office_identity_users(user_id) on delete restrict,
 revoked_at timestamptz,
 revocation_reason text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index if not exists office_software_license_assignment_active_idx on public.office_software_license_assignments(license_id,user_id) where status='ACTIVE';

create table if not exists public.office_it_events(
 id bigint generated always as identity primary key,
 ticket_id uuid references public.office_it_service_tickets(id) on delete cascade,
 license_id uuid references public.office_software_licenses(id) on delete restrict,
 assignment_id uuid references public.office_software_license_assignments(id) on delete restrict,
 actor_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 event_type text not null,
 previous_status text,
 new_status text,
 note text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

alter table public.office_it_service_tickets enable row level security;
alter table public.office_software_licenses enable row level security;
alter table public.office_software_license_assignments enable row level security;
alter table public.office_it_events enable row level security;
revoke all on public.office_it_service_tickets,public.office_software_licenses,public.office_software_license_assignments,public.office_it_events from anon,authenticated,public;
grant select,insert,update on public.office_it_service_tickets,public.office_software_licenses,public.office_software_license_assignments to service_role;
grant select,insert on public.office_it_events to service_role;
grant usage,select on sequence public.office_it_ticket_seq,public.office_software_license_seq to service_role;

create or replace function public.office_it_create_ticket(p_actor uuid,p_category text,p_priority text,p_title text,p_description text,p_device uuid,p_due timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_department text;
begin
 if not public.office_effective_permission(p_actor,'it.service.request','OWN',null,p_actor)
    and not public.office_effective_permission(p_actor,'it.service.request','COMPANY',null,null) then raise exception 'IT service request permission is required'; end if;
 select primary_department into v_department from public.office_identity_users where user_id=p_actor and status='ACTIVE';
 if not found then raise exception 'Active Office identity is required'; end if;
 insert into public.office_it_service_tickets(requester_user_id,department_code,category,priority,title,description,related_device_id,due_at)
 values(p_actor,v_department,upper(trim(p_category)),upper(trim(p_priority)),trim(p_title),trim(p_description),p_device,p_due) returning id into v_id;
 insert into public.office_it_events(ticket_id,actor_user_id,event_type,new_status) values(v_id,p_actor,'TICKET_CREATED','OPEN');
 return v_id;
end; $$;

create or replace function public.office_it_transition_ticket(p_actor uuid,p_ticket uuid,p_status text,p_owner uuid,p_note text)
returns text language plpgsql security definer set search_path='' as $$
declare t public.office_it_service_tickets%rowtype; v_status text:=upper(trim(p_status));
begin
 if not public.office_effective_permission(p_actor,'it.service.manage','COMPANY',null,null) then raise exception 'IT service management permission is required'; end if;
 select * into t from public.office_it_service_tickets where id=p_ticket for update;
 if t.id is null then raise exception 'IT ticket not found'; end if;
 if v_status not in ('OPEN','TRIAGED','IN_PROGRESS','WAITING_USER','WAITING_VENDOR','RESOLVED','CLOSED','CANCELLED') then raise exception 'Invalid IT ticket status'; end if;
 if p_owner is not null and not exists(select 1 from public.office_identity_users where user_id=p_owner and status='ACTIVE') then raise exception 'Active ticket owner is required'; end if;
 if v_status='RESOLVED' and char_length(trim(coalesce(p_note,'')))<3 then raise exception 'Resolution note is required'; end if;
 update public.office_it_service_tickets set status=v_status,owner_user_id=coalesce(p_owner,owner_user_id),resolution=case when v_status='RESOLVED' then trim(p_note) else resolution end,resolved_at=case when v_status='RESOLVED' then now() else resolved_at end,closed_at=case when v_status='CLOSED' then now() else closed_at end,updated_at=now() where id=p_ticket;
 insert into public.office_it_events(ticket_id,actor_user_id,event_type,previous_status,new_status,note) values(p_ticket,p_actor,'TICKET_TRANSITIONED',t.status,v_status,left(trim(coalesce(p_note,'')),1000));
 return v_status;
end; $$;

create or replace function public.office_it_create_license(p_actor uuid,p_owner uuid,p_vendor text,p_product text,p_plan text,p_cycle text,p_seats integer,p_currency text,p_cost bigint,p_renewal timestamptz,p_notice timestamptz,p_auto boolean,p_contract text,p_procurement text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not public.office_effective_permission(p_actor,'it.license.manage','COMPANY',null,null) then raise exception 'Software licence management permission is required'; end if;
 if not exists(select 1 from public.office_identity_users where user_id=p_owner and status='ACTIVE') then raise exception 'Active licence owner is required'; end if;
 insert into public.office_software_licenses(vendor_name,product_name,plan_name,billing_cycle,total_seats,currency,cost_minor,renewal_at,notice_at,auto_renew,contract_reference,procurement_reference,owner_user_id,created_by)
 values(trim(p_vendor),trim(p_product),nullif(trim(coalesce(p_plan,'')),''),case when p_cycle is null or trim(p_cycle)='' then null else upper(trim(p_cycle)) end,p_seats,case when p_currency is null or trim(p_currency)='' then null else upper(trim(p_currency)) end,p_cost,p_renewal,p_notice,coalesce(p_auto,false),nullif(trim(coalesce(p_contract,'')),''),nullif(trim(coalesce(p_procurement,'')),''),p_owner,p_actor) returning id into v_id;
 insert into public.office_it_events(license_id,actor_user_id,event_type,new_status) values(v_id,p_actor,'LICENSE_CREATED','ACTIVE');
 return v_id;
end; $$;

create or replace function public.office_it_assign_license(p_actor uuid,p_license uuid,p_user uuid,p_external_ref text,p_expires timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare l public.office_software_licenses%rowtype; v_id uuid; v_used integer;
begin
 if not public.office_effective_permission(p_actor,'it.license.manage','COMPANY',null,null) then raise exception 'Software licence management permission is required'; end if;
 select * into l from public.office_software_licenses where id=p_license for update;
 if l.id is null or l.status<>'ACTIVE' then raise exception 'Active software licence is required'; end if;
 if not exists(select 1 from public.office_identity_users where user_id=p_user and status='ACTIVE') then raise exception 'Active Office identity is required'; end if;
 select count(*) into v_used from public.office_software_license_assignments where license_id=p_license and status='ACTIVE';
 if l.total_seats is not null and v_used>=l.total_seats then raise exception 'No licence seats are available'; end if;
 insert into public.office_software_license_assignments(license_id,user_id,assigned_by,external_seat_reference,expires_at)
 values(p_license,p_user,p_actor,nullif(trim(coalesce(p_external_ref,'')),''),p_expires) returning id into v_id;
 insert into public.office_it_events(license_id,assignment_id,actor_user_id,event_type,new_status,metadata) values(p_license,v_id,p_actor,'LICENSE_ASSIGNED','ACTIVE',jsonb_build_object('user_id',p_user));
 return v_id;
end; $$;

create or replace function public.office_it_revoke_license(p_actor uuid,p_assignment uuid,p_reason text)
returns boolean language plpgsql security definer set search_path='' as $$
declare a public.office_software_license_assignments%rowtype;
begin
 if not public.office_effective_permission(p_actor,'it.license.manage','COMPANY',null,null) then raise exception 'Software licence management permission is required'; end if;
 select * into a from public.office_software_license_assignments where id=p_assignment for update;
 if a.id is null then raise exception 'Licence assignment not found'; end if;
 if a.status='REVOKED' then return true; end if;
 update public.office_software_license_assignments set status='REVOKED',revoked_by=p_actor,revoked_at=now(),revocation_reason=left(trim(p_reason),500),updated_at=now() where id=p_assignment;
 insert into public.office_it_events(license_id,assignment_id,actor_user_id,event_type,previous_status,new_status,note) values(a.license_id,a.id,p_actor,'LICENSE_REVOKED',a.status,'REVOKED',left(trim(p_reason),500));
 return true;
end; $$;

revoke all on function public.office_it_create_ticket(uuid,text,text,text,text,uuid,timestamptz) from public,anon,authenticated;
revoke all on function public.office_it_transition_ticket(uuid,uuid,text,uuid,text) from public,anon,authenticated;
revoke all on function public.office_it_create_license(uuid,uuid,text,text,text,text,integer,text,bigint,timestamptz,timestamptz,boolean,text,text) from public,anon,authenticated;
revoke all on function public.office_it_assign_license(uuid,uuid,uuid,text,timestamptz) from public,anon,authenticated;
revoke all on function public.office_it_revoke_license(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.office_it_create_ticket(uuid,text,text,text,text,uuid,timestamptz) to service_role;
grant execute on function public.office_it_transition_ticket(uuid,uuid,text,uuid,text) to service_role;
grant execute on function public.office_it_create_license(uuid,uuid,text,text,text,text,integer,text,bigint,timestamptz,timestamptz,boolean,text,text) to service_role;
grant execute on function public.office_it_assign_license(uuid,uuid,uuid,text,timestamptz) to service_role;
grant execute on function public.office_it_revoke_license(uuid,uuid,text) to service_role;
