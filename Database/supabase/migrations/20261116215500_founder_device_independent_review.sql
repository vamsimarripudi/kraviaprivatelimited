-- KRAVIA Office: independent Founder device recovery, Nov 16 2026.
-- Append-only posture evidence, separate reviewer and approver, no self-approval.
-- This migration does not reclassify or restore existing revoked devices.
-- Private service-role RPCs; all role checks are enforced again inside SQL.

create table if not exists public.office_founder_device_reviews (
 id uuid primary key default gen_random_uuid(),
 device_id uuid not null references public.office_device_registry(id) on delete restrict,
 subject_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 reviewer_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 posture_id bigint not null references public.office_device_posture_snapshots(id) on delete restrict,
 company_managed_verified boolean not null default false,
 management_evidence_ref text not null,
 review_notes text not null,
 status text not null default 'PENDING' check(status in ('PENDING','SUPERSEDED','APPROVED')),
 reviewed_at timestamptz not null default now(),
 approved_by uuid references public.office_identity_users(user_id) on delete restrict,
 approved_at timestamptz,
 approval_reason text,
 constraint founder_device_review_independent check(reviewer_user_id<>subject_user_id),
 constraint founder_device_review_notes_length check(char_length(trim(review_notes)) between 30 and 500),
 constraint founder_device_management_evidence_length check(char_length(trim(management_evidence_ref)) between 12 and 300),
 constraint founder_device_approval_roles_independent check(approved_by is null or (approved_by<>subject_user_id and approved_by<>reviewer_user_id))
);
create unique index if not exists office_founder_device_one_pending_review
 on public.office_founder_device_reviews(device_id) where status='PENDING';
create index if not exists office_founder_device_reviews_latest
 on public.office_founder_device_reviews(device_id,reviewed_at desc);

alter table public.office_founder_device_reviews enable row level security;
revoke all on public.office_founder_device_reviews from public,anon,authenticated;
grant select,insert,update on public.office_founder_device_reviews to service_role;

-- Historical snapshots remain intact (including the previously contradictory
-- COMPLIANT/compromise=true row). Reject NEW contradictory attestations.
create or replace function public.office_guard_device_compliant_snapshot()
returns trigger language plpgsql set search_path = '' as $guard$
begin
 if new.compliance_status='COMPLIANT' and
    (new.compromise_detected is distinct from false
     or new.encryption_enabled is distinct from true
     or new.screen_lock_enabled is distinct from true
     or new.security_agent_healthy is distinct from true
     or new.patch_current is distinct from true
     or new.firewall_enabled is distinct from true) then
   raise exception 'COMPLIANT requires all verified security checks and no compromise';
 end if;
 return new;
end $guard$;
drop trigger if exists office_guard_device_compliant_snapshot_insert on public.office_device_posture_snapshots;
create trigger office_guard_device_compliant_snapshot_insert
 before insert or update on public.office_device_posture_snapshots
 for each row execute function public.office_guard_device_compliant_snapshot();

