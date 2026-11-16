-- Running this suite never changes a production or real device.
do $verify$
declare review_id uuid; owner_id uuid:='00000000-0000-0000-0000-000000000001';
 reviewer_id uuid:='00000000-0000-0000-0000-000000000002';
 admin_id uuid:='00000000-0000-0000-0000-000000000003';
 v_device uuid:='00000000-0000-0000-0000-000000000011';
 status text; count_approved integer; security_note text;
begin
 security_note:='Independent Defender scan and BitLocker/Firewall/Updates verified on actual laptop';
 -- The historic contradictory review survives but new inconsistent COMPLIANT does not.
 if (select count(*) from public.office_device_posture_snapshots where compromise_detected=true)!=1
 then raise exception 'Historical audit evidence lost'; end if;
 begin
  insert into public.office_device_posture_snapshots(device_id,recorded_by,os_version,
   encryption_enabled,screen_lock_enabled,security_agent_healthy,patch_current,
   firewall_enabled,compromise_detected,compliance_status,source)
  values(v_device,reviewer_id,'Windows 11',true,true,true,true,true,true,'COMPLIANT','MANUAL_ATTESTATION');
  raise exception 'INCONSISTENT_COMPLIANCE_NOT_REJECTED';
 exception when others then
  if sqlerrm='INCONSISTENT_COMPLIANCE_NOT_REJECTED' then raise; end if;
  if position('COMPLIANT requires all verified security checks' in sqlerrm)=0 then raise; end if;
 end;
 -- Never allow owner self-review.
 begin
  perform public.office_review_founder_device(
   owner_id,v_device,'Windows 11',true,true,true,true,true,false,true,
   'Company management record DEMO-000001',security_note);
  raise exception 'OWNER_SELF_REVIEW_ALLOWED';
 exception when others then
  if sqlerrm='OWNER_SELF_REVIEW_ALLOWED' then raise; end if;
  if position('independent' in lower(sqlerrm))=0 then raise; end if;
 end;
 -- Block the old one-step approval function on Founder device.
 begin
  perform public.office_approve_device(owner_id,v_device,true,'Do not allow owner self approval');
  raise exception 'LEGACY_FOUNDER_APPROVAL_ALLOWED';
 exception when others then
  if sqlerrm='LEGACY_FOUNDER_APPROVAL_ALLOWED' then raise; end if;
  if position('independent' in lower(sqlerrm))=0 then raise; end if;
 end;
 -- The actual independent DIRECTOR manually verifies the laptop.
 review_id:=public.office_review_founder_device(
   reviewer_id,v_device,'Windows 11',true,true,true,true,true,false,true,
   'Company management record DEMO-000001',security_note);
 if review_id is null then raise exception 'Director review not recorded'; end if;
 select trust_state into status from public.office_device_registry where id=v_device;
 if status<>'REVOKED' then raise exception 'Security review wrongly un-revoked the laptop'; end if;
 -- Reviewer can never be their own final approver.
 begin
  perform public.office_approve_founder_device(reviewer_id,review_id,
    'I separately approve the reviewed device');
  raise exception 'REVIEWER_SELF_APPROVAL_ALLOWED';
 exception when others then
  if sqlerrm='REVIEWER_SELF_APPROVAL_ALLOWED' then raise; end if;
  if position('second independent' in lower(sqlerrm))=0 then raise; end if;
 end;
 -- The different independent ADMIN approves after verified evidence.
 perform public.office_approve_founder_device(admin_id,review_id,
   'I independently reviewed the verified evidence and management record');
 if not exists(select 1 from public.office_device_registry where id=v_device
   and trust_state='TRUSTED' and company_managed=true
   and revoked_at is null and bound_at is null and binding_token_hash is null)
 then raise exception 'Approved device state incorrect or old binding reused'; end if;
 select count(*) into count_approved from public.office_founder_device_reviews
 where device_id=v_device and status='APPROVED';
 if count_approved<>1 then raise exception 'Approval audit missing'; end if;
 if (select count(*) from public.office_access_audit where action in
   ('FOUNDER_DEVICE_SECURITY_REVIEWED','FOUNDER_DEVICE_APPROVED'))<>2
 then raise exception 'Missing two independent audit events'; end if;
 -- No replay of an already-approved decision.
 begin
  perform public.office_approve_founder_device(admin_id,review_id,
    'Attempt to approve the same completed device twice');
  raise exception 'APPROVAL_REPLAY_ALLOWED';
 exception when others then
  if sqlerrm='APPROVAL_REPLAY_ALLOWED' then raise; end if;
 end;
end $verify$;
select 'FOUNDER_TWO_PERSON_DEVICE_RECOVERY_VERIFIED' as result;
