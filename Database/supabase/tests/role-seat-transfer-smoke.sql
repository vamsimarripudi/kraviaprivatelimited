\set ON_ERROR_STOP on
-- Isolated PostgreSQL 17 contract test. Deliberately uses synthetic identities only.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create extension if not exists pgcrypto;
create table public.office_identity_users(user_id uuid primary key,status text not null);
create table public.office_user_roles(user_id uuid not null,role text not null,expires_at timestamptz);
create table public.office_auth_users(id text primary key,status text not null,workspace_status text not null);
create table public.office_department_catalog(code text primary key,label text not null,active boolean not null);
create table public.office_position_catalog(code text primary key,label text not null,active boolean not null);
create table public.office_permission_catalog(
 code text primary key,action text not null,high_risk boolean not null,
 owner_bypass boolean not null,active boolean not null
);
create table public.office_user_permission_overrides(
 user_id uuid,permission_code text,effect text,scope_type text,scope_key text,expires_at timestamptz
);
create table public.office_user_access_profiles(
 user_id uuid,profile_code text,status text,effective_from timestamptz,
 expires_at timestamptz,scope_type text,scope_key text
);
create table public.office_access_profile_permissions(
 profile_code text,permission_code text,effect text
);
create table public.office_department_ownership(department_code text primary key,owner_user_id uuid);

create function public.office_department_for_permission(p_code text)
returns text language sql stable as $$
 select case when p_code like 'engineering.%' then 'ENGINEERING'
             when p_code like 'finance.%' then 'FINANCE' else null end;
$$;
create function public.office_department_permission_verdict(p_actor uuid,p_permission text)
returns text language sql stable as $$select 'DEFAULT'::text$$;
create function public.office_scope_matches(
 p_grant_type text,p_grant_key text,p_resource_type text,p_resource_key text,
 p_actor uuid,p_owner uuid
) returns boolean language sql stable as $$
 select case when p_grant_type='COMPANY' then true
             when p_grant_type='OWN' then p_owner=p_actor
             when p_grant_type=p_resource_type
               then p_grant_key is null or p_grant_key=p_resource_key
             else false end;
$$;

\ir ../migrations/202611140001_role_seat_transfer_control.sql

insert into public.office_identity_users(user_id,status) values
 ('00000000-0000-0000-0000-000000000001','ACTIVE'),
 ('00000000-0000-0000-0000-000000000002','ACTIVE'),
 ('00000000-0000-0000-0000-000000000003','ACTIVE'),
 ('00000000-0000-0000-0000-000000000004','ACTIVE');
insert into public.office_auth_users(id,status,workspace_status) select user_id::text,'ACTIVE','ACTIVE' from public.office_identity_users;
insert into public.office_user_roles(user_id,role) values
 ('00000000-0000-0000-0000-000000000001','OWNER'),
 ('00000000-0000-0000-0000-000000000002','ADMIN'),
 ('00000000-0000-0000-0000-000000000003','MEMBER'),
 ('00000000-0000-0000-0000-000000000004','MEMBER');
insert into public.office_department_catalog(code,label,active) values
 ('EXECUTIVE','Executive',true),('ENGINEERING','Engineering',true),('FINANCE','Finance',true);
insert into public.office_position_catalog(code,label,active) values
 ('OWNER_FOUNDER','Founder',true),('CTO','CTO',true),('SOFTWARE_ENGINEER','Software engineer',true);
insert into public.office_permission_catalog(code,action,high_risk,owner_bypass,active) values
 ('engineering.issue.manage','UPDATE',false,true,true),
 ('engineering.maintenance.approve','APPROVE_MAINTENANCE',true,true,true),
 ('engineering.repo.read','READ',false,true,true),
 ('finance.read','READ',false,true,true);

do $$
declare
 owner_id uuid:='00000000-0000-0000-0000-000000000001';
 reviewer uuid:='00000000-0000-0000-0000-000000000002';
 successor uuid:='00000000-0000-0000-0000-000000000003';
 stranger uuid:='00000000-0000-0000-0000-000000000004';
 cto uuid; developer uuid; grant_id uuid; transfer uuid; item record;
