-- Real SQL maker-checker / immutable version tests against isolated Postgres.
begin;
insert into public.office_identity_users(user_id,status) values
 ('00000000-0000-4000-8000-000000000010','ACTIVE'),
 ('00000000-0000-4000-8000-000000000012','ACTIVE');
do $$
declare
 maker uuid:='00000000-0000-4000-8000-000000000010';
 reviewer uuid:='00000000-0000-4000-8000-000000000002';
 reader uuid:='00000000-0000-4000-8000-000000000012';
 doc uuid:='00000000-0000-4000-8000-000000000080';
 version uuid:='00000000-0000-4000-8000-000000000090';
 rejected uuid:='00000000-0000-4000-8000-000000000091';
 request_id uuid; grant_id uuid;
begin
 if has_table_privilege('authenticated','public.office_vault_secret_documents','SELECT')
 or has_table_privilege('anon','public.office_vault_secret_versions','INSERT')
 or has_function_privilege('authenticated','public.office_vault_secret_review(uuid,uuid,boolean,text)','EXECUTE')
 then raise exception 'Browser can access sealed Vault records'; end if;
 if not (select relrowsecurity from pg_class
   where oid='public.office_vault_secret_versions'::regclass)
 then raise exception 'Sealed version RLS is disabled'; end if;
 if has_table_privilege('authenticated','public.office_vault_secret_events','SELECT')
 then raise exception 'Private audit events exposed'; end if;
 if not exists(select 1 from storage.buckets
   where id='office-vault-secrets' and public=false)
 then raise exception 'Secret object bucket is not private'; end if;
 if public.office_vault_source_review_permission('secrets')<>'vault.secret.review'
 then raise exception 'Secret category reviewer missing'; end if;
 begin
  perform public.office_vault_secret_register(reader,doc,version,
   'Unauthorized file','BOARD','board.pdf','application/pdf',12,
   repeat('a',64),doc::text||'/'||version::text||'.sealed',
   'v1',repeat('b',44),repeat('c',24),repeat('d',32),repeat('e',24),repeat('f',32));
  raise exception 'Unprivileged author staged a secret';
 exception when raise_exception then
  if sqlerrm='Unprivileged author staged a secret' then raise; end if;
 end;
 if public.office_vault_secret_register(maker,doc,version,
  'Board original evidence','BOARD','board.pdf','application/pdf',12,
  repeat('a',64),doc::text||'/'||version::text||'.sealed',
  'v1',repeat('b',44),repeat('c',24),repeat('d',32),repeat('e',24),repeat('f',32))<>doc
 then raise exception 'Sealed version registration did not return its document'; end if;
 if not exists(select 1 from public.office_vault_secret_versions
  where id=version and scan_state='QUARANTINED' and review_state='PENDING')
 then raise exception 'New secret was not quarantined'; end if;
 begin
  perform public.office_vault_secret_review(reviewer,version,true,'Unscanned data');
  raise exception 'Reviewer approved without scanner release';
 exception when raise_exception then
  if sqlerrm='Reviewer approved without scanner release' then raise; end if;
 end;
 if public.office_vault_secret_scan_result(maker,version,repeat('a',64),true)<>'CLEAN'
 then raise exception 'Scan evidence not recorded'; end if;
 begin
  perform public.office_vault_secret_review(maker,version,true,'Self approval prohibited');
  raise exception 'Maker approved their own upload';
 exception when raise_exception then
  if sqlerrm='Maker approved their own upload' then raise; end if;
 end;
 if public.office_vault_secret_review(reviewer,version,true,'Scanner-clean and independently reviewed')<>'APPROVED'
 then raise exception 'Independent secret review did not commit'; end if;
 begin
  update public.office_vault_secret_versions set sha256=repeat('e',64) where id=version;
  raise exception 'Approved evidence mutated';
 exception when raise_exception then
  if sqlerrm='Approved evidence mutated' then raise; end if;
 end;
 request_id:=public.office_vault_request_access(reader,'secrets',doc,'DOWNLOAD',
  'Need a controlled board record for approved company work',now()+interval '7 days');
 if public.office_vault_review_access(reviewer,request_id,true,
  'Verified current duties and independent document scope')<>'APPROVED'
 then raise exception 'Secret-specific permission approval did not commit'; end if;
 select id into grant_id from public.office_vault_access_grants where request_id=request_id;
 if grant_id is null then raise exception 'Approved per-secret grant missing'; end if;
 if not public.office_vault_revoke_access(reviewer,grant_id,
  'Access completed and no longer needed for this role')
 then raise exception 'Secret grant revocation failed'; end if;
 if (select count(*) from public.office_vault_secret_events
  where document_id=doc and event_type in ('SEALED','SCAN_CLEAN','APPROVED'))<>3
 then raise exception 'Complete sealed-file evidence trail not recorded'; end if;
end;
$$;
rollback;