-- A recorded company-managed device cannot be based solely on a checkbox.
-- Only a different, active ADMIN or DIRECTOR can document the actual checks
-- and cite the company's management/asset evidence. No device is un-revoked.
create or replace function public.office_review_founder_device(
 p_actor uuid,p_device uuid,p_os text,p_encryption boolean,p_screen_lock boolean,
 p_agent boolean,p_patch boolean,p_firewall boolean,p_compromise boolean,
 p_company_managed boolean,p_management_evidence text,p_notes text
) returns uuid
language plpgsql security definer set search_path = '' as $review$
declare d public.office_device_registry%rowtype; v_review uuid; v_posture bigint;
begin
 select * into d from public.office_device_registry where id=p_device for update;
 if not found or d.device_kind not in ('LAPTOP','DESKTOP') or d.trust_state not in ('PENDING','REVOKED') then
   raise exception 'Only a pending/revoked company computer can enter recovery';
 end if;
 if not exists(select 1 from public.office_identity_users u where u.user_id=d.user_id and u.status='ACTIVE')
 or not exists(select 1 from public.office_user_roles r where r.user_id=d.user_id and r.role='OWNER'
               and (r.expires_at is null or r.expires_at>now())) then
   raise exception 'This recovery flow applies only to an active Founder/Owner device';
 end if;
 if p_actor=d.user_id
 or not exists(select 1 from public.office_identity_users u where u.user_id=p_actor and u.status='ACTIVE')
 or not exists(select 1 from public.office_user_roles r where r.user_id=p_actor and r.role in ('ADMIN','DIRECTOR')
               and (r.expires_at is null or r.expires_at>now()))
 or exists(select 1 from public.office_user_roles r where r.user_id=p_actor and r.role='OWNER'
           and (r.expires_at is null or r.expires_at>now())) then
   raise exception 'An independent, active Administrator or Director must verify the Founder device';
 end if;
 if p_encryption is distinct from true or p_screen_lock is distinct from true
 or p_agent is distinct from true or p_patch is distinct from true
 or p_firewall is distinct from true or p_compromise is distinct from false then
   raise exception 'Every security control must be confirmed and compromise must be false';
 end if;
 if p_company_managed is distinct from true then
   raise exception 'Company management evidence is required; personal BYOD requires a separate approved policy';
 end if;
 if char_length(trim(coalesce(p_os,'')))<3 or char_length(trim(coalesce(p_notes,''))) not between 30 and 500
 or char_length(trim(coalesce(p_management_evidence,''))) not between 12 and 300 then
   raise exception 'Provide Windows version, verification notes and management/asset evidence reference';
 end if;
 insert into public.office_device_posture_snapshots(
  device_id,recorded_by,os_version,encryption_enabled,screen_lock_enabled,
  security_agent_healthy,patch_current,firewall_enabled,compromise_detected,
  compliance_status,source,details)
 values(
  p_device,p_actor,left(trim(p_os),120),true,true,true,true,true,false,
  'COMPLIANT','MANUAL_ATTESTATION',
  jsonb_build_object('type','INDEPENDENT_FOUNDER_SECURITY_REVIEW','verification_notes',trim(p_notes),
                     'management_evidence_ref',trim(p_management_evidence))
 ) returning id into v_posture;
 update public.office_founder_device_reviews set status='SUPERSEDED'
 where device_id=p_device and status='PENDING';
 insert into public.office_founder_device_reviews(
  device_id,subject_user_id,reviewer_user_id,posture_id,company_managed_verified,management_evidence_ref,review_notes)
 values(p_device,d.user_id,p_actor,v_posture,true,trim(p_management_evidence),trim(p_notes))
 returning id into v_review;
 insert into public.office_access_audit(actor_user_id,actor_roles,target_user_id,action,reason,metadata)
 select p_actor,coalesce((select array_agg(r.role order by r.role) from public.office_user_roles r
                         where r.user_id=p_actor and (r.expires_at is null or r.expires_at>now())),array[]::text[]),
        d.user_id,'FOUNDER_DEVICE_SECURITY_REVIEWED','Independent device security verification',
        jsonb_build_object('device_id',p_device,'review_id',v_review,'posture_id',v_posture);
 return v_review;
end $review$;

-- The independent ADMIN or DIRECTOR signing off must be different from
-- both the reviewer and the device owner. In particular, OWNER self-approval
-- cannot recover an already revoked Founder computer.
create or replace function public.office_approve_founder_device(
 p_actor uuid,p_review uuid,p_reason text
) returns boolean
language plpgsql security definer set search_path = '' as $approve$
declare v public.office_founder_device_reviews%rowtype;
        d public.office_device_registry%rowtype; p public.office_device_posture_snapshots%rowtype;
        v_latest bigint; max_devices integer; trusted_count integer;
begin
 select * into v from public.office_founder_device_reviews where id=p_review for update;
 if not found or v.status<>'PENDING' then raise exception 'Device review is not awaiting approval'; end if;
 select * into d from public.office_device_registry where id=v.device_id for update;
 if not found or d.user_id<>v.subject_user_id or d.trust_state not in ('PENDING','REVOKED') then
   raise exception 'The device state has changed; request a new review';
 end if;
 if p_actor in (v.subject_user_id,v.reviewer_user_id)
 or not exists(select 1 from public.office_identity_users u where u.user_id=p_actor and u.status='ACTIVE')
 or not exists(select 1 from public.office_user_roles r where r.user_id=p_actor and r.role in ('ADMIN','DIRECTOR')
               and (r.expires_at is null or r.expires_at>now()))
 or exists(select 1 from public.office_user_roles r where r.user_id=p_actor and r.role='OWNER'
           and (r.expires_at is null or r.expires_at>now())) then
   raise exception 'A second independent active Administrator/Director must approve; no self-approval';
 end if;
 if char_length(trim(coalesce(p_reason,''))) not between 20 and 500 then
   raise exception 'Provide a meaningful signed approval reason';
 end if;
 if v.reviewed_at<now()-interval '72 hours'
 or v.reviewed_at<=coalesce(d.revoked_at,'epoch'::timestamptz)
 or v.company_managed_verified is distinct from true then
   raise exception 'Recovery review is stale, predates revocation or lacks company ownership/management evidence';
 end if;
 select * into p from public.office_device_posture_snapshots where id=v.posture_id;
 select max(id) into v_latest from public.office_device_posture_snapshots where device_id=d.id;
 if p.id is null or p.id<>v_latest or p.device_id<>d.id or p.recorded_by<>v.reviewer_user_id
 or p.compliance_status<>'COMPLIANT' or p.compromise_detected is distinct from false
 or p.encryption_enabled is distinct from true or p.screen_lock_enabled is distinct from true
 or p.security_agent_healthy is distinct from true or p.patch_current is distinct from true
 or p.firewall_enabled is distinct from true then
   raise exception 'Independent review evidence is no longer current or compliant';
 end if;
 select coalesce(max(c.max_active_devices),1) into max_devices
 from public.office_user_access_profiles a join public.office_access_profile_catalog c
 on c.code=a.profile_code
 where a.user_id=d.user_id and a.status='ACTIVE'
 and (a.expires_at is null or a.expires_at>now());
 max_devices:=greatest(max_devices,3);
 select count(*) into trusted_count from public.office_device_registry
 where user_id=d.user_id and trust_state='TRUSTED' and id<>d.id;
 if trusted_count>=max_devices then raise exception 'Device limit reached'; end if;
 update public.office_device_registry
 set trust_state='TRUSTED',company_managed=true,approved_by=p_actor,
     approved_at=now(),revoked_at=null,binding_token_hash=null,
     bound_at=null,bound_user_agent_hash=null,updated_at=now()
 where id=d.id;
 update public.office_founder_device_reviews
 set status='APPROVED',approved_by=p_actor,approved_at=now(),approval_reason=trim(p_reason)
 where id=v.id and status='PENDING';
 insert into public.office_access_audit(actor_user_id,actor_roles,target_user_id,action,reason,metadata)
 select p_actor,coalesce((select array_agg(r.role order by r.role) from public.office_user_roles r
                        where r.user_id=p_actor and (r.expires_at is null or r.expires_at>now())),array[]::text[]),
        d.user_id,'FOUNDER_DEVICE_APPROVED',trim(p_reason),
        jsonb_build_object('device_id',d.id,'review_id',v.id,'reviewer_user_id',v.reviewer_user_id,
                           'posture_id',v.posture_id,'company_managed',true);
 return true;