begin
 -- A protected Founder role cannot be created as transferable authority.
 begin
  perform public.office_role_seat_create(owner_id,'FOUNDER_MAIN','Founder','OWNER_FOUNDER','EXECUTIVE','Protected',false);
  raise exception 'Founder seat was incorrectly accepted';
 exception when others then
  if SQLERRM='Founder seat was incorrectly accepted' then raise; end if;
 end;

 cto:=public.office_role_seat_create(owner_id,'CTO_MAIN','Chief Technology Officer','CTO','ENGINEERING','CTO responsibility',false);
 developer:=public.office_role_seat_create(owner_id,'DEV_MAIN','Full Stack Developer','SOFTWARE_ENGINEER','ENGINEERING','Assigned code work',false);
 if (select current_holder_user_id from public.office_role_seats where id=cto) is not null then
   raise exception 'Creating CTO wrongly assigned employee';
 end if;
 perform public.office_role_seat_add_grant(owner_id,cto,'engineering.issue.manage','COMPANY',null,true);
 grant_id:=public.office_role_seat_add_grant(owner_id,cto,'engineering.maintenance.approve','COMPANY',null,true);
 if (select status from public.office_role_seat_grants where id=grant_id)<>'PENDING' then
   raise exception 'High risk grant was immediately active';
 end if;
 begin
   perform public.office_role_seat_review_grant(owner_id,grant_id,true,'Reviewer should be independent');
   raise exception 'Self-review was incorrectly allowed';
 exception when others then
   if SQLERRM='Self-review was incorrectly allowed' then raise; end if;
 end;
 perform public.office_role_seat_review_grant(reviewer,grant_id,true,'Independent security policy review');

 -- Separate Developer seat gives the Founder independent code rights.
 perform public.office_role_seat_add_grant(owner_id,developer,'engineering.issue.manage','COMPANY',null,false);
 transfer:=public.office_role_seat_propose_transfer(owner_id,developer,owner_id,'Initial Developer seat appointment');
 perform public.office_role_seat_accept_transfer(owner_id,transfer);
 for item in select id,item_code from public.office_role_seat_transfer_items where transfer_id=transfer loop
   perform public.office_role_seat_verify_item(reviewer,item.id,'evidence-developer-'||item.item_code);
 end loop;
 perform public.office_role_seat_finalize_transfer(reviewer,transfer,'finalize-developer-seat');

 transfer:=public.office_role_seat_propose_transfer(owner_id,cto,owner_id,'Initial CTO seat appointment with independent review');
 perform public.office_role_seat_accept_transfer(owner_id,transfer);
 for item in select id,item_code from public.office_role_seat_transfer_items where transfer_id=transfer loop
   perform public.office_role_seat_verify_item(reviewer,item.id,'evidence-cto-'||item.item_code);
 end loop;
 perform public.office_role_seat_finalize_transfer(reviewer,transfer,'finalize-cto-seat');
 if (select current_holder_user_id from public.office_role_seats where id=cto)<>owner_id then
   raise exception 'Initial CTO seat was not assigned';
 end if;

 -- The outgoing Founder cannot finalize their own CTO handover.
 transfer:=public.office_role_seat_propose_transfer(owner_id,cto,successor,'Successor appointed as engineering CTO');
 begin
  perform public.office_role_seat_accept_transfer(stranger,transfer);
  raise exception 'Unrelated employee accepted another employee transfer';
 exception when others then
  if SQLERRM='Unrelated employee accepted another employee transfer' then raise; end if;
 end;
 perform public.office_role_seat_accept_transfer(successor,transfer);
 begin
  perform public.office_role_seat_finalize_transfer(owner_id,transfer,'owner-self-finalization');
  raise exception 'Outgoing CTO was allowed to finalize';
 exception when others then
  if SQLERRM='Outgoing CTO was allowed to finalize' then raise; end if;
 end;
 for item in select id,item_code from public.office_role_seat_transfer_items where transfer_id=transfer loop
   perform public.office_role_seat_verify_item(reviewer,item.id,'evidence-transfer-'||item.item_code);
 end loop;
 perform public.office_role_seat_finalize_transfer(reviewer,transfer,'independent CTO cutover evidence');

 if public.office_role_seat_permission_verdict(owner_id,'engineering.maintenance.approve','COMPANY',null,null)<>'DENY' then
   raise exception 'Former CTO retained exclusive approval privilege';
 end if;
 if public.office_effective_permission(owner_id,'engineering.maintenance.approve','COMPANY',null,null) then
   raise exception 'Owner bypass ignored former-seat DENY';
 end if;
 if public.office_role_seat_permission_verdict(owner_id,'engineering.issue.manage','COMPANY',null,null)<>'GRANTED' then
   raise exception 'Independent Developer seat was incorrectly blocked';
 end if;
 if not public.office_effective_permission(owner_id,'engineering.issue.manage','COMPANY',null,null) then
   raise exception 'Developer code permission lost';
 end if;
 if not public.office_effective_permission(successor,'engineering.maintenance.approve','COMPANY',null,null) then
   raise exception 'Successor CTO did not receive verified seat grant';
 end if;
 if (select current_holder_user_id from public.office_role_seats where id=developer)<>owner_id then
   raise exception 'Developer seat transferred incorrectly';
 end if;
 if (select count(*) from public.office_role_seat_assignments where seat_id=cto and status='ACTIVE')<>1 then
   raise exception 'Concurrent active CTO holders';
 end if;
 if (select count(*) from public.office_role_seat_events where seat_id=cto and event_type='TRANSFER_COMPLETED')<>2 then
   raise exception 'Missing immutable transfer events';
 end if;

 begin
  update public.office_role_seat_events set event_type='TAMPERED' where seat_id=cto;
  raise exception 'Audit history was mutable';
 exception when others then
  if SQLERRM='Audit history was mutable' then raise; end if;
 end;

 raise notice 'PASS: Founder protected; independent role seats; controlled transfers; former CTO denied; Developer retained; audit immutable';
end;
$$;
