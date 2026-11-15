-- KRAVIA K-Vault: explicit executive entry entitlement (no file-level grant).
-- This migration is limited to the one currently appointed CEO and Founder.
-- It does not modify job titles, owner roles, managed-device trust or document grants.
insert into public.office_permission_catalog(
 code,module,action,label,description,sensitivity,
 high_risk,requires_managed_device,active,owner_bypass
) values (
 'vault.entry','VAULT','ENTER','Enter K-Vault',
 'Access the K-Vault index only; each document still requires independent source and record grants.',
 'SENSITIVE',false,false,true,false
);
do $migration$
declare founder_id uuid; ceo_id uuid; founder_count integer; ceo_count integer;
begin
 select count(distinct i.user_id) into founder_count
 from public.office_identity_users i
 join public.office_user_roles r on r.user_id=i.user_id and r.role='OWNER'
  and (r.expires_at is null or r.expires_at>now())
 join public.office_job_assignments j on j.user_id=i.user_id
  and j.position_code='OWNER_FOUNDER' and j.status='ACTIVE'
 where i.status='ACTIVE';
 select count(distinct i.user_id) into ceo_count
 from public.office_identity_users i
 join public.office_user_roles r on r.user_id=i.user_id and r.role='DIRECTOR'
  and (r.expires_at is null or r.expires_at>now())
 where i.status='ACTIVE' and i.job_title='CEO & CFO';
 if founder_count<>1 or ceo_count<>1 then
   raise exception 'Vault entry requires exactly one current Founder and one current CEO';
 end if;
 select distinct i.user_id into strict founder_id
 from public.office_identity_users i
 join public.office_user_roles r on r.user_id=i.user_id and r.role='OWNER'
  and (r.expires_at is null or r.expires_at>now())
 join public.office_job_assignments j on j.user_id=i.user_id
  and j.position_code='OWNER_FOUNDER' and j.status='ACTIVE'
 where i.status='ACTIVE';
 select distinct i.user_id into strict ceo_id
 from public.office_identity_users i
 join public.office_user_roles r on r.user_id=i.user_id and r.role='DIRECTOR'
  and (r.expires_at is null or r.expires_at>now())
 where i.status='ACTIVE' and i.job_title='CEO & CFO';
 if founder_id=ceo_id then raise exception 'Founder and CEO assignments must be distinct'; end if;
 -- Source-authorized RPC records actor, target, reason and effective permission.
 perform public.office_set_permission_override(founder_id,founder_id,
  'vault.entry','ALLOW','COMPANY',null,
  'Founder and Executive K-Vault entry per Owner instruction 2026-11-16',null);
 perform public.office_set_permission_override(founder_id,ceo_id,
  'vault.entry','ALLOW','COMPANY',null,
  'Current CEO K-Vault entry per Owner instruction 2026-11-16',null);
 -- Metadata/preview capability only. Files additionally require company-managed
 -- trusted device, independent clean scan/review and explicit record grant.
 perform public.office_set_permission_override(founder_id,ceo_id,
  'vault.secret.read','ALLOW','COMPANY',null,
  'CEO secret metadata review only, subject to managed-device and per-record authorization',null);
end;
$migration$;
