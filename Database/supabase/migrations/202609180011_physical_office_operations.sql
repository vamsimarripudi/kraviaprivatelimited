-- KRAVIA Office OS — physical-office operations.
-- Extends the existing digital identity, device trust and physical-access foundation.
-- Visitor credentials store only SHA-256 hashes; raw QR/NFC material is never persisted here.

insert into public.office_permission_catalog(code,module,action,label,description,sensitivity,high_risk,requires_managed_device,active) values
 ('facilities.room.read','FACILITIES','READ_ROOMS','Read rooms and sites','Read active office sites, rooms and scoped booking availability.','STANDARD',false,false,true),
 ('facilities.room.book','FACILITIES','BOOK_ROOM','Book meeting room','Create and cancel the actor''s own room bookings.','STANDARD',false,false,true),
 ('visitor.invite','FACILITIES','INVITE_VISITOR','Invite visitor','Create a visitor request for the actor as host.','SENSITIVE',false,false,true),
 ('visitor.manage','FACILITIES','MANAGE_VISITOR','Manage visitors','Independently review visitor requests, issue temporary credentials and manage check-in/out.','HIGH',true,true,true),
 ('facilities.issue.report','FACILITIES','REPORT_ISSUE','Report facility issue','Report office facility, safety or access issues.','STANDARD',false,false,true),
 ('facilities.manage','FACILITIES','MANAGE_FACILITIES','Manage facilities','Manage rooms, company-wide bookings and facility incident lifecycle.','HIGH',true,true,true)
on conflict(code) do update set module=excluded.module,action=excluded.action,label=excluded.label,description=excluded.description,sensitivity=excluded.sensitivity,high_risk=excluded.high_risk,requires_managed_device=excluded.requires_managed_device,active=true;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type)
select code,'facilities.room.read','ALLOW','COMPANY' from public.office_access_profile_catalog
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;
insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type)
select code,'facilities.room.book','ALLOW','COMPANY' from public.office_access_profile_catalog
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;
insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type)
select code,'visitor.invite','ALLOW','COMPANY' from public.office_access_profile_catalog
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;
insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type)
select code,'facilities.issue.report','ALLOW','COMPANY' from public.office_access_profile_catalog
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type) values
 ('OFFICE_ADMIN','visitor.manage','ALLOW','COMPANY'),
 ('OFFICE_ADMIN','facilities.manage','ALLOW','COMPANY'),
 ('OPERATIONS_MANAGER','visitor.manage','ALLOW','COMPANY'),
 ('OPERATIONS_MANAGER','facilities.manage','ALLOW','COMPANY'),
 ('SECURITY_OPERATOR','visitor.manage','ALLOW','COMPANY')
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

create sequence if not exists public.office_visitor_seq;

