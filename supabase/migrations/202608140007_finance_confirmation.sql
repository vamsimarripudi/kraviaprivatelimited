-- Atomic promotion from reviewed import staging to finance records. Duplicate-marked rows are intentionally excluded.
create or replace function public.confirm_financial_import(p_import_id uuid) returns integer language plpgsql security definer set search_path = public as $$
declare v_import public.financial_imports; v_count integer := 0; v_transaction_id uuid; v_row record; begin
  if not public.can_manage_finance() then raise exception 'Authorised finance role required'; end if;
  select * into v_import from public.financial_imports where id = p_import_id for update;
  if not found or v_import.validation_status not in ('VALIDATED','REVIEW_REQUIRED') then raise exception 'Import is not eligible for confirmation'; end if;
  if exists(select 1 from public.financial_import_rows where import_id = p_import_id and (possible_duplicate or validation_status not in ('VALIDATED','CONFIRMED'))) then raise exception 'All staged rows must be reviewed and duplicate flags resolved before confirmation'; end if;
  for v_row in select * from public.financial_import_rows where import_id = p_import_id and confirmed_transaction_id is null order by row_number loop
    insert into public.financial_transactions(bank_account_id, import_row_id, transaction_date, bank_reference, original_description, debit, credit, balance, description_fingerprint)
    values (v_import.bank_account_id, v_row.id, (v_row.parsed_data ->> 'date')::date, v_row.parsed_data ->> 'reference', v_row.parsed_data ->> 'description', coalesce((v_row.parsed_data ->> 'debit')::numeric, 0), coalesce((v_row.parsed_data ->> 'credit')::numeric, 0), nullif(v_row.parsed_data ->> 'balance', '')::numeric, v_row.parsed_data ->> 'fingerprint') returning id into v_transaction_id;
    update public.financial_import_rows set confirmed_transaction_id = v_transaction_id, validation_status = 'CONFIRMED' where id = v_row.id;
    v_count := v_count + 1;
  end loop;
  update public.financial_imports set validation_status = 'CONFIRMED', confirmed_at = now(), reviewed_by = auth.uid() where id = p_import_id;
  return v_count;
end $$;
revoke all on function public.confirm_financial_import(uuid) from public; grant execute on function public.confirm_financial_import(uuid) to authenticated;
