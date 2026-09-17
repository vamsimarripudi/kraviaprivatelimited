-- Company-secretarial and board operating workflow.
-- This is an operational control system, not a statutory-deadline calculator.
-- Quorum, notice periods, filing due dates and legal applicability are recorded
-- from authorised human/professional determinations and source references.

insert into public.office_permission_catalog(
  code,module,action,label,description,sensitivity,high_risk,requires_managed_device,active
) values
  ('secretarial.board.read','SECRETARIAL','READ_BOARD','Read board workspace','Read governed board meetings, agendas, minutes metadata, resolutions and follow-up records.','HIGH',false,false,true),
  ('secretarial.board.manage','SECRETARIAL','MANAGE_BOARD','Manage board process','Schedule meetings, participants, attendance and controlled state transitions.','HIGH',true,true,true),
  ('secretarial.agenda.manage','SECRETARIAL','MANAGE_AGENDA','Manage meeting agenda','Prepare agenda items before the agenda is locked.','HIGH',false,false,true),
  ('secretarial.minutes.prepare','SECRETARIAL','PREPARE_MINUTES','Prepare minutes','Prepare versioned draft minutes for independent board/chair review.','HIGH',true,true,true),
  ('secretarial.minutes.lock','SECRETARIAL','LOCK_MINUTES','Lock approved minutes','Lock independently approved minutes and record an integrity hash.','CRITICAL',true,true,true),
  ('secretarial.resolution.record','SECRETARIAL','RECORD_RESOLUTION','Record resolutions','Record immutable resolution text from a decided agenda item.','CRITICAL',true,true,true),
  ('secretarial.filing.manage','SECRETARIAL','MANAGE_FOLLOWUP','Manage statutory follow-up','Track professional/statutory follow-up, due basis, filing evidence and acknowledgement.','HIGH',true,true,true)
on conflict(code) do update set
  module=excluded.module,action=excluded.action,label=excluded.label,description=excluded.description,
  sensitivity=excluded.sensitivity,high_risk=excluded.high_risk,
  requires_managed_device=excluded.requires_managed_device,active=true;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type) values
  ('CS_SECRETARIAL','secretarial.board.read','ALLOW','COMPANY'),
  ('CS_SECRETARIAL','secretarial.board.manage','ALLOW','COMPANY'),
  ('CS_SECRETARIAL','secretarial.agenda.manage','ALLOW','COMPANY'),
  ('CS_SECRETARIAL','secretarial.minutes.prepare','ALLOW','COMPANY'),
  ('CS_SECRETARIAL','secretarial.minutes.lock','ALLOW','COMPANY'),
  ('CS_SECRETARIAL','secretarial.resolution.record','ALLOW','COMPANY'),
  ('CS_SECRETARIAL','secretarial.filing.manage','ALLOW','COMPANY'),
  ('LEGAL_COUNSEL','secretarial.board.read','ALLOW','COMPANY'),
  ('AUDITOR_READONLY','secretarial.board.read','ALLOW','COMPANY')
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

create sequence if not exists public.office_board_meeting_seq;
create sequence if not exists public.office_board_resolution_seq;
create sequence if not exists public.office_board_action_seq;
create sequence if not exists public.office_secretarial_followup_seq;
grant usage on sequence public.office_board_meeting_seq,public.office_board_resolution_seq,public.office_board_action_seq,public.office_secretarial_followup_seq to service_role;

create table if not exists public.office_board_meetings (
  id uuid primary key default gen_random_uuid(),
  meeting_code text not null unique default ('KR-BM-' || lpad(nextval('public.office_board_meeting_seq')::text,6,'0')),
  meeting_kind text not null default 'BOARD' check (meeting_kind in ('BOARD','COMMITTEE','AGM','EGM','OTHER')),
  title text not null check (char_length(trim(title)) between 3 and 220),
  scheduled_start timestamptz not null,
  scheduled_end timestamptz,
  timezone text not null default 'Asia/Kolkata',
  venue_mode text not null default 'VIDEO' check (venue_mode in ('PHYSICAL','VIDEO','HYBRID')),
  venue_details text,
  meeting_reference text,
  status text not null default 'DRAFT' check (status in ('DRAFT','NOTICE_ISSUED','AGENDA_LOCKED','IN_PROGRESS','ADJOURNED','COMPLETED','MINUTES_DRAFTED','MINUTES_LOCKED','CANCELLED')),
  chair_user_id uuid references public.office_identity_users(user_id) on delete restrict,
  chair_name text,
  secretary_user_id uuid references public.office_identity_users(user_id) on delete restrict,
  notice_reference text,
  notice_issued_at timestamptz,
  agenda_locked_at timestamptz,
  quorum_confirmed boolean,
  quorum_note text,
  started_at timestamptz,
  completed_at timestamptz,
  minutes_locked_at timestamptz,
  created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
  updated_by uuid not null references public.office_identity_users(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scheduled_end is null or scheduled_end>scheduled_start),
  check (chair_user_id is not null or char_length(trim(coalesce(chair_name,'')))>=2)
);
create index if not exists office_board_meetings_start_idx on public.office_board_meetings(scheduled_start,status);

