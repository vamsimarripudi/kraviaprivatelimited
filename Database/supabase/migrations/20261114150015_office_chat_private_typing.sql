-- KRAVIA Connect 5.0: ephemeral, revocation-aware typing signals.
-- No keyboard content, IP address or device identifier is stored.
-- Requires private change ledger 202611140019; branch-only until approval.
create table if not exists public.office_chat_typing_presence(
 conversation_id uuid not null references public.office_chat_conversations(id) on delete restrict,
 user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 is_typing boolean not null default false,
 last_signal timestamptz not null default now(),
 primary key(conversation_id,user_id),
 foreign key(conversation_id,user_id)
  references public.office_chat_memberships(conversation_id,user_id) on delete restrict
);
create index if not exists office_chat_typing_presence_live_idx
 on public.office_chat_typing_presence(conversation_id,last_signal desc)
 where is_typing=true;

alter table public.office_chat_typing_presence enable row level security;
revoke all on public.office_chat_typing_presence from public,anon,authenticated;
grant select,insert,update on public.office_chat_typing_presence to service_role;

-- Extend the private ledger without exposing typing records to public SQL.
alter table public.office_chat_change_events
 drop constraint if exists office_chat_change_events_event_type_check;
alter table public.office_chat_change_events
 add constraint office_chat_change_events_event_type_check
 check(event_type in ('MESSAGE','MESSAGE_CHANGED','MEMBERSHIP','PIN',
  'REACTION','ATTACHMENT','PRESENCE'));

create or replace function public.office_chat_typing_guard()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if not public.office_chat_current_member(new.user_id,new.conversation_id)
 then raise exception 'Current conversation membership is required for typing'; end if;
 if new.last_signal>now()+interval '10 seconds'
 then raise exception 'Future typing signals are not permitted'; end if;
 return new;
end; $$;
revoke all on function public.office_chat_typing_guard() from public,anon,authenticated;
grant execute on function public.office_chat_typing_guard() to service_role;
drop trigger if exists office_chat_typing_current_member on public.office_chat_typing_presence;
create trigger office_chat_typing_current_member before insert or update
 on public.office_chat_typing_presence for each row
 execute function public.office_chat_typing_guard();

create or replace function public.office_chat_typing_notify()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
 insert into public.office_chat_change_events(conversation_id,event_type)
 values(new.conversation_id,'PRESENCE');
 return new;
end; $$;
revoke all on function public.office_chat_typing_notify() from public,anon,authenticated;
grant execute on function public.office_chat_typing_notify() to service_role;
drop trigger if exists office_chat_typing_live_signal on public.office_chat_typing_presence;
create trigger office_chat_typing_live_signal after insert or update of is_typing,last_signal
 on public.office_chat_typing_presence for each row
 execute function public.office_chat_typing_notify();

comment on table public.office_chat_typing_presence is
 'Transient typing only, no text. Consumers ignore rows older than 10 seconds and continuously recheck current membership.';
