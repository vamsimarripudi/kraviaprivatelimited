-- Employee-scoped Connect settings; no outbound messages or production updates.
create table if not exists public.office_chat_user_preferences (
 user_id uuid primary key references public.office_identity_users(user_id) on delete restrict,
 notify_direct boolean not null default true,
 notify_mentions boolean not null default true,
 notify_ticket_updates boolean not null default true,
 email_digest_opt_in boolean not null default false,
 share_read_receipts boolean not null default false,
 reduce_motion boolean not null default false,
 updated_at timestamptz not null default now()
);
create table if not exists public.office_chat_preference_events (
 id bigint generated always as identity primary key,
 actor_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 previous_preferences jsonb not null,
 current_preferences jsonb not null,
 changed_at timestamptz not null default now()
);
create index if not exists office_chat_pref_events_actor_idx
 on public.office_chat_preference_events(actor_user_id,changed_at desc);
alter table public.office_chat_user_preferences enable row level security;
alter table public.office_chat_preference_events enable row level security;
revoke all on public.office_chat_user_preferences,public.office_chat_preference_events from public,anon,authenticated;
grant select,insert,update on public.office_chat_user_preferences to service_role;
grant select,insert on public.office_chat_preference_events to service_role;
grant usage,select on sequence public.office_chat_preference_events_id_seq to service_role;
create or replace function public.office_chat_update_preferences(
 p_actor uuid,p_notify_direct boolean,p_notify_mentions boolean,p_notify_ticket_updates boolean,
 p_email_digest_opt_in boolean,p_share_read_receipts boolean,p_reduce_motion boolean
) returns boolean language plpgsql security invoker set search_path=public as $$
declare before_values jsonb;after_values jsonb;
begin
 if not exists(select 1 from public.office_identity_users where user_id=p_actor and status='ACTIVE')
 or p_notify_direct is null or p_notify_mentions is null or p_notify_ticket_updates is null
 or p_email_digest_opt_in is null or p_share_read_receipts is null or p_reduce_motion is null
 then raise exception 'Active verified employee and complete Boolean preferences required'; end if;
 select jsonb_build_object('notify_direct',notify_direct,'notify_mentions',notify_mentions,
 'notify_ticket_updates',notify_ticket_updates,'email_digest_opt_in',email_digest_opt_in,
 'share_read_receipts',share_read_receipts,'reduce_motion',reduce_motion)
 into before_values from public.office_chat_user_preferences where user_id=p_actor for update;
 before_values:=coalesce(before_values,jsonb_build_object('notify_direct',true,'notify_mentions',true,
 'notify_ticket_updates',true,'email_digest_opt_in',false,'share_read_receipts',false,'reduce_motion',false));
 after_values:=jsonb_build_object('notify_direct',p_notify_direct,'notify_mentions',p_notify_mentions,
 'notify_ticket_updates',p_notify_ticket_updates,'email_digest_opt_in',p_email_digest_opt_in,
 'share_read_receipts',p_share_read_receipts,'reduce_motion',p_reduce_motion);
 if before_values<>after_values then
  insert into public.office_chat_user_preferences(
   user_id,notify_direct,notify_mentions,notify_ticket_updates,email_digest_opt_in,share_read_receipts,reduce_motion)
  values(p_actor,p_notify_direct,p_notify_mentions,p_notify_ticket_updates,p_email_digest_opt_in,p_share_read_receipts,p_reduce_motion)
  on conflict(user_id) do update
   set notify_direct=excluded.notify_direct,notify_mentions=excluded.notify_mentions,
    notify_ticket_updates=excluded.notify_ticket_updates,email_digest_opt_in=excluded.email_digest_opt_in,
    share_read_receipts=excluded.share_read_receipts,reduce_motion=excluded.reduce_motion,updated_at=now();
  insert into public.office_chat_preference_events(actor_user_id,previous_preferences,current_preferences)
   values(p_actor,before_values,after_values);
 end if;
 return true;
end; $$;
revoke all on function public.office_chat_update_preferences(uuid,boolean,boolean,boolean,boolean,boolean,boolean)
 from public,anon,authenticated;
grant execute on function public.office_chat_update_preferences(uuid,boolean,boolean,boolean,boolean,boolean,boolean) to service_role;
