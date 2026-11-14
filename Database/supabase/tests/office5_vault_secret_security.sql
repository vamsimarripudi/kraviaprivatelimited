begin;
insert into public.office_identity_users(user_id,status) values
 ('00000000-0000-4000-8000-000000000010','ACTIVE'),
 ('00000000-0000-4000-8000-000000000012','ACTIVE');
do $$
declare
 maker uuid:='00000000-0000-4000-8000-000000000010';
 reviewer uuid:='00000000-0000-4000-8000-000000000002';
 reader uuid:='00000000-0000-4000-8000-000000000012';
 v uuid:='00000000-0000-4000-8000-000000000090';
 doc uuid;req uuid; grant_id uuid; v_state text;
begin
 if has_table_privilege('authenticated','public.office_vault_secret_documents','SELECT')
 or has_table_privilege('anon','public.office_vault_secret_versions','INSERT')
 or has_function_privilege('authenticated','public.office_vault_secret_review(uuid,uuid,boolean,text)','EXECUTE')
 then raise exception 'Browser may access sealed Vault records'; end if;
 if not (select relrowsecurity from pg_class where oid='public.office_vault_secret_versions'::regclass)
 then raise exception 'Sealed version RLS is disabled'; end if;
 -- The independent stub permits only Reviewer identity; an ordinary employee
 -- must never register a sealed file by calling a privileged RPC directly.
 begin
  perform public.office_vault_secret_register(maker,null,v,'Payroll originals',
   'FINANCE','payroll.pdf','application/pdf',12,repeat('a',64),
   'not-owned/invalid-path','v1',repeat('b',44),repeat('c',24),
   repeat('d',32),repeat('e',24),repeat('f',32));
  raise exception 'Unprivileged maker registered secret';
 exception when raise_exception then
  if sqlerrm='Unprivileged maker registered secret' then raise; end if;
 end;
 -- The register function requires a canonical path tied to a source id.
 if not (select relrowsecurity from pg_class
   where oid='public.office_vault_secret_documents'::regclass)
 then raise exception 'Secret index RLS is disabled'; end if;
 if has_table_privilege('authenticated','public.office_vault_secret_events','SELECT')
 then raise exception 'Private audit events exposed'; end if;
 if not exists(select 1 from storage.buckets where id='office-vault-secrets' and public=false)
 then raise exception 'Sealed bucket is not private'; end if;
 if public.office_vault_source_review_permission('secrets')<>'vault.secret.review'
 then raise exception 'Vault secret access category reviewer missing'; end if;
end;
$;
rollback;
