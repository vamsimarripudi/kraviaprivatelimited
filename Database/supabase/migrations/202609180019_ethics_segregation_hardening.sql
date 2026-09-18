-- KRAVIA Office OS — ethics channel segregation-of-duties hardening.
-- Separates case assignment, investigation and independent closure review.

insert into public.office_permission_catalog(code,module,action,label,description,sensitivity,high_risk,requires_managed_device,active,owner_bypass) values
 ('ethics.case.assign','ETHICS','ASSIGN_CASE','Assign ethics case','Assign a restricted ethics case to an authorised investigator. Owner/executive status does not bypass this permission.','CRITICAL',true,true,true,false)
on conflict(code) do update set module=excluded.module,action=excluded.action,label=excluded.label,description=excluded.description,sensitivity=excluded.sensitivity,high_risk=excluded.high_risk,requires_managed_device=excluded.requires_managed_device,active=true,owner_bypass=false;

insert into public.office_access_profile_catalog(
 code,label,category,description,max_active_devices,requires_managed_device_for_high_risk,assignable_by_admin,owner_managed_only,active
) values
 ('ETHICS_LEAD','Ethics Case Lead','LEGAL','Restricted authority to receive and assign ethics cases. Does not investigate or close cases by itself.',1,true,false,true,true),
 ('ETHICS_REVIEWER','Ethics Independent Reviewer','LEGAL','Restricted authority to independently review ethics cases awaiting closure. Does not investigate the same case.',1,true,false,true,true)
on conflict(code) do update set
 label=excluded.label,category=excluded.category,description=excluded.description,max_active_devices=excluded.max_active_devices,
 requires_managed_device_for_high_risk=excluded.requires_managed_device_for_high_risk,
 assignable_by_admin=excluded.assignable_by_admin,owner_managed_only=excluded.owner_managed_only,active=true;

-- Investigators investigate. They do not receive independent closure review by default.
delete from public.office_access_profile_permissions
where profile_code='ETHICS_INVESTIGATOR' and permission_code='ethics.case.review';

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type) values
 ('ETHICS_LEAD','ethics.case.read','ALLOW','COMPANY'),
 ('ETHICS_LEAD','ethics.case.assign','ALLOW','COMPANY'),
 ('ETHICS_INVESTIGATOR','ethics.case.read','ALLOW','COMPANY'),
 ('ETHICS_INVESTIGATOR','ethics.case.manage','ALLOW','COMPANY'),
 ('ETHICS_REVIEWER','ethics.case.read','ALLOW','COMPANY'),
 ('ETHICS_REVIEWER','ethics.case.review','ALLOW','COMPANY')
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

create or replace function public.office_ethics_assign(
 p_actor uuid,p_case uuid,p_investigator uuid
) returns boolean language plpgsql security definer set search_path='' as $$
declare c public.office_ethics_cases%rowtype;
begin
 if not public.office_effective_permission(p_actor,'ethics.case.assign','COMPANY',null,null) then
  raise exception 'Ethics case assignment permission is required';
 end if;
 select * into c from public.office_ethics_cases where id=p_case for update;
 if c.id is null or c.status in ('CLOSED','UNSUBSTANTIATED','WITHDRAWN') then raise exception 'Open ethics case is required'; end if;
 if p_investigator=c.reporter_user_id then raise exception 'Reporter cannot investigate their own case'; end if;
 if p_actor=p_investigator then raise exception 'Ethics case lead cannot assign the same case to themselves'; end if;
 if not exists(
   select 1 from public.office_user_access_profiles
   where user_id=p_investigator and profile_code='ETHICS_INVESTIGATOR' and status='ACTIVE'
     and (expires_at is null or expires_at>now())
 ) then
   raise exception 'Assigned investigator must hold active Ethics Investigator authority';
 end if;
 update public.office_ethics_cases
 set investigator_user_id=p_investigator,
     status=case when status='SUBMITTED' then 'TRIAGE' else status end,
     updated_at=now()
 where id=c.id;
 insert into public.office_ethics_events(case_id,actor_user_id,event_type,previous_status,new_status,note)
 values(c.id,p_actor,'INVESTIGATOR_ASSIGNED',c.status,case when c.status='SUBMITTED' then 'TRIAGE' else c.status end,'Assigned by independent Ethics Case Lead');
 return true;
end;
$$;

revoke all on function public.office_ethics_assign(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.office_ethics_assign(uuid,uuid,uuid) to service_role;