create table if not exists public.office_board_participants (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.office_board_meetings(id) on delete cascade,
  participant_user_id uuid references public.office_identity_users(user_id) on delete restrict,
  participant_name text not null check (char_length(trim(participant_name)) between 2 and 180),
  capacity text not null check (capacity in ('CHAIR','DIRECTOR','CS','SHAREHOLDER','INVITEE','AUDITOR','LEGAL','OTHER')),
  invitation_status text not null default 'INVITED' check (invitation_status in ('INVITED','ACKNOWLEDGED','DECLINED')),
  attendance_status text not null default 'PENDING' check (attendance_status in ('PENDING','PRESENT','ABSENT','LEAVE_OF_ABSENCE')),
  attendance_note text,
  conflict_note text,
  acknowledged_at timestamptz,
  attendance_recorded_at timestamptz,
  attendance_recorded_by uuid references public.office_identity_users(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(meeting_id,participant_name)
);
create index if not exists office_board_participants_meeting_idx on public.office_board_participants(meeting_id,capacity);

create table if not exists public.office_board_agenda_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.office_board_meetings(id) on delete cascade,
  item_no integer not null check(item_no>0),
  title text not null check(char_length(trim(title)) between 3 and 220),
  purpose text not null default 'DISCUSSION' check(purpose in ('INFORMATION','DISCUSSION','DECISION','RESOLUTION')),
  background_note text,
  proposed_resolution_text text,
  owner_user_id uuid references public.office_identity_users(user_id) on delete restrict,
  presenter_name text,
  status text not null default 'DRAFT' check(status in ('DRAFT','LOCKED','NOTED','DECIDED','DEFERRED','WITHDRAWN')),
  decision_note text,
  locked_at timestamptz,
  decided_at timestamptz,
  created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(meeting_id,item_no)
);
create index if not exists office_board_agenda_meeting_idx on public.office_board_agenda_items(meeting_id,item_no);

create table if not exists public.office_board_minutes_versions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.office_board_meetings(id) on delete restrict,
  version_no integer not null check(version_no>0),
  body text not null check(char_length(trim(body))>=20),
  status text not null default 'DRAFT' check(status in ('DRAFT','CHAIR_REVIEW','APPROVED','LOCKED','SUPERSEDED')),
  prepared_by uuid not null references public.office_identity_users(user_id) on delete restrict,
  review_submitted_at timestamptz,
  approved_by uuid references public.office_identity_users(user_id) on delete restrict,
  approved_at timestamptz,
  approval_note text,
  locked_by uuid references public.office_identity_users(user_id) on delete restrict,
  locked_at timestamptz,
  content_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(meeting_id,version_no),
  check(content_hash is null or char_length(content_hash)=64)
);
create unique index if not exists office_board_minutes_one_locked_idx on public.office_board_minutes_versions(meeting_id) where status='LOCKED';

create or replace function public.office_protect_locked_board_minutes()
returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' then
    if old.status='LOCKED' then raise exception 'Locked minutes cannot be deleted'; end if;
    return old;
  end if;
  if old.status='LOCKED' then raise exception 'Locked minutes cannot be altered'; end if;
  return new;
end;
$$;
drop trigger if exists office_protect_locked_board_minutes on public.office_board_minutes_versions;
create trigger office_protect_locked_board_minutes before update or delete on public.office_board_minutes_versions for each row execute function public.office_protect_locked_board_minutes();

