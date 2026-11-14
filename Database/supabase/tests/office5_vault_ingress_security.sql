-- Rollback-only chunk staging security rehearsal on isolated PostgreSQL.
begin;
insert into public.office_identity_users(user_id,status) values
 ('00000000-0000-4000-8000-000000000001','ACTIVE'),
 ('00000000-0000-4000-8000-000000000002','ACTIVE');
do $$
declare s uuid:='00000000-0000-4000-8000-000000000010';
begin
 if has_table_privilege('authenticated','public.office_vault_secret_ingress_parts','SELECT')
 or has_table_privilege('anon','public.office_vault_secret_ingress_sessions','INSERT')
 or not (select relrowsecurity from pg_class where oid='public.office_vault_secret_ingress_parts'::regclass)
 then raise exception 'Sealed staging is exposed to browser roles'; end if;
 insert into public.office_vault_secret_ingress_sessions(
  id,owner_user_id,document_id,version_id,title,classification,
  filename,declared_mime,total_bytes,sha256,part_size,part_count,expires_at
 )values(s,'00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000020',
  '00000000-0000-4000-8000-000000000030',
  'Controlled file','RESTRICTED','evidence.pdf','application/pdf',
  1500000,repeat('a',64),1048576,2,now()+interval '1 hour');
 begin
  update public.office_vault_secret_ingress_sessions
   set owner_user_id='00000000-0000-4000-8000-000000000002' where id=s;
  raise exception 'Owner tampering was permitted';
 exception when raise_exception then
  if sqlerrm='Owner tampering was permitted' then raise; end if;
 end;
 insert into public.office_vault_secret_ingress_parts(
  session_id,part_index,part_id,byte_size,sha256,sealed_path,key_id,
  wrapped_key,wrap_nonce,wrap_tag,content_nonce,content_tag
 )values(s,0,'00000000-0000-4000-8000-000000000040',
  1048576,repeat('b',64),'ingress/'||s::text||'/0.sealed',
  'test',repeat('A',48),repeat('a',24),repeat('b',32),
  repeat('c',24),repeat('d',32));
 begin
  update public.office_vault_secret_ingress_parts set sha256=repeat('c',64)
   where session_id=s and part_index=0;
  raise exception 'Encrypted part tampering was permitted';
 exception when raise_exception then
  if sqlerrm='Encrypted part tampering was permitted' then raise; end if;
 end;
 update public.office_vault_secret_ingress_parts set state='READY'
  where session_id=s and part_index=0;
 begin
  update public.office_vault_secret_ingress_parts set state='PENDING'
   where session_id=s and part_index=0;
  raise exception 'READY part was reverted';
 exception when raise_exception then
  if sqlerrm='READY part was reverted' then raise; end if;
 end;
 update public.office_vault_secret_ingress_sessions
  set state='FINALIZING',updated_at=now() where id=s;
 update public.office_vault_secret_ingress_sessions
  set state='DONE',updated_at=now() where id=s;
 begin
  update public.office_vault_secret_ingress_sessions
   set state='OPEN',updated_at=now() where id=s;
  raise exception 'Completed ingress was reopened';
 exception when raise_exception then
  if sqlerrm='Completed ingress was reopened' then raise; end if;
 end;
end; $$;
rollback;
