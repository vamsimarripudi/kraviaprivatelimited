-- KRAVIA Office unified notification delivery — additive schema, no destructive rewrites.
alter table public.office_notifications
  add column if not exists event_key text,
  add column if not exists source_kind text,
  add column if not exists source_id uuid,
  add column if not exists target_path text,
  add column if not exists priority text not null default 'NORMAL';
create unique index if not exists office_notification_event_key_uniq
  on public.office_notifications(user_id,event_key);
create index if not exists office_notification_delivery_index
  on public.office_notifications(user_id,created_at desc) where status='UNREAD';

create table if not exists public.office_notification_preferences(
  user_id uuid primary key references public.office_identity_users(user_id) on delete cascade,
  sound_enabled boolean not null default false,
  volume numeric(3,2) not null default 0.45 check(volume>=0 and volume<=1),
  quiet_enabled boolean not null default false,
  quiet_start time not null default '22:00',
  quiet_end time not null default '07:00',
  browser_enabled boolean not null default false,
  categories jsonb not null default '{"chat":true,"support":true,"department":true,"approval":true,"hr":true,"finance":true,"vault":true,"system":true}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.office_notification_preferences enable row level security;
revoke all on public.office_notification_preferences from public,anon,authenticated;
grant select,insert,update,delete on public.office_notification_preferences to service_role;

-- Independent business source notifications where canonical mutations are not
-- routed through the Office work/chat/support handlers. This trigger uses the
-- writer's existing database authority and never elevates user permissions.
create or replace function public.office_auxiliary_notification_event()
returns trigger language plpgsql set search_path='' as $trigger$
declare row_data jsonb; old_data jsonb; source_id uuid; event_key text;
  recipient uuid; reviewer uuid; requester uuid; kind text; path text;
  title text; status text; changed boolean;
begin
  row_data:=to_jsonb(new);
  old_data:=case when TG_OP='UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  status:=coalesce(row_data->>'status','');
  changed:=TG_OP='INSERT' or status is distinct from coalesce(old_data->>'status','');
  if not changed then return new; end if;
  source_id:=nullif(row_data->>'id','')::uuid;
  if source_id is null then return new; end if;

  if TG_TABLE_NAME='office_department_transfer_requests' then
    kind:='DEPARTMENT_TRANSFER';path:='/office/my-transfers';title:='Department transfer update';
    requester:=nullif(row_data->>'from_owner_user_id','')::uuid;
    reviewer:=nullif(row_data->>'to_owner_user_id','')::uuid;
  elsif TG_TABLE_NAME='office_vault_access_requests' then
    kind:='VAULT_REQUEST';path:='/office/k-vault/requests';title:='Vault access request';
    requester:=nullif(row_data->>'requester_user_id','')::uuid;
    reviewer:=nullif(row_data->>'reviewer_user_id','')::uuid;
  elsif TG_TABLE_NAME='office_hr_leave_requests' or TG_TABLE_NAME='office_flex_day_requests' then
    kind:='HR_WORKFLOW';path:='/office/worktime';title:='Leave or attendance request';
    requester:=nullif(row_data->>'employee_user_id','')::uuid;
    reviewer:=nullif(row_data->>'reviewed_by','')::uuid;
  else
    kind:='FINANCE_WORKFLOW';path:='/office/requests';title:='Finance request update';
    requester:=nullif(row_data->>'requester_user_id','')::uuid;
    reviewer:=nullif(coalesce(row_data->>'owner_user_id',row_data->>'reviewer_user_id'),'')::uuid;
  end if;
  event_key:='src:'||TG_TABLE_NAME||':'||source_id::text||':'||status||':'||txid_current()::text;

  for recipient in
    select distinct i.user_id from public.office_identity_users i
    where i.status='ACTIVE'
      and ((i.user_id=reviewer and i.user_id is distinct from nullif(row_data->>'requested_by','')::uuid)
         or (TG_OP='UPDATE' and i.user_id=requester))
  loop
    insert into public.office_notifications(user_id,event_key,kind,source_kind,source_id,
      target_path,title,body,priority,status)
    values(recipient,event_key,kind,kind,source_id,path,title,
      'An assigned company record has changed. Open Office to review.',
      case when kind='VAULT_REQUEST' then 'HIGH' else 'NORMAL' end,'UNREAD')
    on conflict (user_id,event_key) do nothing;
  end loop;
  return new;
exception when others then
  raise log 'KRAVIA auxiliary notification trigger failed for %',TG_TABLE_NAME;
  return new; -- A notification failure must never reverse a company transaction.
end; $trigger$;
revoke all on function public.office_auxiliary_notification_event() from public,anon,authenticated;
grant execute on function public.office_auxiliary_notification_event() to service_role;

do $do$
declare target_table text;
begin
  foreach target_table in array array[
    'office_department_transfer_requests','office_vault_access_requests',
    'office_hr_leave_requests','office_flex_day_requests',
    'office_card_spend_requests','office_procurement_requests'
  ] loop
    execute format('drop trigger if exists office_auxiliary_notification_trigger on public.%I',target_table);
    execute format('create trigger office_auxiliary_notification_trigger after insert or update
      on public.%I for each row execute function public.office_auxiliary_notification_event()',target_table);
  end loop;
end $do$;
