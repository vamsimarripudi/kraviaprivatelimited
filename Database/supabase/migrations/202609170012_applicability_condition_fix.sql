-- Runtime qualification fix for applicability fact lookup. The original engine
-- intentionally uses an empty SECURITY DEFINER search_path; make the local fact
-- variable unambiguous and keep missing-fact traversal explicit.

create or replace function public.office_compliance_condition_match(p_condition jsonb)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  item jsonb;
  fact_value jsonb;
  op text;
  v_fact_code text;
begin
  if p_condition is null or p_condition='{}'::jsonb then return true; end if;
  if p_condition ? 'all' then
    if jsonb_typeof(p_condition->'all')<>'array' then return false; end if;
    for item in select value from jsonb_array_elements(p_condition->'all') loop
      if not public.office_compliance_condition_match(item) then return false; end if;
    end loop;
    return true;
  end if;
  if p_condition ? 'any' then
    if jsonb_typeof(p_condition->'any')<>'array' then return false; end if;
    for item in select value from jsonb_array_elements(p_condition->'any') loop
      if public.office_compliance_condition_match(item) then return true; end if;
    end loop;
    return false;
  end if;
  if p_condition ? 'not' then return not public.office_compliance_condition_match(p_condition->'not'); end if;

  v_fact_code:=p_condition->>'fact';
  op:=lower(coalesce(p_condition->>'op','eq'));
  if v_fact_code is null then return false; end if;

  select f.value_json into fact_value
  from public.office_applicability_facts f
  where f.fact_code=v_fact_code
    and f.status='ACTIVE'
    and f.effective_from<=current_date
    and (f.effective_to is null or f.effective_to>=current_date);
  if not found then return false; end if;
  if op='exists' then return true; end if;
  return public.office_compliance_compare(fact_value,op,p_condition->'value');
end;
$$;

revoke all on function public.office_compliance_condition_match(jsonb) from public,anon,authenticated;
grant execute on function public.office_compliance_condition_match(jsonb) to service_role;