end $approve$;

-- Prevent bypassing the independent workflow using the legacy approval RPC.
create or replace function public.office_approve_device(
 p_actor uuid,p_device uuid,p_company_managed boolean default true,p_reason text default null
) returns boolean language plpgsql security definer set search_path = '' as $legacy$
declare rec public.office_device_registry%rowtype;
        max_devices integer; trusted_count integer;
        p public.office_device_posture_snapshots%rowtype;
begin
 select * into rec from public.office_device_registry where id=p_device for update;
 if not found then raise exception 'Device not found'; end if;
 if rec.user_id=p_actor or exists(select 1 from public.office_user_roles r where r.user_id=rec.user_id
  and r.role='OWNER' and (r.expires_at is null or r.expires_at>now())) then
   raise exception 'Self-approval and Founder device approval require an independent two-person review';
 end if;
 if not public.office_actor_can_administer_target(p_actor,rec.user_id) then
   raise exception 'Actor cannot administer target';
 end if;
 select * into p from public.office_device_posture_snapshots where device_id=p_device
 order by checked_at desc,id desc limit 1;
 if p.id is null or p.checked_at<now()-interval '72 hours'
 or p.compliance_status<>'COMPLIANT' or p.compromise_detected is distinct from false
 or p.encryption_enabled is distinct from true or p.screen_lock_enabled is distinct from true
 or p.security_agent_healthy is distinct from true or p.patch_current is distinct from true
 or p.firewall_enabled is distinct from true then
   raise exception 'Recent verified and uncompromised device posture is required';
 end if;
 select coalesce(max(c.max_active_devices),1) into max_devices
 from public.office_user_access_profiles up
 join public.office_access_profile_catalog c on c.code=up.profile_code
 where up.user_id=rec.user_id and up.status='ACTIVE'
 and (up.expires_at is null or up.expires_at>now());
 select count(*) into trusted_count from public.office_device_registry
 where user_id=rec.user_id and trust_state='TRUSTED' and id<>p_device;
 if trusted_count>=max_devices then raise exception 'Device limit reached for current access profile'; end if;
 update public.office_device_registry
 set trust_state='TRUSTED',company_managed=p_company_managed,approved_by=p_actor,
 approved_at=now(),revoked_at=null,updated_at=now()
 where id=p_device;
 insert into public.office_access_audit(actor_user_id,actor_roles,target_user_id,action,reason,metadata)
 select p_actor,coalesce((select array_agg(role order by role) from public.office_user_roles
 where user_id=p_actor and (expires_at is null or expires_at>now())),array[]::text[]),
 rec.user_id,'DEVICE_APPROVED',p_reason,
 jsonb_build_object('device_id',p_device,'company_managed',p_company_managed,'max_devices',max_devices);
 return true;
end $legacy$;

-- Existing trusted backend-only functions remain available to service_role.
revoke execute on function public.office_review_founder_device(uuid,uuid,text,boolean,boolean,boolean,boolean,boolean,boolean,boolean,text,text) from public,anon,authenticated;
revoke execute on function public.office_approve_founder_device(uuid,uuid,text) from public,anon,authenticated;
revoke execute on function public.office_approve_device(uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.office_review_founder_device(uuid,uuid,text,boolean,boolean,boolean,boolean,boolean,boolean,boolean,text,text) to service_role;
grant execute on function public.office_approve_founder_device(uuid,uuid,text) to service_role;
grant execute on function public.office_approve_device(uuid,uuid,boolean,text) to service_role;
revoke execute on function public.office_guard_device_compliant_snapshot() from public,anon,authenticated;
