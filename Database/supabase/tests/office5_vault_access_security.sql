-- KRAVIA K-Vault isolated source/reviewer security rehearsal (rollback-only).
begin;
insert into public.office_identity_users(user_id,status) values
 ('00000000-0000-4000-8000-000000000001','ACTIVE'),
 ('00000000-0000-4000-8000-000000000002','ACTIVE'),
 ('00000000-0000-4000-8000-000000000003','ACTIVE'),
 ('00000000-0000-4000-8000-000000000004','PENDING');
insert into public.office_company_registrations(id) values ('00000000-0000-4000-8000-000000000020');
insert into public.office_document_instances(id) values ('00000000-0000-4000-8000-000000000030');

do $$
declare
 requester uuid:='00000000-0000-4000-8000-000000000001';
 reviewer uuid:='00000000-0000-4000-8000-000000000002';
 outsider uuid:='00000000-0000-4000-8000-000000000003';
 pending_user uuid:='00000000-0000-4000-8000-000000000004';
 record uuid:='00000000-0000-4000-8000-000000000020';
 request_id uuid; grant_id uuid; withdrawn uuid; rejected uuid;
begin
 if has_table_privilege('authenticated','public.office_vault_access_grants','SELECT')
  or has_table_privilege('anon','public.office_vault_access_requests','INSERT')
  or has_function_privilege('authenticated','public.office_vault_review_access(uuid,uuid,boolean,text)','EXECUTE')
 then raise exception 'Untrusted browser role has Vault access'; end if;
 if not (select relrowsecurity from pg_class where oid='public.office_vault_access_grants'::regclass) then
  raise exception 'Vault grants do not have RLS enabled'; end if;
 request_id:=public.office_vault_request_access(requester,'registrations',record,'READ',
   'Independent source check for board filing',now()+interval '7 days');
 if not exists(select 1 from public.office_vault_access_requests where id=request_id and status='PENDING')
 then raise exception 'Pending request not stored'; end if;
 if exists(select 1 from public.office_vault_access_grants where request_id=request_id)
 then raise exception 'Pending request created an immediate grant'; end if;
 begin
   perform public.office_vault_review_access(requester,request_id,true,'I approve myself');
   raise exception 'Self-approval was allowed';
 exception when raise_exception then
  if sqlerrm='Self-approval was allowed' then raise; end if;
 end;
 begin
   perform public.office_vault_review_access(outsider,request_id,true,'No delegated authority');
   raise exception 'Unprivileged reviewer was allowed';
 exception when raise_exception then
  if sqlerrm='Unprivileged reviewer was allowed' then raise; end if;
 end;
 if public.office_vault_review_access(reviewer,request_id,true,'Verified source and independent workflow')
  <>'APPROVED' then raise exception 'Authorized grant did not commit'; end if;
 select id into grant_id from public.office_vault_access_grants where request_id=request_id;
 if grant_id is null or not exists(select 1 from public.office_vault_access_events
  where request_id=request_id and event_type='APPROVED') then
  raise exception 'Grant/audit was not recorded';
 end if;
 if not public.office_vault_revoke_access(reviewer,grant_id,'Role changed and access no longer required')
 then raise exception 'Authorized revocation failed'; end if;
 if not exists(select 1 from public.office_vault_access_grants where id=grant_id and revoked_at is not null)
 then raise exception 'Revoked grant remains effective'; end if;
 withdrawn:=public.office_vault_request_access(requester,'documents',null,'READ',
  'Review controlled document evidence only',now()+interval '10 days');
 if not public.office_vault_withdraw_access(requester,withdrawn) then
  raise exception 'Requester withdrawal failed'; end if;
 begin
   perform public.office_vault_review_access(reviewer,withdrawn,true,'After withdrawal');
   raise exception 'Withdrawn request was approved';
 exception when raise_exception then
  if sqlerrm='Withdrawn request was approved' then raise; end if;
 end;
 rejected:=public.office_vault_request_access(requester,'documents',null,'READ',
  'Questionable access must be denied independently',now()+interval '10 days');
 if public.office_vault_review_access(reviewer,rejected,false,'Not needed for assigned work')
  <>'DENIED' then raise exception 'Denial was not recorded'; end if;
 if exists(select 1 from public.office_vault_access_grants where request_id=rejected)
 then raise exception 'Denied request created a grant'; end if;
 begin
   perform public.office_vault_request_access(pending_user,'documents',null,'READ',
     'Pending identity should never get access',now()+interval '10 days');
   raise exception 'Pending identity requested Vault access';
 exception when raise_exception then
  if sqlerrm='Pending identity requested Vault access' then raise; end if;
 end;
 begin
   perform public.office_vault_request_access(requester,'documents',null,'READ',
     'Excessive duration must be rejected',now()+interval '91 days');
   raise exception 'Access longer than 90 days was allowed';
 exception when raise_exception then
  if sqlerrm='Access longer than 90 days was allowed' then raise; end if;
 end;
end; $$;
rollback;
