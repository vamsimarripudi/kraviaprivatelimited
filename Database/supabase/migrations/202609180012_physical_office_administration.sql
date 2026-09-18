-- KRAVIA Office OS — governed physical-office administration.
-- Allows authorised facilities operators to configure sites and rooms inside KRAVIA.
-- No destructive delete path is exposed; history remains referentially intact.

create or replace function public.office_facility_site_create(
  p_actor uuid,
  p_code text,
  p_name text,
  p_address text,
  p_timezone text default 'Asia/Kolkata'
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_id uuid;
  v_code text:=upper(trim(p_code));
  v_timezone text:=coalesce(nullif(trim(p_timezone),''),'Asia/Kolkata');
begin
  if not public.office_effective_permission(p_actor,'facilities.manage','COMPANY',null,null) then
    raise exception 'Facilities management permission is required';
  end if;
  if v_code !~ '^[A-Z0-9][A-Z0-9_-]{1,31}$' then
    raise exception 'Site code must be 2-32 characters using A-Z, 0-9, _ or -';
  end if;
  if char_length(trim(p_name)) not between 2 and 180 then
    raise exception 'Site name must be 2-180 characters';
  end if;
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=v_timezone) then
    raise exception 'Unknown timezone';
  end if;
  insert into public.office_facility_sites(site_code,name,address_text,timezone_name,status,created_by)
  values(v_code,trim(p_name),nullif(trim(coalesce(p_address,'')),''),v_timezone,'ACTIVE',p_actor)
  returning id into v_id;
  insert into public.office_facility_events(actor_user_id,site_id,event_type,metadata)
  values(p_actor,v_id,'SITE_CREATED',jsonb_build_object('site_code',v_code,'name',trim(p_name)));
  return v_id;
end;
$$;

create or replace function public.office_facility_site_update(
  p_actor uuid,
  p_site uuid,
  p_name text,
  p_address text,
  p_timezone text,
  p_status text
)
returns text
language plpgsql
security definer
set search_path=''
as $$
declare
  s public.office_facility_sites%rowtype;
  v_status text:=upper(trim(p_status));
  v_timezone text:=trim(p_timezone);
begin
  if not public.office_effective_permission(p_actor,'facilities.manage','COMPANY',null,null) then
    raise exception 'Facilities management permission is required';
  end if;
  select * into s from public.office_facility_sites where id=p_site for update;
  if s.id is null then raise exception 'Office site not found'; end if;
  if char_length(trim(p_name)) not between 2 and 180 then raise exception 'Site name must be 2-180 characters'; end if;
  if v_status not in ('ACTIVE','INACTIVE','CLOSED') then raise exception 'Invalid site status'; end if;
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=v_timezone) then raise exception 'Unknown timezone'; end if;
  if v_status<>'ACTIVE' and exists(select 1 from public.office_room_bookings b join public.office_facility_rooms r on r.id=b.room_id where r.site_id=s.id and b.status='BOOKED' and b.ends_at>now()) then
    raise exception 'Site with future room bookings cannot be deactivated';
  end if;
  update public.office_facility_sites
     set name=trim(p_name),
         address_text=nullif(trim(coalesce(p_address,'')),''),
         timezone_name=v_timezone,
         status=v_status,
         updated_at=now()
   where id=s.id;
  insert into public.office_facility_events(actor_user_id,site_id,event_type,metadata)
  values(p_actor,s.id,'SITE_UPDATED',jsonb_build_object('previous_status',s.status,'new_status',v_status,'name',trim(p_name)));
  return v_status;
end;
$$;