create table if not exists public.office_facility_sites(
 id uuid primary key default gen_random_uuid(),
 site_code text not null unique,
 name text not null,
 address_text text,
 timezone_name text not null default 'Asia/Kolkata',
 status text not null default 'ACTIVE' check(status in ('ACTIVE','INACTIVE','CLOSED')),
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.office_facility_rooms(
 id uuid primary key default gen_random_uuid(),
 site_id uuid not null references public.office_facility_sites(id) on delete restrict,
 room_code text not null unique,
 name text not null,
 room_type text not null default 'MEETING' check(room_type in ('MEETING','BOARD','INTERVIEW','TRAINING','FOCUS','OTHER')),
 capacity integer not null default 1 check(capacity between 1 and 500),
 physical_zone_id uuid references public.office_physical_access_zones(id) on delete restrict,
 status text not null default 'ACTIVE' check(status in ('ACTIVE','MAINTENANCE','INACTIVE')),
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists office_facility_rooms_site_idx on public.office_facility_rooms(site_id,status);

create table if not exists public.office_room_bookings(
 id uuid primary key default gen_random_uuid(),
 room_id uuid not null references public.office_facility_rooms(id) on delete restrict,
 organizer_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 title text not null check(char_length(trim(title)) between 2 and 180),
 purpose text,
 visibility text not null default 'INTERNAL' check(visibility in ('INTERNAL','CONFIDENTIAL')),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 status text not null default 'BOOKED' check(status in ('BOOKED','COMPLETED','CANCELLED')),
 cancelled_by uuid references public.office_identity_users(user_id) on delete restrict,
 cancelled_at timestamptz,
 cancellation_reason text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(ends_at>starts_at)
);
create index if not exists office_room_bookings_room_time_idx on public.office_room_bookings(room_id,starts_at,ends_at) where status='BOOKED';
create index if not exists office_room_bookings_organizer_idx on public.office_room_bookings(organizer_user_id,starts_at desc);

create table if not exists public.office_visitors(
 id uuid primary key default gen_random_uuid(),
 visitor_code text not null unique default ('KR-VIS-'||lpad(nextval('public.office_visitor_seq')::text,7,'0')),
 site_id uuid not null references public.office_facility_sites(id) on delete restrict,
 host_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 full_name text not null check(char_length(trim(full_name)) between 2 and 180),
 email text,
 phone text,
 organization text,
 purpose text not null check(char_length(trim(purpose)) between 3 and 1000),
 scheduled_from timestamptz not null,
 scheduled_to timestamptz not null,
 status text not null default 'REQUESTED' check(status in ('REQUESTED','APPROVED','DENIED','CHECKED_IN','CHECKED_OUT','CANCELLED','EXPIRED')),
 reviewed_by uuid references public.office_identity_users(user_id) on delete restrict,
 reviewed_at timestamptz,
 review_note text,
 checked_in_at timestamptz,
 checked_out_at timestamptz,
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(scheduled_to>scheduled_from)
);
create index if not exists office_visitors_host_idx on public.office_visitors(host_user_id,scheduled_from desc);
create index if not exists office_visitors_site_status_idx on public.office_visitors(site_id,status,scheduled_from);

create table if not exists public.office_visitor_credentials(
 id uuid primary key default gen_random_uuid(),
 visitor_id uuid not null references public.office_visitors(id) on delete cascade,
 credential_token_hash text not null unique check(char_length(credential_token_hash)=64),
 status text not null default 'ACTIVE' check(status in ('ACTIVE','REVOKED','EXPIRED')),
 issued_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 issued_at timestamptz not null default now(),
 expires_at timestamptz not null,
 revoked_by uuid references public.office_identity_users(user_id) on delete restrict,
 revoked_at timestamptz,
 created_at timestamptz not null default now()
);
create unique index if not exists office_visitor_credentials_active_idx on public.office_visitor_credentials(visitor_id) where status='ACTIVE';

create table if not exists public.office_facility_incidents(
 id uuid primary key default gen_random_uuid(),
 site_id uuid not null references public.office_facility_sites(id) on delete restrict,
 room_id uuid references public.office_facility_rooms(id) on delete restrict,
 reporter_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 owner_user_id uuid references public.office_identity_users(user_id) on delete restrict,
 category text not null check(category in ('POWER','HVAC','CLEANING','SAFETY','SECURITY','ACCESS','FURNITURE','WATER','OTHER')),
 priority text not null default 'NORMAL' check(priority in ('LOW','NORMAL','HIGH','URGENT')),
 title text not null check(char_length(trim(title)) between 3 and 180),
 description text not null check(char_length(trim(description)) between 3 and 5000),
 status text not null default 'OPEN' check(status in ('OPEN','TRIAGED','IN_PROGRESS','WAITING_VENDOR','RESOLVED','CLOSED','CANCELLED')),
 resolution text,
 due_at timestamptz,
 resolved_at timestamptz,
 closed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists office_facility_incidents_status_idx on public.office_facility_incidents(status,priority,created_at desc);
create index if not exists office_facility_incidents_reporter_idx on public.office_facility_incidents(reporter_user_id,created_at desc);

create table if not exists public.office_facility_events(
 id bigint generated always as identity primary key,
 actor_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 site_id uuid references public.office_facility_sites(id) on delete restrict,
 room_id uuid references public.office_facility_rooms(id) on delete restrict,
 booking_id uuid references public.office_room_bookings(id) on delete restrict,
 visitor_id uuid references public.office_visitors(id) on delete restrict,
 incident_id uuid references public.office_facility_incidents(id) on delete restrict,
 event_type text not null,
 note text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists office_facility_events_created_idx on public.office_facility_events(created_at desc);

alter table public.office_facility_sites enable row level security;
alter table public.office_facility_rooms enable row level security;
alter table public.office_room_bookings enable row level security;
alter table public.office_visitors enable row level security;
alter table public.office_visitor_credentials enable row level security;
alter table public.office_facility_incidents enable row level security;
alter table public.office_facility_events enable row level security;

revoke all on public.office_facility_sites,public.office_facility_rooms,public.office_room_bookings,public.office_visitors,public.office_visitor_credentials,public.office_facility_incidents,public.office_facility_events from anon,authenticated,public;
grant select,insert,update on public.office_facility_sites,public.office_facility_rooms,public.office_room_bookings,public.office_visitors,public.office_visitor_credentials,public.office_facility_incidents to service_role;
grant select,insert on public.office_facility_events to service_role;
grant usage,select on sequence public.office_visitor_seq to service_role;

create or replace function public.office_room_book(p_actor uuid,p_room uuid,p_title text,p_purpose text,p_visibility text,p_start timestamptz,p_end timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; r public.office_facility_rooms%rowtype; v_visibility text:=upper(trim(coalesce(p_visibility,'INTERNAL')));
begin
 if not public.office_effective_permission(p_actor,'facilities.room.book','COMPANY',null,null) then raise exception 'Room booking permission is required'; end if;
 if p_end<=p_start then raise exception 'Room booking end must be after start'; end if;
 if p_start<now()-interval '5 minutes' then raise exception 'Room booking cannot start in the past'; end if;
 if v_visibility not in ('INTERNAL','CONFIDENTIAL') then raise exception 'Invalid booking visibility'; end if;
 select * into r from public.office_facility_rooms where id=p_room and status='ACTIVE' for update;
 if r.id is null or not exists(select 1 from public.office_facility_sites where id=r.site_id and status='ACTIVE') then raise exception 'Active room is required'; end if;
 if exists(select 1 from public.office_room_bookings where room_id=p_room and status='BOOKED' and starts_at<p_end and ends_at>p_start) then raise exception 'Room is already booked for this time'; end if;
 insert into public.office_room_bookings(room_id,organizer_user_id,title,purpose,visibility,starts_at,ends_at)
 values(p_room,p_actor,trim(p_title),nullif(trim(coalesce(p_purpose,'')),''),v_visibility,p_start,p_end) returning id into v_id;
 insert into public.office_facility_events(actor_user_id,site_id,room_id,booking_id,event_type,metadata)
 values(p_actor,r.site_id,r.id,v_id,'ROOM_BOOKED',jsonb_build_object('starts_at',p_start,'ends_at',p_end,'visibility',v_visibility));
 return v_id;
end; $$;

create or replace function public.office_room_cancel(p_actor uuid,p_booking uuid,p_reason text)
returns boolean language plpgsql security definer set search_path='' as $$
declare b public.office_room_bookings%rowtype; r public.office_facility_rooms%rowtype;
begin
 select * into b from public.office_room_bookings where id=p_booking for update;
 if b.id is null then raise exception 'Room booking not found'; end if;
 if b.organizer_user_id<>p_actor and not public.office_effective_permission(p_actor,'facilities.manage','COMPANY',null,null) then raise exception 'Only the organizer or facilities authority may cancel this booking'; end if;
 if b.status<>'BOOKED' then return true; end if;
 select * into r from public.office_facility_rooms where id=b.room_id;
 update public.office_room_bookings set status='CANCELLED',cancelled_by=p_actor,cancelled_at=now(),cancellation_reason=left(trim(p_reason),500),updated_at=now() where id=b.id;
 insert into public.office_facility_events(actor_user_id,site_id,room_id,booking_id,event_type,note) values(p_actor,r.site_id,r.id,b.id,'ROOM_CANCELLED',left(trim(p_reason),500));
 return true;
end; $$;

create or replace function public.office_visitor_invite(p_actor uuid,p_site uuid,p_name text,p_email text,p_phone text,p_organization text,p_purpose text,p_from timestamptz,p_to timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not public.office_effective_permission(p_actor,'visitor.invite','COMPANY',null,null) then raise exception 'Visitor invitation permission is required'; end if;
 if not exists(select 1 from public.office_facility_sites where id=p_site and status='ACTIVE') then raise exception 'Active office site is required'; end if;
 if p_to<=p_from then raise exception 'Visitor end must be after start'; end if;
 if p_from<now()-interval '5 minutes' then raise exception 'Visitor schedule cannot start in the past'; end if;
 insert into public.office_visitors(site_id,host_user_id,full_name,email,phone,organization,purpose,scheduled_from,scheduled_to,created_by)
 values(p_site,p_actor,trim(p_name),nullif(lower(trim(coalesce(p_email,''))),''),nullif(trim(coalesce(p_phone,'')),''),nullif(trim(coalesce(p_organization,'')),''),trim(p_purpose),p_from,p_to,p_actor)
 returning id into v_id;
 insert into public.office_facility_events(actor_user_id,site_id,visitor_id,event_type,metadata)
 values(p_actor,p_site,v_id,'VISITOR_REQUESTED',jsonb_build_object('scheduled_from',p_from,'scheduled_to',p_to));
 return v_id;
end; $$;

create or replace function public.office_visitor_review(p_actor uuid,p_visitor uuid,p_decision text,p_note text)
returns text language plpgsql security definer set search_path='' as $$
declare v public.office_visitors%rowtype; target text:=upper(trim(p_decision));
begin
 if not public.office_effective_permission(p_actor,'visitor.manage','COMPANY',null,null) then raise exception 'Visitor management permission is required'; end if;
 select * into v from public.office_visitors where id=p_visitor for update;
 if v.id is null or v.status<>'REQUESTED' then raise exception 'Pending visitor request is required'; end if;
 if v.host_user_id=p_actor then raise exception 'Visitor host cannot approve their own invitation'; end if;
 if target not in ('APPROVED','DENIED') then raise exception 'Invalid visitor review decision'; end if;
 update public.office_visitors set status=target,reviewed_by=p_actor,reviewed_at=now(),review_note=nullif(trim(coalesce(p_note,'')),''),updated_at=now() where id=v.id;
 insert into public.office_facility_events(actor_user_id,site_id,visitor_id,event_type,note,metadata)
 values(p_actor,v.site_id,v.id,'VISITOR_'||target,left(trim(coalesce(p_note,'')),500),jsonb_build_object('host_user_id',v.host_user_id));
 return target;
end; $$;

create or replace function public.office_visitor_issue_credential(p_actor uuid,p_visitor uuid,p_token_hash text,p_expires timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare v public.office_visitors%rowtype; v_id uuid; expiry timestamptz;
begin
 if not public.office_effective_permission(p_actor,'visitor.manage','COMPANY',null,null) then raise exception 'Visitor management permission is required'; end if;
 select * into v from public.office_visitors where id=p_visitor for update;
 if v.id is null or v.status not in ('APPROVED','CHECKED_IN') then raise exception 'Approved visitor is required'; end if;
 if p_token_hash !~ '^[0-9a-fA-F]{64}$' then raise exception 'Visitor credential hash must be SHA-256'; end if;
 expiry:=least(coalesce(p_expires,v.scheduled_to),v.scheduled_to);
 if expiry<=now() then raise exception 'Visitor credential expiry must be in the future'; end if;
 update public.office_visitor_credentials set status='REVOKED',revoked_by=p_actor,revoked_at=now() where visitor_id=v.id and status='ACTIVE';
 insert into public.office_visitor_credentials(visitor_id,credential_token_hash,issued_by,expires_at)
 values(v.id,lower(p_token_hash),p_actor,expiry) returning id into v_id;
 insert into public.office_facility_events(actor_user_id,site_id,visitor_id,event_type,metadata)
 values(p_actor,v.site_id,v.id,'VISITOR_CREDENTIAL_ISSUED',jsonb_build_object('credential_id',v_id,'expires_at',expiry));
 return v_id;
end; $$;

create or replace function public.office_visitor_checkin(p_actor uuid,p_visitor uuid)
returns text language plpgsql security definer set search_path='' as $$
declare v public.office_visitors%rowtype;
begin
 if not public.office_effective_permission(p_actor,'visitor.manage','COMPANY',null,null) then raise exception 'Visitor management permission is required'; end if;
 select * into v from public.office_visitors where id=p_visitor for update;
 if v.id is null or v.status<>'APPROVED' then raise exception 'Approved visitor is required'; end if;
 if now()>v.scheduled_to then raise exception 'Visitor invitation has expired'; end if;
 update public.office_visitors set status='CHECKED_IN',checked_in_at=now(),updated_at=now() where id=v.id;
 insert into public.office_facility_events(actor_user_id,site_id,visitor_id,event_type) values(p_actor,v.site_id,v.id,'VISITOR_CHECKED_IN');
 return 'CHECKED_IN';
end; $$;

create or replace function public.office_visitor_checkout(p_actor uuid,p_visitor uuid)
returns text language plpgsql security definer set search_path='' as $$
declare v public.office_visitors%rowtype;
begin
 if not public.office_effective_permission(p_actor,'visitor.manage','COMPANY',null,null) then raise exception 'Visitor management permission is required'; end if;
 select * into v from public.office_visitors where id=p_visitor for update;
 if v.id is null or v.status<>'CHECKED_IN' then raise exception 'Checked-in visitor is required'; end if;
 update public.office_visitors set status='CHECKED_OUT',checked_out_at=now(),updated_at=now() where id=v.id;
 update public.office_visitor_credentials set status='REVOKED',revoked_by=p_actor,revoked_at=now() where visitor_id=v.id and status='ACTIVE';
 insert into public.office_facility_events(actor_user_id,site_id,visitor_id,event_type) values(p_actor,v.site_id,v.id,'VISITOR_CHECKED_OUT');
 return 'CHECKED_OUT';
end; $$;

create or replace function public.office_facility_issue_create(p_actor uuid,p_site uuid,p_room uuid,p_category text,p_priority text,p_title text,p_description text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_category text:=upper(trim(p_category)); v_priority text:=upper(trim(p_priority));
begin
 if not public.office_effective_permission(p_actor,'facilities.issue.report','COMPANY',null,null) then raise exception 'Facility issue reporting permission is required'; end if;
 if not exists(select 1 from public.office_facility_sites where id=p_site and status='ACTIVE') then raise exception 'Active office site is required'; end if;
 if p_room is not null and not exists(select 1 from public.office_facility_rooms where id=p_room and site_id=p_site) then raise exception 'Room does not belong to site'; end if;
 if v_category not in ('POWER','HVAC','CLEANING','SAFETY','SECURITY','ACCESS','FURNITURE','WATER','OTHER') then raise exception 'Invalid facility issue category'; end if;
 if v_priority not in ('LOW','NORMAL','HIGH','URGENT') then raise exception 'Invalid facility issue priority'; end if;
 insert into public.office_facility_incidents(site_id,room_id,reporter_user_id,category,priority,title,description)
 values(p_site,p_room,p_actor,v_category,v_priority,trim(p_title),trim(p_description)) returning id into v_id;
 insert into public.office_facility_events(actor_user_id,site_id,room_id,incident_id,event_type,metadata)
 values(p_actor,p_site,p_room,v_id,'FACILITY_ISSUE_REPORTED',jsonb_build_object('category',v_category,'priority',v_priority));
 return v_id;
end; $$;

create or replace function public.office_facility_issue_transition(p_actor uuid,p_incident uuid,p_status text,p_owner uuid,p_note text)
returns text language plpgsql security definer set search_path='' as $$
declare i public.office_facility_incidents%rowtype; target text:=upper(trim(p_status));
begin
 if not public.office_effective_permission(p_actor,'facilities.manage','COMPANY',null,null) then raise exception 'Facilities management permission is required'; end if;
 select * into i from public.office_facility_incidents where id=p_incident for update;
 if i.id is null then raise exception 'Facility issue not found'; end if;
 if target not in ('OPEN','TRIAGED','IN_PROGRESS','WAITING_VENDOR','RESOLVED','CLOSED','CANCELLED') then raise exception 'Invalid facility issue status'; end if;
 if p_owner is not null and not exists(select 1 from public.office_identity_users where user_id=p_owner and status='ACTIVE') then raise exception 'Active incident owner is required'; end if;
 update public.office_facility_incidents set
   status=target,
   owner_user_id=coalesce(p_owner,owner_user_id),
   resolution=case when target in ('RESOLVED','CLOSED') then nullif(trim(coalesce(p_note,'')),'') else resolution end,
   resolved_at=case when target='RESOLVED' then coalesce(resolved_at,now()) else resolved_at end,
   closed_at=case when target='CLOSED' then coalesce(closed_at,now()) else closed_at end,
   updated_at=now()
 where id=i.id;
 insert into public.office_facility_events(actor_user_id,site_id,room_id,incident_id,event_type,note,metadata)
 values(p_actor,i.site_id,i.room_id,i.id,'FACILITY_ISSUE_STATUS',left(trim(coalesce(p_note,'')),500),jsonb_build_object('previous_status',i.status,'new_status',target,'owner_user_id',p_owner));
 return target;
end; $$;

revoke all on function public.office_room_book(uuid,uuid,text,text,text,timestamptz,timestamptz) from public,anon,authenticated;
revoke all on function public.office_room_cancel(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.office_visitor_invite(uuid,uuid,text,text,text,text,text,timestamptz,timestamptz) from public,anon,authenticated;
revoke all on function public.office_visitor_review(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.office_visitor_issue_credential(uuid,uuid,text,timestamptz) from public,anon,authenticated;
revoke all on function public.office_visitor_checkin(uuid,uuid) from public,anon,authenticated;
revoke all on function public.office_visitor_checkout(uuid,uuid) from public,anon,authenticated;
revoke all on function public.office_facility_issue_create(uuid,uuid,uuid,text,text,text,text) from public,anon,authenticated;
revoke all on function public.office_facility_issue_transition(uuid,uuid,text,uuid,text) from public,anon,authenticated;

grant execute on function public.office_room_book(uuid,uuid,text,text,text,timestamptz,timestamptz) to service_role;
grant execute on function public.office_room_cancel(uuid,uuid,text) to service_role;
grant execute on function public.office_visitor_invite(uuid,uuid,text,text,text,text,text,timestamptz,timestamptz) to service_role;
grant execute on function public.office_visitor_review(uuid,uuid,text,text) to service_role;
grant execute on function public.office_visitor_issue_credential(uuid,uuid,text,timestamptz) to service_role;
grant execute on function public.office_visitor_checkin(uuid,uuid) to service_role;
grant execute on function public.office_visitor_checkout(uuid,uuid) to service_role;
grant execute on function public.office_facility_issue_create(uuid,uuid,uuid,text,text,text,text) to service_role;
grant execute on function public.office_facility_issue_transition(uuid,uuid,text,uuid,text) to service_role;