create table if not exists public.office_board_minute_amendments (
  id uuid primary key default gen_random_uuid(),
  locked_minutes_id uuid not null references public.office_board_minutes_versions(id) on delete restrict,
  amendment_text text not null check(char_length(trim(amendment_text))>=5),
  reason text not null check(char_length(trim(reason))>=5),
  approved_by uuid not null references public.office_identity_users(user_id) on delete restrict,
  recorded_by uuid not null references public.office_identity_users(user_id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.office_board_resolutions (
  id uuid primary key default gen_random_uuid(),
  resolution_code text not null unique default ('KR-RES-' || lpad(nextval('public.office_board_resolution_seq')::text,6,'0')),
  meeting_id uuid not null references public.office_board_meetings(id) on delete restrict,
  agenda_item_id uuid not null references public.office_board_agenda_items(id) on delete restrict,
  resolution_type text not null default 'BOARD' check(resolution_type in ('BOARD','ORDINARY','SPECIAL','CIRCULAR','OTHER')),
  title text not null check(char_length(trim(title)) between 3 and 220),
  resolution_text text not null check(char_length(trim(resolution_text))>=10),
  approval_basis text not null check(char_length(trim(approval_basis))>=3),
  approved_by_name text,
  recorded_by uuid not null references public.office_identity_users(user_id) on delete restrict,
  recorded_at timestamptz not null default now(),
  content_hash text not null check(char_length(content_hash)=64),
  source_reference text,
  status text not null default 'RECORDED' check(status in ('RECORDED','SUPERSEDED')),
  unique(meeting_id,agenda_item_id)
);

create table if not exists public.office_board_resolution_amendments (
  id uuid primary key default gen_random_uuid(),
  resolution_id uuid not null references public.office_board_resolutions(id) on delete restrict,
  amendment_text text not null check(char_length(trim(amendment_text))>=5),
  reason text not null check(char_length(trim(reason))>=5),
  approval_reference text not null,
  recorded_by uuid not null references public.office_identity_users(user_id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.office_board_actions (
  id uuid primary key default gen_random_uuid(),
  action_code text not null unique default ('KR-BA-' || lpad(nextval('public.office_board_action_seq')::text,6,'0')),
  meeting_id uuid not null references public.office_board_meetings(id) on delete restrict,
  agenda_item_id uuid references public.office_board_agenda_items(id) on delete restrict,
  resolution_id uuid references public.office_board_resolutions(id) on delete restrict,
  title text not null check(char_length(trim(title)) between 3 and 220),
  description text,
  owner_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
  due_at timestamptz,
  status text not null default 'OPEN' check(status in ('OPEN','IN_PROGRESS','BLOCKED','DONE','CANCELLED')),
  blocker_note text,
  completion_note text,
  completed_at timestamptz,
  created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists office_board_actions_owner_idx on public.office_board_actions(owner_user_id,status,due_at);

create table if not exists public.office_secretarial_followups (
  id uuid primary key default gen_random_uuid(),
  followup_code text not null unique default ('KR-SF-' || lpad(nextval('public.office_secretarial_followup_seq')::text,6,'0')),
  meeting_id uuid references public.office_board_meetings(id) on delete restrict,
  resolution_id uuid references public.office_board_resolutions(id) on delete restrict,
  title text not null check(char_length(trim(title)) between 3 and 220),
  authority text not null,
  form_code text,
  due_at timestamptz,
  due_basis text not null check(char_length(trim(due_basis))>=3),
  source_reference text not null check(char_length(trim(source_reference))>=3),
  owner_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
  reviewer_user_id uuid references public.office_identity_users(user_id) on delete restrict,
  status text not null default 'OPEN' check(status in ('OPEN','PREPARED','APPROVED','FILED','ACKNOWLEDGED','NOT_REQUIRED','CLOSED')),
  filing_reference text,
  evidence_reference text,
  filed_at timestamptz,
  acknowledged_at timestamptz,
  closed_at timestamptz,
  created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists office_secretarial_followups_due_idx on public.office_secretarial_followups(status,due_at);

create table if not exists public.office_board_events (
  id bigint generated always as identity primary key,
  meeting_id uuid not null references public.office_board_meetings(id) on delete cascade,
  actor_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  previous_status text,
  new_status text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists office_board_events_meeting_idx on public.office_board_events(meeting_id,created_at desc);

alter table public.office_board_meetings enable row level security;
alter table public.office_board_participants enable row level security;
alter table public.office_board_agenda_items enable row level security;
alter table public.office_board_minutes_versions enable row level security;
alter table public.office_board_minute_amendments enable row level security;
alter table public.office_board_resolutions enable row level security;
alter table public.office_board_resolution_amendments enable row level security;
alter table public.office_board_actions enable row level security;
alter table public.office_secretarial_followups enable row level security;
alter table public.office_board_events enable row level security;

revoke all on public.office_board_meetings,public.office_board_participants,public.office_board_agenda_items,public.office_board_minutes_versions,public.office_board_minute_amendments,public.office_board_resolutions,public.office_board_resolution_amendments,public.office_board_actions,public.office_secretarial_followups,public.office_board_events from anon,authenticated;
grant select,insert,update on public.office_board_meetings,public.office_board_participants,public.office_board_agenda_items,public.office_board_minutes_versions,public.office_board_actions,public.office_secretarial_followups to service_role;
grant select,insert on public.office_board_minute_amendments,public.office_board_resolutions,public.office_board_resolution_amendments,public.office_board_events to service_role;

create or replace function public.office_board_has_permission(p_actor uuid,p_permission text)
returns boolean language sql stable security definer set search_path='' as $$
  select public.office_effective_permission(p_actor,p_permission,'COMPANY',null,null)
$$;

create or replace function public.office_board_is_director(p_actor uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.office_identity_users i join public.office_user_roles r on r.user_id=i.user_id
    where i.user_id=p_actor and i.status='ACTIVE' and r.role in ('OWNER','DIRECTOR') and (r.expires_at is null or r.expires_at>now())
  )
$$;

create or replace function public.office_board_create_meeting(
  p_actor uuid,p_kind text,p_title text,p_start timestamptz,p_end timestamptz,p_timezone text,
  p_venue_mode text,p_venue_details text,p_chair_user uuid,p_chair_name text,p_secretary_user uuid
)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if not public.office_board_has_permission(p_actor,'secretarial.board.manage') then raise exception 'Board management permission is required'; end if;
  if p_start<=now()-interval '1 day' then raise exception 'Meeting start is outside the supported scheduling window'; end if;
  insert into public.office_board_meetings(meeting_kind,title,scheduled_start,scheduled_end,timezone,venue_mode,venue_details,chair_user_id,chair_name,secretary_user_id,created_by,updated_by)
  values(upper(trim(p_kind)),trim(p_title),p_start,p_end,coalesce(nullif(trim(p_timezone),''),'Asia/Kolkata'),upper(trim(p_venue_mode)),nullif(trim(coalesce(p_venue_details,'')),''),p_chair_user,nullif(trim(coalesce(p_chair_name,'')),''),p_secretary_user,p_actor,p_actor)
  returning id into v_id;
  insert into public.office_board_events(meeting_id,actor_user_id,event_type,entity_type,entity_id,new_status)
  values(v_id,p_actor,'MEETING_CREATED','MEETING',v_id,'DRAFT');
  return v_id;
end; $$;

create or replace function public.office_board_add_participant(
  p_actor uuid,p_meeting uuid,p_user uuid,p_name text,p_capacity text
)
returns uuid language plpgsql security definer set search_path='' as $$
declare m public.office_board_meetings%rowtype; v_id uuid;
begin
  if not public.office_board_has_permission(p_actor,'secretarial.board.manage') then raise exception 'Board management permission is required'; end if;
  select * into m from public.office_board_meetings where id=p_meeting for update;
  if m.id is null then raise exception 'Meeting not found'; end if;
  if m.status not in ('DRAFT','NOTICE_ISSUED') then raise exception 'Participant list is locked for this meeting state'; end if;
  insert into public.office_board_participants(meeting_id,participant_user_id,participant_name,capacity)
  values(p_meeting,p_user,trim(p_name),upper(trim(p_capacity))) returning id into v_id;
  insert into public.office_board_events(meeting_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_meeting,p_actor,'PARTICIPANT_ADDED','PARTICIPANT',v_id,jsonb_build_object('name',trim(p_name),'capacity',upper(trim(p_capacity))));
  return v_id;
end; $$;

create or replace function public.office_board_add_agenda_item(
  p_actor uuid,p_meeting uuid,p_title text,p_purpose text,p_background text,p_proposed_resolution text,p_owner uuid,p_presenter text
)
returns uuid language plpgsql security definer set search_path='' as $$
declare m public.office_board_meetings%rowtype; v_id uuid; v_item integer;
begin
  if not public.office_board_has_permission(p_actor,'secretarial.agenda.manage') then raise exception 'Agenda management permission is required'; end if;
  select * into m from public.office_board_meetings where id=p_meeting for update;
  if m.id is null then raise exception 'Meeting not found'; end if;
  if m.status not in ('DRAFT','NOTICE_ISSUED') then raise exception 'Agenda is no longer editable'; end if;
  select coalesce(max(item_no),0)+1 into v_item from public.office_board_agenda_items where meeting_id=p_meeting;
  insert into public.office_board_agenda_items(meeting_id,item_no,title,purpose,background_note,proposed_resolution_text,owner_user_id,presenter_name,created_by)
  values(p_meeting,v_item,trim(p_title),upper(trim(p_purpose)),nullif(trim(coalesce(p_background,'')),''),nullif(trim(coalesce(p_proposed_resolution,'')),''),p_owner,nullif(trim(coalesce(p_presenter,'')),''),p_actor)
  returning id into v_id;
  insert into public.office_board_events(meeting_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_meeting,p_actor,'AGENDA_ITEM_ADDED','AGENDA_ITEM',v_id,jsonb_build_object('item_no',v_item));
  return v_id;
end; $$;

create or replace function public.office_board_issue_notice(p_actor uuid,p_meeting uuid,p_notice_reference text)
returns text language plpgsql security definer set search_path='' as $$
declare m public.office_board_meetings%rowtype;
begin
  if not public.office_board_has_permission(p_actor,'secretarial.board.manage') then raise exception 'Board management permission is required'; end if;
  select * into m from public.office_board_meetings where id=p_meeting for update;
  if m.id is null or m.status<>'DRAFT' then raise exception 'Meeting is not ready for notice issuance'; end if;
  if char_length(trim(coalesce(p_notice_reference,'')))<3 then raise exception 'Notice evidence/reference is required'; end if;
  update public.office_board_meetings set status='NOTICE_ISSUED',notice_reference=trim(p_notice_reference),notice_issued_at=now(),updated_by=p_actor,updated_at=now() where id=p_meeting;
  insert into public.office_board_events(meeting_id,actor_user_id,event_type,entity_type,entity_id,previous_status,new_status,metadata)
  values(p_meeting,p_actor,'NOTICE_ISSUED','MEETING',p_meeting,m.status,'NOTICE_ISSUED',jsonb_build_object('notice_reference',trim(p_notice_reference)));
  return 'NOTICE_ISSUED';
end; $$;

create or replace function public.office_board_lock_agenda(p_actor uuid,p_meeting uuid)
returns text language plpgsql security definer set search_path='' as $$
declare m public.office_board_meetings%rowtype; v_count integer;
begin
  if not public.office_board_has_permission(p_actor,'secretarial.agenda.manage') then raise exception 'Agenda management permission is required'; end if;
  select * into m from public.office_board_meetings where id=p_meeting for update;
  if m.id is null or m.status<>'NOTICE_ISSUED' then raise exception 'Notice must be issued before agenda lock'; end if;
  select count(*) into v_count from public.office_board_agenda_items where meeting_id=p_meeting and status='DRAFT';
  if v_count=0 then raise exception 'At least one agenda item is required'; end if;
  update public.office_board_agenda_items set status='LOCKED',locked_at=now(),updated_at=now() where meeting_id=p_meeting and status='DRAFT';
  update public.office_board_meetings set status='AGENDA_LOCKED',agenda_locked_at=now(),updated_by=p_actor,updated_at=now() where id=p_meeting;
  insert into public.office_board_events(meeting_id,actor_user_id,event_type,entity_type,entity_id,previous_status,new_status,metadata)
  values(p_meeting,p_actor,'AGENDA_LOCKED','MEETING',p_meeting,m.status,'AGENDA_LOCKED',jsonb_build_object('items',v_count));
  return 'AGENDA_LOCKED';
end; $$;

create or replace function public.office_board_record_attendance(
  p_actor uuid,p_participant uuid,p_status text,p_note text default null,p_conflict text default null
)
returns text language plpgsql security definer set search_path='' as $$
declare p public.office_board_participants%rowtype; m public.office_board_meetings%rowtype; v_status text:=upper(trim(p_status));
begin
  if not public.office_board_has_permission(p_actor,'secretarial.board.manage') then raise exception 'Board management permission is required'; end if;
  select * into p from public.office_board_participants where id=p_participant for update;
  if p.id is null then raise exception 'Participant not found'; end if;
  select * into m from public.office_board_meetings where id=p.meeting_id;
  if m.status not in ('AGENDA_LOCKED','IN_PROGRESS','ADJOURNED') then raise exception 'Attendance cannot be recorded in this meeting state'; end if;
  if v_status not in ('PRESENT','ABSENT','LEAVE_OF_ABSENCE') then raise exception 'Invalid attendance status'; end if;
  update public.office_board_participants set attendance_status=v_status,attendance_note=nullif(trim(coalesce(p_note,'')),''),conflict_note=nullif(trim(coalesce(p_conflict,'')),''),attendance_recorded_at=now(),attendance_recorded_by=p_actor where id=p_participant;
  insert into public.office_board_events(meeting_id,actor_user_id,event_type,entity_type,entity_id,new_status,note)
  values(p.meeting_id,p_actor,'ATTENDANCE_RECORDED','PARTICIPANT',p_participant,v_status,left(trim(coalesce(p_note,'')),1000));
  return v_status;
end; $$;

create or replace function public.office_board_start_meeting(p_actor uuid,p_meeting uuid,p_quorum_confirmed boolean,p_quorum_note text)
returns text language plpgsql security definer set search_path='' as $$
declare m public.office_board_meetings%rowtype; v_present integer;
begin
  if not public.office_board_has_permission(p_actor,'secretarial.board.manage') and not public.office_board_is_director(p_actor) then raise exception 'Board authority is required'; end if;
  select * into m from public.office_board_meetings where id=p_meeting for update;
  if m.id is null or m.status not in ('AGENDA_LOCKED','ADJOURNED') then raise exception 'Meeting is not ready to start'; end if;
  select count(*) into v_present from public.office_board_participants where meeting_id=p_meeting and attendance_status='PRESENT';
  if v_present=0 then raise exception 'Record attendance before starting the meeting'; end if;
  if p_quorum_confirmed is not true or char_length(trim(coalesce(p_quorum_note,'')))<3 then raise exception 'Authorised human quorum confirmation and basis are required'; end if;
  update public.office_board_meetings set status='IN_PROGRESS',quorum_confirmed=true,quorum_note=trim(p_quorum_note),started_at=coalesce(started_at,now()),updated_by=p_actor,updated_at=now() where id=p_meeting;
  insert into public.office_board_events(meeting_id,actor_user_id,event_type,entity_type,entity_id,previous_status,new_status,metadata)
  values(p_meeting,p_actor,'MEETING_STARTED','MEETING',p_meeting,m.status,'IN_PROGRESS',jsonb_build_object('present_count',v_present,'quorum_note',trim(p_quorum_note)));
  return 'IN_PROGRESS';
end; $$;

create or replace function public.office_board_decide_agenda_item(p_actor uuid,p_item uuid,p_outcome text,p_note text)
returns text language plpgsql security definer set search_path='' as $$
declare a public.office_board_agenda_items%rowtype; m public.office_board_meetings%rowtype; v_outcome text:=upper(trim(p_outcome));
begin
  if not public.office_board_has_permission(p_actor,'secretarial.board.manage') and not public.office_board_is_director(p_actor) then raise exception 'Board authority is required'; end if;
  select * into a from public.office_board_agenda_items where id=p_item for update;
  if a.id is null then raise exception 'Agenda item not found'; end if;
  select * into m from public.office_board_meetings where id=a.meeting_id;
  if m.status<>'IN_PROGRESS' or a.status<>'LOCKED' then raise exception 'Agenda item is not open for decision'; end if;
  if v_outcome not in ('NOTED','DECIDED','DEFERRED','WITHDRAWN') then raise exception 'Invalid agenda outcome'; end if;
  if char_length(trim(coalesce(p_note,'')))<3 then raise exception 'Decision note is required'; end if;
  update public.office_board_agenda_items set status=v_outcome,decision_note=trim(p_note),decided_at=now(),updated_at=now() where id=p_item;
  insert into public.office_board_events(meeting_id,actor_user_id,event_type,entity_type,entity_id,previous_status,new_status,note)
  values(a.meeting_id,p_actor,'AGENDA_ITEM_DECIDED','AGENDA_ITEM',p_item,a.status,v_outcome,left(trim(p_note),4000));
  return v_outcome;
end; $$;

create or replace function public.office_board_complete_meeting(p_actor uuid,p_meeting uuid)
returns text language plpgsql security definer set search_path='' as $$
declare m public.office_board_meetings%rowtype; v_open integer;
begin
  if not public.office_board_has_permission(p_actor,'secretarial.board.manage') and not public.office_board_is_director(p_actor) then raise exception 'Board authority is required'; end if;
  select * into m from public.office_board_meetings where id=p_meeting for update;
  if m.id is null or m.status<>'IN_PROGRESS' then raise exception 'Meeting is not in progress'; end if;
  select count(*) into v_open from public.office_board_agenda_items where meeting_id=p_meeting and status='LOCKED';
  if v_open>0 then raise exception 'All agenda items must have an outcome before meeting completion'; end if;
  update public.office_board_meetings set status='COMPLETED',completed_at=now(),updated_by=p_actor,updated_at=now() where id=p_meeting;
  insert into public.office_board_events(meeting_id,actor_user_id,event_type,entity_type,entity_id,previous_status,new_status)
  values(p_meeting,p_actor,'MEETING_COMPLETED','MEETING',p_meeting,m.status,'COMPLETED');
  return 'COMPLETED';
end; $$;

create or replace function public.office_board_save_minutes_draft(p_actor uuid,p_meeting uuid,p_body text)
returns uuid language plpgsql security definer set search_path='' as $$
declare m public.office_board_meetings%rowtype; v_version integer; v_id uuid;
begin
  if not public.office_board_has_permission(p_actor,'secretarial.minutes.prepare') then raise exception 'Minutes preparation permission is required'; end if;
  select * into m from public.office_board_meetings where id=p_meeting for update;
  if m.id is null or m.status not in ('COMPLETED','MINUTES_DRAFTED') then raise exception 'Meeting must be completed before drafting minutes'; end if;
  if exists(select 1 from public.office_board_minutes_versions where meeting_id=p_meeting and status='LOCKED') then raise exception 'Meeting minutes are already locked'; end if;
  select coalesce(max(version_no),0)+1 into v_version from public.office_board_minutes_versions where meeting_id=p_meeting;
  update public.office_board_minutes_versions set status='SUPERSEDED',updated_at=now() where meeting_id=p_meeting and status in ('DRAFT','CHAIR_REVIEW','APPROVED');
  insert into public.office_board_minutes_versions(meeting_id,version_no,body,prepared_by) values(p_meeting,v_version,trim(p_body),p_actor) returning id into v_id;
  update public.office_board_meetings set status='MINUTES_DRAFTED',updated_by=p_actor,updated_at=now() where id=p_meeting;
  insert into public.office_board_events(meeting_id,actor_user_id,event_type,entity_type,entity_id,new_status,metadata)
  values(p_meeting,p_actor,'MINUTES_DRAFTED','MINUTES',v_id,'DRAFT',jsonb_build_object('version',v_version));
  return v_id;
end; $$;

create or replace function public.office_board_submit_minutes_review(p_actor uuid,p_minutes uuid)
returns text language plpgsql security definer set search_path='' as $$
declare v public.office_board_minutes_versions%rowtype;
begin
  if not public.office_board_has_permission(p_actor,'secretarial.minutes.prepare') then raise exception 'Minutes preparation permission is required'; end if;
  select * into v from public.office_board_minutes_versions where id=p_minutes for update;
  if v.id is null or v.status<>'DRAFT' or v.prepared_by<>p_actor then raise exception 'Only the current preparer can submit the draft for review'; end if;
  update public.office_board_minutes_versions set status='CHAIR_REVIEW',review_submitted_at=now(),updated_at=now() where id=p_minutes;
  insert into public.office_board_events(meeting_id,actor_user_id,event_type,entity_type,entity_id,previous_status,new_status)
  values(v.meeting_id,p_actor,'MINUTES_SUBMITTED_FOR_REVIEW','MINUTES',p_minutes,'DRAFT','CHAIR_REVIEW');
  return 'CHAIR_REVIEW';
end; $$;

create or replace function public.office_board_approve_minutes(p_actor uuid,p_minutes uuid,p_note text default null)
returns text language plpgsql security definer set search_path='' as $$
declare v public.office_board_minutes_versions%rowtype;
begin
  if not public.office_board_is_director(p_actor) then raise exception 'Director approval is required'; end if;
  select * into v from public.office_board_minutes_versions where id=p_minutes for update;
  if v.id is null or v.status<>'CHAIR_REVIEW' then raise exception 'Minutes are not awaiting director/chair review'; end if;
  if v.prepared_by=p_actor then raise exception 'Minutes preparer cannot approve the same version'; end if;
  update public.office_board_minutes_versions set status='APPROVED',approved_by=p_actor,approved_at=now(),approval_note=nullif(trim(coalesce(p_note,'')),''),updated_at=now() where id=p_minutes;
  insert into public.office_board_events(meeting_id,actor_user_id,event_type,entity_type,entity_id,previous_status,new_status,note)
  values(v.meeting_id,p_actor,'MINUTES_APPROVED','MINUTES',p_minutes,'CHAIR_REVIEW','APPROVED',left(trim(coalesce(p_note,'')),2000));
  return 'APPROVED';
end; $$;

create or replace function public.office_board_lock_minutes(p_actor uuid,p_minutes uuid)
returns text language plpgsql security definer set search_path='' as $$
declare v public.office_board_minutes_versions%rowtype; v_hash text;
begin
  if not public.office_board_has_permission(p_actor,'secretarial.minutes.lock') then raise exception 'Minutes lock permission is required'; end if;
  select * into v from public.office_board_minutes_versions where id=p_minutes for update;
  if v.id is null or v.status<>'APPROVED' or v.approved_by is null then raise exception 'Independently approved minutes are required before lock'; end if;
  if exists(select 1 from public.office_board_minutes_versions where meeting_id=v.meeting_id and status='LOCKED') then raise exception 'Meeting already has locked minutes'; end if;
  v_hash:=encode(digest(convert_to(v.body,'UTF8'),'sha256'),'hex');
  update public.office_board_minutes_versions set status='LOCKED',content_hash=v_hash,locked_by=p_actor,locked_at=now(),updated_at=now() where id=p_minutes;
  update public.office_board_meetings set status='MINUTES_LOCKED',minutes_locked_at=now(),updated_by=p_actor,updated_at=now() where id=v.meeting_id;
  insert into public.office_board_events(meeting_id,actor_user_id,event_type,entity_type,entity_id,previous_status,new_status,metadata)
  values(v.meeting_id,p_actor,'MINUTES_LOCKED','MINUTES',p_minutes,'APPROVED','LOCKED',jsonb_build_object('sha256',v_hash));
  return v_hash;
end; $$;

create or replace function public.office_board_record_resolution(
  p_actor uuid,p_item uuid,p_type text,p_title text,p_text text,p_approval_basis text,p_approved_by_name text,p_source_reference text default null
)
returns uuid language plpgsql security definer set search_path='' as $$
declare a public.office_board_agenda_items%rowtype; m public.office_board_meetings%rowtype; v_id uuid; v_hash text;
begin
  if not public.office_board_has_permission(p_actor,'secretarial.resolution.record') then raise exception 'Resolution-record permission is required'; end if;
  select * into a from public.office_board_agenda_items where id=p_item;
  if a.id is null or a.status<>'DECIDED' then raise exception 'A decided agenda item is required'; end if;
  select * into m from public.office_board_meetings where id=a.meeting_id;
  if m.status not in ('COMPLETED','MINUTES_DRAFTED','MINUTES_LOCKED') then raise exception 'Meeting must be completed before resolution record'; end if;
  v_hash:=encode(digest(convert_to(trim(p_text),'UTF8'),'sha256'),'hex');
  insert into public.office_board_resolutions(meeting_id,agenda_item_id,resolution_type,title,resolution_text,approval_basis,approved_by_name,recorded_by,content_hash,source_reference)
  values(a.meeting_id,p_item,upper(trim(p_type)),trim(p_title),trim(p_text),trim(p_approval_basis),nullif(trim(coalesce(p_approved_by_name,'')),''),p_actor,v_hash,nullif(trim(coalesce(p_source_reference,'')),''))
  returning id into v_id;
  insert into public.office_board_events(meeting_id,actor_user_id,event_type,entity_type,entity_id,new_status,metadata)
  values(a.meeting_id,p_actor,'RESOLUTION_RECORDED','RESOLUTION',v_id,'RECORDED',jsonb_build_object('sha256',v_hash));
  return v_id;
end; $$;

create or replace function public.office_board_create_action(
  p_actor uuid,p_meeting uuid,p_agenda uuid,p_resolution uuid,p_title text,p_description text,p_owner uuid,p_due_at timestamptz default null
)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if not public.office_board_has_permission(p_actor,'secretarial.board.manage') then raise exception 'Board management permission is required'; end if;
  if not exists(select 1 from public.office_board_meetings where id=p_meeting) then raise exception 'Meeting not found'; end if;
  if not exists(select 1 from public.office_identity_users where user_id=p_owner and status='ACTIVE') then raise exception 'Active action owner is required'; end if;
  insert into public.office_board_actions(meeting_id,agenda_item_id,resolution_id,title,description,owner_user_id,due_at,created_by)
  values(p_meeting,p_agenda,p_resolution,trim(p_title),nullif(trim(coalesce(p_description,'')),''),p_owner,p_due_at,p_actor) returning id into v_id;
  insert into public.office_board_events(meeting_id,actor_user_id,event_type,entity_type,entity_id,new_status,metadata)
  values(p_meeting,p_actor,'BOARD_ACTION_CREATED','ACTION',v_id,'OPEN',jsonb_build_object('owner_user_id',p_owner,'due_at',p_due_at));
  insert into public.office_notifications(user_id,kind,title,body) values(p_owner,'TASK_ASSIGNED','Board action assigned',left(trim(p_title),180));
  return v_id;
end; $$;

create or replace function public.office_board_transition_action(p_actor uuid,p_action uuid,p_status text,p_note text default null)
returns text language plpgsql security definer set search_path='' as $$
declare a public.office_board_actions%rowtype; v_status text:=upper(trim(p_status));
begin
  select * into a from public.office_board_actions where id=p_action for update;
  if a.id is null then raise exception 'Board action not found'; end if;
  if p_actor<>a.owner_user_id and not public.office_board_has_permission(p_actor,'secretarial.board.manage') then raise exception 'Board action authority is required'; end if;
  if a.status in ('DONE','CANCELLED') then raise exception 'Closed board action cannot be altered'; end if;
  if v_status not in ('OPEN','IN_PROGRESS','BLOCKED','DONE','CANCELLED') then raise exception 'Invalid board action status'; end if;
  if v_status in ('BLOCKED','DONE','CANCELLED') and char_length(trim(coalesce(p_note,'')))<3 then raise exception 'Status note is required'; end if;
  update public.office_board_actions set status=v_status,blocker_note=case when v_status='BLOCKED' then trim(p_note) else null end,completion_note=case when v_status in ('DONE','CANCELLED') then trim(p_note) else completion_note end,completed_at=case when v_status='DONE' then now() else completed_at end,updated_at=now() where id=p_action;
  insert into public.office_board_events(meeting_id,actor_user_id,event_type,entity_type,entity_id,previous_status,new_status,note)
  values(a.meeting_id,p_actor,'BOARD_ACTION_UPDATED','ACTION',p_action,a.status,v_status,left(trim(coalesce(p_note,'')),2000));
  return v_status;
end; $$;

create or replace function public.office_secretarial_create_followup(
  p_actor uuid,p_meeting uuid,p_resolution uuid,p_title text,p_authority text,p_form_code text,p_due_at timestamptz,p_due_basis text,p_source_reference text,p_owner uuid,p_reviewer uuid
)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if not public.office_board_has_permission(p_actor,'secretarial.filing.manage') then raise exception 'Secretarial follow-up permission is required'; end if;
  if p_meeting is null and p_resolution is null then raise exception 'Meeting or resolution source is required'; end if;
  if not exists(select 1 from public.office_identity_users where user_id=p_owner and status='ACTIVE') then raise exception 'Active follow-up owner is required'; end if;
  insert into public.office_secretarial_followups(meeting_id,resolution_id,title,authority,form_code,due_at,due_basis,source_reference,owner_user_id,reviewer_user_id,created_by)
  values(p_meeting,p_resolution,trim(p_title),trim(p_authority),nullif(trim(coalesce(p_form_code,'')),''),p_due_at,trim(p_due_basis),trim(p_source_reference),p_owner,p_reviewer,p_actor)
  returning id into v_id;
  if p_meeting is not null then
    insert into public.office_board_events(meeting_id,actor_user_id,event_type,entity_type,entity_id,new_status,metadata)
    values(p_meeting,p_actor,'SECRETARIAL_FOLLOWUP_CREATED','FOLLOWUP',v_id,'OPEN',jsonb_build_object('authority',trim(p_authority),'due_at',p_due_at,'source_reference',trim(p_source_reference)));
  end if;
  insert into public.office_notifications(user_id,kind,title,body) values(p_owner,'TASK_ASSIGNED','Secretarial follow-up assigned',left(trim(p_title),180));
  return v_id;
end; $$;

create or replace function public.office_secretarial_transition_followup(
  p_actor uuid,p_followup uuid,p_status text,p_reference text default null,p_evidence text default null
)
returns text language plpgsql security definer set search_path='' as $$
declare f public.office_secretarial_followups%rowtype; v_status text:=upper(trim(p_status));
begin
  if not public.office_board_has_permission(p_actor,'secretarial.filing.manage') then raise exception 'Secretarial follow-up permission is required'; end if;
  select * into f from public.office_secretarial_followups where id=p_followup for update;
  if f.id is null then raise exception 'Follow-up not found'; end if;
  if f.status in ('CLOSED','NOT_REQUIRED') then raise exception 'Closed follow-up cannot be altered'; end if;
  if v_status not in ('OPEN','PREPARED','APPROVED','FILED','ACKNOWLEDGED','NOT_REQUIRED','CLOSED') then raise exception 'Invalid follow-up status'; end if;
  if v_status='FILED' and char_length(trim(coalesce(p_reference,'')))<3 then raise exception 'Filing reference is required'; end if;
  if v_status in ('ACKNOWLEDGED','CLOSED') and char_length(trim(coalesce(p_evidence,'')))<3 then raise exception 'Evidence/acknowledgement reference is required'; end if;
  update public.office_secretarial_followups set status=v_status,filing_reference=case when v_status='FILED' then trim(p_reference) else filing_reference end,evidence_reference=case when v_status in ('ACKNOWLEDGED','CLOSED') then trim(p_evidence) else evidence_reference end,filed_at=case when v_status='FILED' then now() else filed_at end,acknowledged_at=case when v_status='ACKNOWLEDGED' then now() else acknowledged_at end,closed_at=case when v_status='CLOSED' then now() else closed_at end,updated_at=now() where id=p_followup;
  if f.meeting_id is not null then
    insert into public.office_board_events(meeting_id,actor_user_id,event_type,entity_type,entity_id,previous_status,new_status,metadata)
    values(f.meeting_id,p_actor,'SECRETARIAL_FOLLOWUP_UPDATED','FOLLOWUP',p_followup,f.status,v_status,jsonb_build_object('filing_reference',nullif(trim(coalesce(p_reference,'')),''),'evidence_reference',nullif(trim(coalesce(p_evidence,'')),'')));
  end if;
  return v_status;
end; $$;

revoke all on function public.office_board_has_permission(uuid,text) from public,anon,authenticated;
revoke all on function public.office_board_is_director(uuid) from public,anon,authenticated;
revoke all on function public.office_board_create_meeting(uuid,text,text,timestamptz,timestamptz,text,text,text,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.office_board_add_participant(uuid,uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.office_board_add_agenda_item(uuid,uuid,text,text,text,text,uuid,text) from public,anon,authenticated;
revoke all on function public.office_board_issue_notice(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.office_board_lock_agenda(uuid,uuid) from public,anon,authenticated;
revoke all on function public.office_board_record_attendance(uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.office_board_start_meeting(uuid,uuid,boolean,text) from public,anon,authenticated;
revoke all on function public.office_board_decide_agenda_item(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.office_board_complete_meeting(uuid,uuid) from public,anon,authenticated;
revoke all on function public.office_board_save_minutes_draft(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.office_board_submit_minutes_review(uuid,uuid) from public,anon,authenticated;
revoke all on function public.office_board_approve_minutes(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.office_board_lock_minutes(uuid,uuid) from public,anon,authenticated;
revoke all on function public.office_board_record_resolution(uuid,uuid,text,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.office_board_create_action(uuid,uuid,uuid,uuid,text,text,uuid,timestamptz) from public,anon,authenticated;
revoke all on function public.office_board_transition_action(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.office_secretarial_create_followup(uuid,uuid,uuid,text,text,text,timestamptz,text,text,uuid,uuid) from public,anon,authenticated;
revoke all on function public.office_secretarial_transition_followup(uuid,uuid,text,text,text) from public,anon,authenticated;

grant execute on function public.office_board_has_permission(uuid,text) to service_role;
grant execute on function public.office_board_is_director(uuid) to service_role;
grant execute on function public.office_board_create_meeting(uuid,text,text,timestamptz,timestamptz,text,text,text,uuid,text,uuid) to service_role;
grant execute on function public.office_board_add_participant(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.office_board_add_agenda_item(uuid,uuid,text,text,text,text,uuid,text) to service_role;
grant execute on function public.office_board_issue_notice(uuid,uuid,text) to service_role;
grant execute on function public.office_board_lock_agenda(uuid,uuid) to service_role;
grant execute on function public.office_board_record_attendance(uuid,uuid,text,text,text) to service_role;
grant execute on function public.office_board_start_meeting(uuid,uuid,boolean,text) to service_role;
grant execute on function public.office_board_decide_agenda_item(uuid,uuid,text,text) to service_role;
grant execute on function public.office_board_complete_meeting(uuid,uuid) to service_role;
grant execute on function public.office_board_save_minutes_draft(uuid,uuid,text) to service_role;
grant execute on function public.office_board_submit_minutes_review(uuid,uuid) to service_role;
grant execute on function public.office_board_approve_minutes(uuid,uuid,text) to service_role;
grant execute on function public.office_board_lock_minutes(uuid,uuid) to service_role;
grant execute on function public.office_board_record_resolution(uuid,uuid,text,text,text,text,text,text) to service_role;
grant execute on function public.office_board_create_action(uuid,uuid,uuid,uuid,text,text,uuid,timestamptz) to service_role;
grant execute on function public.office_board_transition_action(uuid,uuid,text,text) to service_role;
grant execute on function public.office_secretarial_create_followup(uuid,uuid,uuid,text,text,text,timestamptz,text,text,uuid,uuid) to service_role;
grant execute on function public.office_secretarial_transition_followup(uuid,uuid,text,text,text) to service_role;
