-- KRAVIA Office: private, version-bound training receipts.
-- This migration MUST be rehearsed and applied before enabling the Info module.
-- Documentation receipts are not legal e-signatures, payroll approvals or employment activations.
create table if not exists public.office_manual_receipts (
  user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
  manual_key text not null check (manual_key = 'COMMON' or manual_key ~ '^ROLE:[A-Z0-9-]{3,80}$'),
  manual_version text not null check (manual_version ~ '^[0-9A-Za-z.-]{3,40}$'),
  status text not null default 'IN_PROGRESS' check (status in ('IN_PROGRESS','ACKNOWLEDGED')),
  opened_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  primary key (user_id,manual_key,manual_version),
  constraint office_manual_ack_state check (
    (status='ACKNOWLEDGED' and acknowledged_at is not null)
    or (status='IN_PROGRESS' and acknowledged_at is null)
  )
);
create index if not exists office_manual_receipts_user_ack_idx
  on public.office_manual_receipts(user_id,acknowledged_at desc);

create table if not exists public.office_manual_receipt_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
  manual_key text not null,
  manual_version text not null,
  event_type text not null check (event_type in ('OPENED','ACKNOWLEDGED')),
  recorded_at timestamptz not null default now()
);
create index if not exists office_manual_receipt_events_actor_idx
  on public.office_manual_receipt_events(actor_user_id,recorded_at desc);

alter table public.office_manual_receipts enable row level security;
alter table public.office_manual_receipt_events enable row level security;
revoke all on public.office_manual_receipts,public.office_manual_receipt_events from public,anon,authenticated;
grant select,insert,update on public.office_manual_receipts to service_role;
grant select,insert on public.office_manual_receipt_events to service_role;
grant usage,select on sequence public.office_manual_receipt_events_id_seq to service_role;

create or replace function public.office_manual_record_receipt(
  p_actor uuid, p_key text, p_version text, p_action text
) returns text
language plpgsql security invoker set search_path=public
as $$
declare
  previous_status text;
  next_status text;
begin
  if p_actor is null or not exists (
    select 1 from public.office_identity_users
    where user_id=p_actor and status='ACTIVE'
  ) then
    raise exception 'An active Office identity is required';
  end if;
  if (p_key<>'COMMON' and p_key !~ '^ROLE:[A-Z0-9-]{3,80}$')
     or p_version !~ '^[0-9A-Za-z.-]{3,40}$'
     or p_action not in ('OPEN','ACKNOWLEDGE') then
    raise exception 'Invalid manual receipt action';
  end if;
  select status into previous_status
    from public.office_manual_receipts
    where user_id=p_actor and manual_key=p_key and manual_version=p_version
    for update;
  if p_action='ACKNOWLEDGE' and previous_status is null then
    raise exception 'Open the current manual before acknowledging it';
  end if;
  if p_action='ACKNOWLEDGE' then
    insert into public.office_manual_receipts(user_id,manual_key,manual_version,status,acknowledged_at)
    values(p_actor,p_key,p_version,'ACKNOWLEDGED',now())
    on conflict(user_id,manual_key,manual_version) do update
      set status='ACKNOWLEDGED',
          acknowledged_at=coalesce(public.office_manual_receipts.acknowledged_at,now());
    next_status:='ACKNOWLEDGED';
  else
    insert into public.office_manual_receipts(user_id,manual_key,manual_version,status)
    values(p_actor,p_key,p_version,'IN_PROGRESS')
    on conflict(user_id,manual_key,manual_version) do nothing;
    select status into next_status from public.office_manual_receipts
      where user_id=p_actor and manual_key=p_key and manual_version=p_version;
  end if;
  if previous_status is distinct from next_status then
    insert into public.office_manual_receipt_events(actor_user_id,manual_key,manual_version,event_type)
    values(p_actor,p_key,p_version,case when next_status='ACKNOWLEDGED' then 'ACKNOWLEDGED' else 'OPENED' end);
  end if;
  return next_status;
end;
$$;
revoke all on function public.office_manual_record_receipt(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.office_manual_record_receipt(uuid,text,text,text) to service_role;

comment on table public.office_manual_receipts is
  'Versioned employee training acknowledgement, private to user and permitted Office service. Not a signature or legal acceptance.';
