-- Restricted Trust, DPDP, accessibility and security support queues.
-- This follows the Support Operations base migration and keeps sensitive public requests out of the general queue.
create type public.support_case_queue as enum ('GENERAL','TRUST_DPDPA','SECURITY_REPORTING');

alter table public.support_cases
  add column queue public.support_case_queue not null default 'GENERAL',
  add column request_kind text not null default 'SUPPORT_REQUEST' check (char_length(request_kind) between 3 and 80),
  add column source text not null default 'PUBLIC_SUPPORT' check (char_length(source) between 3 and 80),
  add column retention_review_at date;

create index support_cases_restricted_queue_idx on public.support_cases(queue, status, priority desc, updated_at desc);

create or replace function public.can_access_support_queue(p_queue public.support_case_queue) returns boolean language sql stable security definer set search_path = public as $$
  select case p_queue
    when 'TRUST_DPDPA' then public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','LEGAL_REVIEWER','PRIVACY_REVIEWER','SYSTEM_ADMIN']::public.corporate_role[])
    when 'SECURITY_REPORTING' then public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','SECURITY_REVIEWER','SYSTEM_ADMIN']::public.corporate_role[])
    else public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','SYSTEM_ADMIN']::public.corporate_role[])
  end
$$;
revoke all on function public.can_access_support_queue(public.support_case_queue) from public;
grant execute on function public.can_access_support_queue(public.support_case_queue) to authenticated;

drop policy if exists "support cases: authorised staff read" on public.support_cases;
drop policy if exists "support updates: authorised staff read" on public.support_case_updates;
create policy "support cases: queue scoped read" on public.support_cases for select to authenticated using (public.can_access_support_queue(queue));
create policy "support updates: queue scoped read" on public.support_case_updates for select to authenticated using (
  exists(select 1 from public.support_cases c where c.id = case_id and public.can_access_support_queue(c.queue))
);

drop function public.create_support_case(text,text,text,text,text,text,text,text);
create function public.create_support_case(
  p_reference text, p_tracking_secret_hash text, p_requester_name text, p_requester_email text,
  p_organisation text, p_category text, p_subject text, p_description text,
  p_queue public.support_case_queue, p_request_kind text, p_source text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_case_id uuid;
begin
  insert into public.support_cases(
    reference, tracking_secret_hash, requester_name, requester_email, organisation, category, subject, description,
    queue, request_kind, source, privacy_acknowledged_at
  ) values (
    p_reference, p_tracking_secret_hash, p_requester_name, p_requester_email, nullif(p_organisation, ''), p_category, p_subject, p_description,
    p_queue, p_request_kind, p_source, now()
  ) returning id into v_case_id;
  insert into public.support_case_updates(case_id, author_kind, body, customer_visible)
  values (v_case_id, 'KRAVIA', 'Your request has been received and is in the intake queue.', true);
  insert into public.audit_events(action, entity_type, entity_id, context)
  values ('SUPPORT_CASE_CREATED', 'support_case', v_case_id, jsonb_build_object('reference', p_reference, 'queue', p_queue, 'request_kind', p_request_kind, 'source', p_source));
  return v_case_id;
end;
$$;
revoke all on function public.create_support_case(text,text,text,text,text,text,text,text,public.support_case_queue,text,text) from public;
grant execute on function public.create_support_case(text,text,text,text,text,text,text,text,public.support_case_queue,text,text) to service_role;

create or replace function public.transition_support_case(p_case_id uuid, p_status public.support_case_status, p_priority public.support_case_priority, p_assigned_to uuid default null) returns void language plpgsql security definer set search_path = public as $$
declare v_current public.support_case_status; v_queue public.support_case_queue;
begin
  select status, queue into v_current, v_queue from public.support_cases where id = p_case_id for update;
  if v_current is null then raise exception 'Support case not found'; end if;
  if not public.can_access_support_queue(v_queue) then raise exception 'Authorised support role required'; end if;
  if v_current = 'CLOSED' and p_status <> 'CLOSED' then raise exception 'Closed cases require a controlled reopen workflow'; end if;
  if v_current = 'RESOLVED' and p_status not in ('RESOLVED','CLOSED') then raise exception 'Resolved cases may only be closed through this workflow'; end if;
  update public.support_cases set status = p_status, priority = p_priority, assigned_to = coalesce(p_assigned_to, assigned_to),
    resolved_at = case when p_status = 'RESOLVED' then now() else resolved_at end,
    closed_at = case when p_status = 'CLOSED' then now() else null end,
    updated_at = now(), version = version + 1
  where id = p_case_id;
  insert into public.audit_events(actor_id, action, entity_type, entity_id, context)
  values (auth.uid(), 'SUPPORT_CASE_TRANSITIONED', 'support_case', p_case_id, jsonb_build_object('from', v_current, 'to', p_status, 'priority', p_priority, 'queue', v_queue));
end;
$$;

create or replace function public.add_support_case_update(p_case_id uuid, p_body text, p_customer_visible boolean) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_queue public.support_case_queue;
begin
  select queue into v_queue from public.support_cases where id = p_case_id for update;
  if v_queue is null then raise exception 'Support case not found'; end if;
  if not public.can_access_support_queue(v_queue) then raise exception 'Authorised support role required'; end if;
  insert into public.support_case_updates(case_id, author_kind, author_id, body, customer_visible)
  values (p_case_id, 'KRAVIA', auth.uid(), p_body, p_customer_visible) returning id into v_id;
  update public.support_cases set last_customer_visible_update_at = case when p_customer_visible then now() else last_customer_visible_update_at end, updated_at = now(), version = version + 1 where id = p_case_id;
  insert into public.audit_events(actor_id, action, entity_type, entity_id, context)
  values (auth.uid(), 'SUPPORT_CASE_UPDATED', 'support_case', p_case_id, jsonb_build_object('customer_visible', p_customer_visible, 'queue', v_queue));
  return v_id;
end;
$$;