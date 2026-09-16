-- KRAVIA Phase 5B: public corporate-fact projection and immutable audit coverage.
-- This does not expose the corporate_facts table. The function returns only current,
-- explicitly PUBLIC and PUBLIC_APPROVED facts that are currently effective.

create or replace function public.public_corporate_facts()
returns table (
  fact_key text,
  value jsonb,
  verification_status text,
  effective_from date,
  last_reviewed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (f.fact_key)
    f.fact_key,
    f.value,
    f.verification_status,
    f.effective_from,
    f.last_reviewed_at
  from public.corporate_facts f
  where f.visibility = 'PUBLIC'
    and f.verification_status = 'PUBLIC_APPROVED'
    and (f.effective_from is null or f.effective_from <= current_date)
    and (f.effective_to is null or f.effective_to >= current_date)
  order by f.fact_key, f.effective_from desc nulls last, f.updated_at desc;
$$;

revoke all on function public.public_corporate_facts() from public;
grant execute on function public.public_corporate_facts() to anon, authenticated;

create or replace function public.audit_corporate_fact_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_events (actor_id, action, entity_type, entity_id, context, previous_state, new_state)
  values (
    auth.uid(),
    case when tg_op = 'INSERT' then 'CORPORATE_FACT_CREATED' else 'CORPORATE_FACT_UPDATED' end,
    'CORPORATE_FACT',
    new.id,
    jsonb_build_object('fact_key', new.fact_key, 'visibility', new.visibility, 'verification_status', new.verification_status),
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
    to_jsonb(new)
  );
  return new;
end;
$$;

drop trigger if exists corporate_facts_audit on public.corporate_facts;
create trigger corporate_facts_audit
after insert or update on public.corporate_facts
for each row execute function public.audit_corporate_fact_change();