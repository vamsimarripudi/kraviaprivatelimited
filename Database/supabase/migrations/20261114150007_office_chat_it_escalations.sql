-- KRAVIA Connect: scoped, auditable escalations linked to canonical IT tickets.
-- No competing support case, no payment/access approval, no emails.
create table if not exists public.office_chat_it_escalations(
 id uuid primary key default gen_random_uuid(),
 ticket_id uuid not null references public.office_it_service_tickets(id) on delete restrict,
 level integer not null check(level between 2 and 4),
 recipient_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 request_nonce uuid not null unique,
 reason text not null check(length(trim(reason)) between 12 and 1000),
 source_due_at timestamptz,
 status text not null default 'PENDING' check(status in ('PENDING','ACKNOWLEDGED','ESCALATED','RESOLVED')),
 acknowledged_at timestamptz,
 resolved_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index if not exists office_chat_it_active_escalation_idx
 on public.office_chat_it_escalations(ticket_id) where status in ('PENDING','ACKNOWLEDGED');
create index if not exists office_chat_it_escalation_recipient_idx
 on public.office_chat_it_escalations(recipient_user_id,status,created_at desc);

create table if not exists public.office_chat_it_escalation_events(
 id bigint generated always as identity primary key,
 escalation_id uuid not null references public.office_chat_it_escalations(id) on delete restrict,
 actor_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 event_type text not null check(event_type in ('CREATED','ACKNOWLEDGED','ESCALATED','RESOLVED')),
 note text,
 occurred_at timestamptz not null default now()
);
create index if not exists office_chat_it_escalation_events_idx
 on public.office_chat_it_escalation_events(escalation_id,occurred_at);

alter table public.office_chat_it_escalations enable row level security;
alter table public.office_chat_it_escalation_events enable row level security;
revoke all on public.office_chat_it_escalations,public.office_chat_it_escalation_events from public,anon,authenticated;
grant select,insert,update on public.office_chat_it_escalations to service_role;
grant select,insert on public.office_chat_it_escalation_events to service_role;
grant usage,select on sequence public.office_chat_it_escalation_events_id_seq to service_role;

create or replace function public.office_chat_escalate_it(
 p_actor uuid,p_ticket uuid,p_recipient uuid,p_level integer,p_reason text,p_nonce uuid
) returns uuid language plpgsql security invoker set search_path=public as $$
declare t public.office_it_service_tickets%rowtype;
 current_escalation public.office_chat_it_escalations%rowtype;previous_level integer;v_id uuid;
begin
 if p_actor is null or p_ticket is null or p_recipient is null or p_nonce is null
 or p_actor=p_recipient or p_level not between 2 and 4
 or length(trim(coalesce(p_reason,''))) not between 12 and 1000 then
  raise exception 'Invalid escalation submission'; end if;
 -- Preserve idempotency on HTTP retries after unknown provider outcomes.
 select id into v_id from public.office_chat_it_escalations
 where request_nonce=p_nonce and ticket_id=p_ticket and created_by=p_actor;
 if v_id is not null then return v_id; end if;
 if not public.office_effective_permission(p_actor,'it.service.manage','COMPANY',null,null)
 or not exists(select 1 from public.office_identity_users where user_id=p_actor and status='ACTIVE')
 or not exists(select 1 from public.office_identity_users where user_id=p_recipient and status='ACTIVE')
 or not (
   public.office_effective_permission(p_recipient,'it.service.read','COMPANY',null,null)
   or public.office_effective_permission(p_recipient,'it.service.manage','COMPANY',null,null)
 ) then raise exception 'Independent source-ticket authority is required'; end if;
 select * into t from public.office_it_service_tickets where id=p_ticket for update;
 if t.id is null or t.status in ('RESOLVED','CLOSED','CANCELLED') then
  raise exception 'An open canonical IT ticket is required'; end if;
 select * into current_escalation from public.office_chat_it_escalations
 where ticket_id=p_ticket and status in ('PENDING','ACKNOWLEDGED')
 order by level desc limit 1 for update;
 previous_level:=coalesce(current_escalation.level,1);
 if p_level<>previous_level+1 or p_level>4 then
  raise exception 'Escalation levels must advance one authorized step'; end if;
 if current_escalation.id is not null then
  update public.office_chat_it_escalations set status='ESCALATED',updated_at=now()
   where id=current_escalation.id;
  insert into public.office_chat_it_escalation_events(escalation_id,actor_user_id,event_type,note)
  values(current_escalation.id,p_actor,'ESCALATED','Superseded by next scoped escalation level');
 end if;
 insert into public.office_chat_it_escalations(
  ticket_id,level,recipient_user_id,created_by,request_nonce,reason,source_due_at
 ) values(p_ticket,p_level,p_recipient,p_actor,p_nonce,trim(p_reason),t.due_at)
 returning id into v_id;
 insert into public.office_chat_it_escalation_events(escalation_id,actor_user_id,event_type,note)
 values(v_id,p_actor,'CREATED','Linked to canonical IT ticket; source ticket remains authoritative');
 return v_id;
end; $$;

create or replace function public.office_chat_ack_it_escalation(
 p_actor uuid,p_escalation uuid,p_note text
) returns boolean language plpgsql security invoker set search_path=public as $$
declare e public.office_chat_it_escalations%rowtype;
begin
 select * into e from public.office_chat_it_escalations where id=p_escalation for update;
 if e.id is null or e.status<>'PENDING' or e.recipient_user_id<>p_actor
 or not exists(select 1 from public.office_identity_users where user_id=p_actor and status='ACTIVE')
 or not (
 public.office_effective_permission(p_actor,'it.service.read','COMPANY',null,null) or
 public.office_effective_permission(p_actor,'it.service.manage','COMPANY',null,null)
 ) then raise exception 'Only the current authorized escalation recipient may acknowledge'; end if;
 update public.office_chat_it_escalations
 set status='ACKNOWLEDGED',acknowledged_at=now(),updated_at=now() where id=e.id;
 insert into public.office_chat_it_escalation_events(escalation_id,actor_user_id,event_type,note)
 values(e.id,p_actor,'ACKNOWLEDGED',nullif(trim(coalesce(p_note,'')),''));
 return true;
end; $$;

create or replace function public.office_chat_resolve_it_escalation(
 p_actor uuid,p_escalation uuid,p_note text
) returns boolean language plpgsql security invoker set search_path=public as $$
declare e public.office_chat_it_escalations%rowtype;
begin
 select * into e from public.office_chat_it_escalations where id=p_escalation for update;
 if e.id is null or e.status not in ('PENDING','ACKNOWLEDGED')
 or not public.office_effective_permission(p_actor,'it.service.manage','COMPANY',null,null)
 or length(trim(coalesce(p_note,'')))<10 then raise exception 'Qualified independent resolution and rationale required'; end if;
 update public.office_chat_it_escalations
 set status='RESOLVED',resolved_at=now(),updated_at=now() where id=e.id;
 insert into public.office_chat_it_escalation_events(escalation_id,actor_user_id,event_type,note)
 values(e.id,p_actor,'RESOLVED',trim(p_note));
 -- This never resolves the canonical source ticket.
 return true;
end; $$;

revoke all on function public.office_chat_escalate_it(uuid,uuid,uuid,integer,text,uuid) from public,anon,authenticated;
revoke all on function public.office_chat_ack_it_escalation(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.office_chat_resolve_it_escalation(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.office_chat_escalate_it(uuid,uuid,uuid,integer,text,uuid) to service_role;
grant execute on function public.office_chat_ack_it_escalation(uuid,uuid,text) to service_role;
grant execute on function public.office_chat_resolve_it_escalation(uuid,uuid,text) to service_role;