create or replace function public.office_facility_room_create(
  p_actor uuid,
  p_site uuid,
  p_code text,
  p_name text,
  p_room_type text,
  p_capacity integer,
  p_zone uuid
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_id uuid;
  v_code text:=upper(trim(p_code));
  v_type text:=upper(trim(coalesce(p_room_type,'MEETING')));
begin
  if not public.office_effective_permission(p_actor,'facilities.manage','COMPANY',null,null) then
    raise exception 'Facilities management permission is required';
  end if;
  if not exists(select 1 from public.office_facility_sites where id=p_site and status='ACTIVE') then
    raise exception 'Active office site is required';
  end if;
  if v_code !~ '^[A-Z0-9][A-Z0-9_-]{1,31}$' then
    raise exception 'Room code must be 2-32 characters using A-Z, 0-9, _ or -';
  end if;
  if char_length(trim(p_name)) not between 2 and 180 then raise exception 'Room name must be 2-180 characters'; end if;
  if v_type not in ('MEETING','BOARD','INTERVIEW','TRAINING','FOCUS','OTHER') then raise exception 'Invalid room type'; end if;
  if coalesce(p_capacity,0) not between 1 and 500 then raise exception 'Room capacity must be between 1 and 500'; end if;
  if p_zone is not null and not exists(select 1 from public.office_physical_access_zones where id=p_zone and active=true) then
    raise exception 'Active physical access zone is required';
  end if;
  insert into public.office_facility_rooms(site_id,room_code,name,room_type,capacity,physical_zone_id,status,created_by)
  values(p_site,v_code,trim(p_name),v_type,p_capacity,p_zone,'ACTIVE',p_actor)
  returning id into v_id;
  insert into public.office_facility_events(actor_user_id,site_id,room_id,event_type,metadata)
  values(p_actor,p_site,v_id,'ROOM_CREATED',jsonb_build_object('room_code',v_code,'name',trim(p_name),'room_type',v_type,'capacity',p_capacity,'physical_zone_id',p_zone));
  return v_id;
end;
$$;

create or replace function public.office_facility_room_update(
  p_actor uuid,
  p_room uuid,
  p_name text,
  p_room_type text,
  p_capacity integer,
  p_zone uuid,
  p_status text
)
returns text
language plpgsql
security definer
set search_path=''
as $$
declare
  r public.office_facility_rooms%rowtype;
  v_type text:=upper(trim(p_room_type));
  v_status text:=upper(trim(p_status));
begin
  if not public.office_effective_permission(p_actor,'facilities.manage','COMPANY',null,null) then
    raise exception 'Facilities management permission is required';
  end if;
  select * into r from public.office_facility_rooms where id=p_room for update;
  if r.id is null then raise exception 'Office room not found'; end if;
  if char_length(trim(p_name)) not between 2 and 180 then raise exception 'Room name must be 2-180 characters'; end if;
  if v_type not in ('MEETING','BOARD','INTERVIEW','TRAINING','FOCUS','OTHER') then raise exception 'Invalid room type'; end if;
  if coalesce(p_capacity,0) not between 1 and 500 then raise exception 'Room capacity must be between 1 and 500'; end if;
  if v_status not in ('ACTIVE','MAINTENANCE','INACTIVE') then raise exception 'Invalid room status'; end if;
  if p_zone is not null and not exists(select 1 from public.office_physical_access_zones where id=p_zone and active=true) then
    raise exception 'Active physical access zone is required';
  end if;
  if v_status<>'ACTIVE' and exists(select 1 from public.office_room_bookings where room_id=r.id and status='BOOKED' and ends_at>now()) then
    raise exception 'Room with future bookings cannot be deactivated';
  end if;
  update public.office_facility_rooms
     set name=trim(p_name),
         room_type=v_type,
         capacity=p_capacity,
         physical_zone_id=p_zone,
         status=v_status,
         updated_at=now()
   where id=r.id;
  insert into public.office_facility_events(actor_user_id,site_id,room_id,event_type,metadata)
  values(p_actor,r.site_id,r.id,'ROOM_UPDATED',jsonb_build_object('previous_status',r.status,'new_status',v_status,'name',trim(p_name),'room_type',v_type,'capacity',p_capacity,'physical_zone_id',p_zone));
  return v_status;
end;
$$;

revoke all on function public.office_facility_site_create(uuid,text,text,text,text) from public,anon,authenticated;
revoke all on function public.office_facility_site_update(uuid,uuid,text,text,text,text) from public,anon,authenticated;
revoke all on function public.office_facility_room_create(uuid,uuid,text,text,text,integer,uuid) from public,anon,authenticated;
revoke all on function public.office_facility_room_update(uuid,uuid,text,text,integer,uuid,text) from public,anon,authenticated;

grant execute on function public.office_facility_site_create(uuid,text,text,text,text) to service_role;
grant execute on function public.office_facility_site_update(uuid,uuid,text,text,text,text) to service_role;
grant execute on function public.office_facility_room_create(uuid,uuid,text,text,text,integer,uuid) to service_role;
grant execute on function public.office_facility_room_update(uuid,uuid,text,text,integer,uuid,text) to service_role;
