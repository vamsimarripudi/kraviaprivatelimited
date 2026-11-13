do $$
begin
  if has_table_privilege('anon','public.office_manual_receipts','SELECT')
     or has_table_privilege('authenticated','public.office_manual_receipts','SELECT')
     or has_function_privilege('anon','public.office_manual_record_receipt(uuid,text,text,text)','EXECUTE')
     or has_function_privilege('authenticated','public.office_manual_record_receipt(uuid,text,text,text)','EXECUTE')
  then raise exception 'Public access to manual receipts was not revoked'; end if;
  if not has_function_privilege('service_role','public.office_manual_record_receipt(uuid,text,text,text)','EXECUTE')
  then raise exception 'The trusted service role cannot record receipts'; end if;
  if not (select relrowsecurity from pg_class where oid='public.office_manual_receipts'::regclass)
  then raise exception 'Receipt RLS is disabled'; end if;
  if not (select relrowsecurity from pg_class where oid='public.office_manual_receipt_events'::regclass)
  then raise exception 'Event RLS is disabled'; end if;
end $$;

set role service_role;
select public.office_manual_record_receipt('11111111-1111-4111-8111-111111111111'::uuid,'COMMON','2026-11-13.1','OPEN');
select public.office_manual_record_receipt('11111111-1111-4111-8111-111111111111'::uuid,'COMMON','2026-11-13.1','ACKNOWLEDGE');
select public.office_manual_record_receipt('11111111-1111-4111-8111-111111111111'::uuid,'COMMON','2026-11-13.1','ACKNOWLEDGE');
select public.office_manual_record_receipt('11111111-1111-4111-8111-111111111111'::uuid,'ROLE:TRAINEE','2026-11-13.1','OPEN');
reset role;

do $$
begin
  if (select status from public.office_manual_receipts
      where manual_key='COMMON' and user_id='11111111-1111-4111-8111-111111111111') <> 'ACKNOWLEDGED'
  then raise exception 'Expected acknowledged common manual'; end if;
  if (select count(*) from public.office_manual_receipt_events) <> 3
  then raise exception 'Idempotent acknowledgements must not create duplicate event logs'; end if;
  if (select count(*) from public.office_manual_receipts where manual_key='ROLE:TRAINEE') <> 1
  then raise exception 'Role-specific open receipt missing'; end if;
end $$;

select 'OFFICE_MANUAL_POSTGRES_VERIFIED';
