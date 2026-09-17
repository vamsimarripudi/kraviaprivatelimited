-- KRAVIA Office OS — universal task engine for the Company Inbox.
-- Server-side only. Direct browser access remains deny-by-default.

create sequence if not exists public.office_task_code_seq start with 1 increment by 1;

create table if not exists public.office_tasks (
  id uuid primary key default gen_random_uuid(),
  task_code text not null unique default ('KR-T-' || lpad(nextval('public.office_task_code_seq')::text,6,'0')),
  title text not null check (char_length(title) between 3 and 180),
  description text not null default '' check (char_length(description) <= 4000),
  task_type text not null default 'GENERAL' check (task_type in ('GENERAL','REQUEST','COMPLIANCE','INCIDENT','SALES','ENGINEERING','PEOPLE','FINANCE','LEGAL','OPERATIONS','PRODUCT')),
  priority text not null default 'NORMAL' check (priority in ('LOW','NORMAL','HIGH','URGENT')),
  status text not null default 'OPEN' check (status in ('OPEN','IN_PROGRESS','BLOCKED','DONE','CANCELLED')),
  assigned_user_id uuid not null references auth.users(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  department_code text,
  source_type text,
  source_key text,
  source_request_id uuid references public.office_requests(id) on delete set null,
  due_at timestamptz,
  started_at timestamptz,
  blocked_at timestamptz,
  blocked_reason text,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists office_tasks_assignee_status_due_idx on public.office_tasks(assigned_user_id,status,due_at);
create index if not exists office_tasks_creator_idx on public.office_tasks(created_by,created_at desc);
create index if not exists office_tasks_request_idx on public.office_tasks(source_request_id) where source_request_id is not null;

create table if not exists public.office_task_events (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.office_tasks(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null check (event_type in ('CREATED','STARTED','BLOCKED','COMPLETED','REOPENED','CANCELLED')),
  note text,
  previous_status text,
  new_status text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists office_task_events_task_idx on public.office_task_events(task_id,created_at desc);
create index if not exists office_task_events_actor_idx on public.office_task_events(actor_user_id,created_at desc);

alter table public.office_tasks enable row level security;
alter table public.office_task_events enable row level security;
revoke all on public.office_tasks,public.office_task_events from anon,authenticated,public;
drop policy if exists office_tasks_deny_client_access on public.office_tasks;
create policy office_tasks_deny_client_access on public.office_tasks as restrictive for all to anon,authenticated using(false) with check(false);
drop policy if exists office_task_events_deny_client_access on public.office_task_events;
create policy office_task_events_deny_client_access on public.office_task_events as restrictive for all to anon,authenticated using(false) with check(false);

create or replace function public.office_touch_task() returns trigger
language plpgsql set search_path='' as $$
begin
  new.updated_at:=now();
  return new;
end; $$;
drop trigger if exists office_tasks_touch on public.office_tasks;
create trigger office_tasks_touch before update on public.office_tasks for each row execute function public.office_touch_task();

create or replace function public.office_task_events_immutable() returns trigger
language plpgsql set search_path='' as $$
begin
  raise exception 'KRAVIA Office task events are immutable';
end; $$;
drop trigger if exists office_task_events_immutable_guard on public.office_task_events;
create trigger office_task_events_immutable_guard before update or delete on public.office_task_events for each row execute function public.office_task_events_immutable();

create or replace function public.office_task_actor_can_manage(p_actor uuid,p_assignee uuid,p_creator uuid)
returns boolean
language sql stable security definer set search_path=''
as $$
  select
    p_actor=p_assignee
    or p_actor=p_creator
    or exists(
      select 1 from public.office_user_roles r
      where r.user_id=p_actor and r.role in ('OWNER','DIRECTOR','ADMIN') and (r.expires_at is null or r.expires_at>now())
    )
    or exists(
      select 1 from public.office_job_assignments j
      where j.user_id=p_assignee and j.reports_to_user_id=p_actor and j.status='ACTIVE'
    );
$$;

create or replace function public.office_create_task(
  p_actor uuid,
  p_assignee uuid,
  p_title text,
  p_description text default '',
  p_task_type text default 'GENERAL',
  p_priority text default 'NORMAL',
  p_department text default null,
  p_source_type text default null,
  p_source_key text default null,
  p_source_request uuid default null,
  p_due_at timestamptz default null
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_task uuid; v_can_assign boolean;
begin
  if not exists(select 1 from public.office_identity_users i where i.user_id=p_actor and i.status='ACTIVE') then raise exception 'Actor is not an active Office identity'; end if;
  if not exists(select 1 from public.office_identity_users i where i.user_id=p_assignee and i.status='ACTIVE') then raise exception 'Assignee is not an active Office identity'; end if;

  select (
    p_actor=p_assignee
    or exists(select 1 from public.office_user_roles r where r.user_id=p_actor and r.role in ('OWNER','DIRECTOR','ADMIN') and (r.expires_at is null or r.expires_at>now()))
    or exists(select 1 from public.office_job_assignments j where j.user_id=p_assignee and j.reports_to_user_id=p_actor and j.status='ACTIVE')
  ) into v_can_assign;
  if not v_can_assign then raise exception 'Actor cannot assign work to this user'; end if;

  if char_length(trim(coalesce(p_title,'')))<3 or char_length(trim(p_title))>180 then raise exception 'Invalid task title'; end if;
  if char_length(coalesce(p_description,''))>4000 then raise exception 'Task description is too long'; end if;
  if p_task_type not in ('GENERAL','REQUEST','COMPLIANCE','INCIDENT','SALES','ENGINEERING','PEOPLE','FINANCE','LEGAL','OPERATIONS','PRODUCT') then raise exception 'Invalid task type'; end if;
  if p_priority not in ('LOW','NORMAL','HIGH','URGENT') then raise exception 'Invalid task priority'; end if;

  insert into public.office_tasks(title,description,task_type,priority,assigned_user_id,created_by,department_code,source_type,source_key,source_request_id,due_at)
  values(trim(p_title),coalesce(p_description,''),p_task_type,p_priority,p_assignee,p_actor,nullif(trim(coalesce(p_department,'')),''),nullif(trim(coalesce(p_source_type,'')),''),nullif(trim(coalesce(p_source_key,'')),''),p_source_request,p_due_at)
  returning id into v_task;

  insert into public.office_task_events(task_id,actor_user_id,event_type,new_status,metadata)
  values(v_task,p_actor,'CREATED','OPEN',jsonb_build_object('assignee',p_assignee,'priority',p_priority,'task_type',p_task_type));

  if p_assignee<>p_actor then
    insert into public.office_notifications(user_id,request_id,kind,title,body)
    values(p_assignee,p_source_request,'TASK_ASSIGNED','New task assigned',trim(p_title));
  end if;
  return v_task;
end; $$;

create or replace function public.office_transition_task(
  p_actor uuid,
  p_task uuid,
  p_action text,
  p_note text default null
) returns text
language plpgsql security definer set search_path=''
as $$
declare v public.office_tasks%rowtype; v_new text; v_event text;
begin
  select * into v from public.office_tasks where id=p_task for update;
  if v.id is null then raise exception 'Task not found'; end if;
  if not public.office_task_actor_can_manage(p_actor,v.assigned_user_id,v.created_by) then raise exception 'Actor cannot manage this task'; end if;

  case p_action
    when 'START' then v_new:='IN_PROGRESS'; v_event:='STARTED';
    when 'BLOCK' then v_new:='BLOCKED'; v_event:='BLOCKED';
    when 'COMPLETE' then v_new:='DONE'; v_event:='COMPLETED';
    when 'REOPEN' then v_new:='OPEN'; v_event:='REOPENED';
    when 'CANCEL' then v_new:='CANCELLED'; v_event:='CANCELLED';
    else raise exception 'Invalid task action';
  end case;

  if p_action='BLOCK' and char_length(trim(coalesce(p_note,'')))<3 then raise exception 'Blocking a task requires a reason'; end if;
  if v.status='CANCELLED' and p_action<>'REOPEN' then raise exception 'Cancelled task must be reopened first'; end if;
  if v.status='DONE' and p_action not in ('REOPEN','CANCEL') then raise exception 'Completed task must be reopened first'; end if;

  update public.office_tasks set
    status=v_new,
    started_at=case when p_action='START' then coalesce(started_at,now()) else started_at end,
    blocked_at=case when p_action='BLOCK' then now() when p_action in ('START','REOPEN','COMPLETE') then null else blocked_at end,
    blocked_reason=case when p_action='BLOCK' then trim(p_note) when p_action in ('START','REOPEN','COMPLETE') then null else blocked_reason end,
    completed_at=case when p_action='COMPLETE' then now() when p_action='REOPEN' then null else completed_at end,
    cancelled_at=case when p_action='CANCEL' then now() when p_action='REOPEN' then null else cancelled_at end
  where id=p_task;

  insert into public.office_task_events(task_id,actor_user_id,event_type,note,previous_status,new_status)
  values(p_task,p_actor,v_event,nullif(trim(coalesce(p_note,'')),''),v.status,v_new);

  if v.created_by<>p_actor and p_action in ('COMPLETE','BLOCK') then
    insert into public.office_notifications(user_id,kind,title,body)
    values(v.created_by,case when p_action='COMPLETE' then 'TASK_COMPLETED' else 'TASK_BLOCKED' end,case when p_action='COMPLETE' then 'Task completed' else 'Task blocked' end,v.title);
  end if;
  return v_new;
end; $$;

revoke all on function public.office_task_actor_can_manage(uuid,uuid,uuid) from anon,authenticated,public;
revoke all on function public.office_create_task(uuid,uuid,text,text,text,text,text,text,text,uuid,timestamptz) from anon,authenticated,public;
revoke all on function public.office_transition_task(uuid,uuid,text,text) from anon,authenticated,public;
grant execute on function public.office_task_actor_can_manage(uuid,uuid,uuid) to service_role;
grant execute on function public.office_create_task(uuid,uuid,text,text,text,text,text,text,text,uuid,timestamptz) to service_role;
grant execute on function public.office_transition_task(uuid,uuid,text,text) to service_role;

comment on table public.office_tasks is 'Canonical actionable work queue for KRAVIA Office Company Inbox.';
comment on table public.office_task_events is 'Immutable lifecycle events for Office tasks.';
