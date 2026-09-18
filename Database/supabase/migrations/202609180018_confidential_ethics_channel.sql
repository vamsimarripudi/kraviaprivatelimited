-- KRAVIA Office OS — confidential ethics and whistleblowing.
-- Adds a narrow owner-bypass flag so highly restricted case permissions can require explicit investigator assignment.

alter table public.office_permission_catalog
  add column if not exists owner_bypass boolean not null default true;

insert into public.office_permission_catalog(code,module,action,label,description,sensitivity,high_risk,requires_managed_device,active,owner_bypass) values
 ('ethics.report','ETHICS','REPORT','Report ethics concern','Submit and follow the actor''s own confidential ethics concern. This is confidential but not represented as technically anonymous.','SENSITIVE',false,false,true,true),
 ('ethics.case.read','ETHICS','READ_CASE','Read ethics cases','Read restricted ethics investigations only when explicitly assigned investigator authority exists.','CRITICAL',true,true,true,false),
 ('ethics.case.manage','ETHICS','MANAGE_CASE','Manage ethics cases','Triage, investigate and document restricted ethics cases.','CRITICAL',true,true,true,false),
 ('ethics.case.review','ETHICS','REVIEW_CASE','Review ethics case closure','Independently review closure/outcome of a restricted ethics case.','CRITICAL',true,true,true,false)
on conflict(code) do update set module=excluded.module,action=excluded.action,label=excluded.label,description=excluded.description,sensitivity=excluded.sensitivity,high_risk=excluded.high_risk,requires_managed_device=excluded.requires_managed_device,active=true,owner_bypass=excluded.owner_bypass;

insert into public.office_access_profile_catalog(
 code,label,category,description,max_active_devices,requires_managed_device_for_high_risk,assignable_by_admin,owner_managed_only,active
) values (
 'ETHICS_INVESTIGATOR','Ethics Investigator','LEGAL',
 'Restricted ethics/whistleblowing investigation authority. This profile is not inherited from executive, HR, admin or manager roles.',
 1,true,false,true,true
)
on conflict(code) do update set label=excluded.label,category=excluded.category,description=excluded.description,max_active_devices=excluded.max_active_devices,requires_managed_device_for_high_risk=excluded.requires_managed_device_for_high_risk,assignable_by_admin=excluded.assignable_by_admin,owner_managed_only=excluded.owner_managed_only,active=true;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type)
select code,'ethics.report','ALLOW','OWN' from public.office_access_profile_catalog
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type) values
 ('ETHICS_INVESTIGATOR','ethics.case.read','ALLOW','COMPANY'),
 ('ETHICS_INVESTIGATOR','ethics.case.manage','ALLOW','COMPANY'),
 ('ETHICS_INVESTIGATOR','ethics.case.review','ALLOW','COMPANY')
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

create sequence if not exists public.office_ethics_case_seq;
grant usage,select on sequence public.office_ethics_case_seq to service_role;

create table if not exists public.office_ethics_cases(
 id uuid primary key default gen_random_uuid(),
 case_code text not null unique default ('KR-ETH-'||lpad(nextval('public.office_ethics_case_seq')::text,7,'0')),
 reporter_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 category text not null check(category in ('CODE_OF_CONDUCT','HARASSMENT','DISCRIMINATION','FRAUD','BRIBERY','CONFLICT_OF_INTEREST','DATA_MISUSE','SECURITY','RETALIATION','SAFETY','OTHER')),
 severity text not null default 'MEDIUM' check(severity in ('LOW','MEDIUM','HIGH','CRITICAL')),
 title text not null check(char_length(trim(title)) between 3 and 220),
 report_text text not null check(char_length(trim(report_text))>=10),
 reporter_evidence_reference text,
 confidentiality_notice text not null default 'CONFIDENTIAL_NOT_ANONYMOUS',
 status text not null default 'SUBMITTED' check(status in ('SUBMITTED','TRIAGE','INVESTIGATING','ACTION_PENDING','AWAITING_REVIEW','CLOSED','UNSUBSTANTIATED','WITHDRAWN')),
 investigator_user_id uuid references public.office_identity_users(user_id) on delete restrict,
 reviewer_user_id uuid references public.office_identity_users(user_id) on delete restrict,
 outcome_summary text,
 reporter_safe_outcome text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 closed_at timestamptz
);
create index if not exists office_ethics_cases_reporter_idx on public.office_ethics_cases(reporter_user_id,created_at desc);
create index if not exists office_ethics_cases_status_idx on public.office_ethics_cases(status,severity,created_at desc);

create table if not exists public.office_ethics_case_notes(
 id bigint generated always as identity primary key,
 case_id uuid not null references public.office_ethics_cases(id) on delete restrict,
 author_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 visibility text not null check(visibility in ('REPORTER','INVESTIGATOR')),
 note_text text not null check(char_length(trim(note_text))>=1),
 evidence_reference text,
 created_at timestamptz not null default now()
);
create index if not exists office_ethics_case_notes_case_idx on public.office_ethics_case_notes(case_id,created_at);

create table if not exists public.office_ethics_events(
 id bigint generated always as identity primary key,
 case_id uuid not null references public.office_ethics_cases(id) on delete restrict,
 actor_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 event_type text not null,
 previous_status text,
 new_status text,
 note text,
 created_at timestamptz not null default now()
);

alter table public.office_ethics_cases enable row level security;
alter table public.office_ethics_case_notes enable row level security;
alter table public.office_ethics_events enable row level security;
revoke all on public.office_ethics_cases,public.office_ethics_case_notes,public.office_ethics_events from public,anon,authenticated;
grant select,insert,update on public.office_ethics_cases to service_role;
grant select,insert on public.office_ethics_case_notes,public.office_ethics_events to service_role;

create or replace function public.office_ethics_report(
 p_actor uuid,p_category text,p_severity text,p_title text,p_report text,p_evidence text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not public.office_effective_permission(p_actor,'ethics.report','OWN',p_actor::text,null) then raise exception 'Ethics reporting permission is required'; end if;
 insert into public.office_ethics_cases(reporter_user_id,category,severity,title,report_text,reporter_evidence_reference)
 values(p_actor,upper(trim(p_category)),upper(trim(p_severity)),trim(p_title),trim(p_report),nullif(trim(coalesce(p_evidence,'')),'')) returning id into v_id;
 insert into public.office_ethics_events(case_id,actor_user_id,event_type,new_status,note) values(v_id,p_actor,'CASE_REPORTED','SUBMITTED','Reporter identity is confidential but the system does not claim technical anonymity.');
 return v_id;
end; $$;

create or replace function public.office_ethics_assign(
 p_actor uuid,p_case uuid,p_investigator uuid
) returns boolean language plpgsql security definer set search_path='' as $$
declare c public.office_ethics_cases%rowtype;
begin
 if not public.office_effective_permission(p_actor,'ethics.case.manage','COMPANY',null,null) then raise exception 'Ethics case management permission is required'; end if;
 select * into c from public.office_ethics_cases where id=p_case for update;
 if c.id is null or c.status in ('CLOSED','UNSUBSTANTIATED','WITHDRAWN') then raise exception 'Open ethics case is required'; end if;
 if p_investigator=c.reporter_user_id then raise exception 'Reporter cannot investigate their own case'; end if;
 if not exists(select 1 from public.office_user_access_profiles where user_id=p_investigator and profile_code='ETHICS_INVESTIGATOR' and status='ACTIVE' and (expires_at is null or expires_at>now())) then raise exception 'Assigned investigator must hold active Ethics Investigator authority'; end if;
 update public.office_ethics_cases set investigator_user_id=p_investigator,status=case when status='SUBMITTED' then 'TRIAGE' else status end,updated_at=now() where id=c.id;
 insert into public.office_ethics_events(case_id,actor_user_id,event_type,previous_status,new_status) values(c.id,p_actor,'INVESTIGATOR_ASSIGNED',c.status,case when c.status='SUBMITTED' then 'TRIAGE' else c.status end);
 return true;
end; $$;

create or replace function public.office_ethics_note(
 p_actor uuid,p_case uuid,p_visibility text,p_note text,p_evidence text
) returns bigint language plpgsql security definer set search_path='' as $$
declare c public.office_ethics_cases%rowtype; v_id bigint; vis text:=upper(trim(p_visibility));
begin
 select * into c from public.office_ethics_cases where id=p_case;
 if c.id is null then raise exception 'Ethics case not found'; end if;
 if p_actor=c.reporter_user_id then
  if vis<>'REPORTER' then raise exception 'Reporter can only add reporter-visible notes'; end if;
  if c.status in ('CLOSED','UNSUBSTANTIATED','WITHDRAWN') then raise exception 'Finalized case cannot receive reporter notes'; end if;
 else
  if not public.office_effective_permission(p_actor,'ethics.case.manage','COMPANY',null,null) then raise exception 'Ethics case management permission is required'; end if;
  if p_actor<>c.investigator_user_id then raise exception 'Only the assigned investigator may add investigation notes'; end if;
 end if;
 insert into public.office_ethics_case_notes(case_id,author_user_id,visibility,note_text,evidence_reference)
 values(c.id,p_actor,vis,trim(p_note),nullif(trim(coalesce(p_evidence,'')),'')) returning id into v_id;
 insert into public.office_ethics_events(case_id,actor_user_id,event_type,note) values(c.id,p_actor,'CASE_NOTE_ADDED',case when vis='REPORTER' then 'Reporter-visible note' else 'Restricted investigator note' end);
 return v_id;
end; $$;

create or replace function public.office_ethics_transition(
 p_actor uuid,p_case uuid,p_status text,p_outcome text,p_reporter_outcome text
) returns text language plpgsql security definer set search_path='' as $$
declare c public.office_ethics_cases%rowtype; target text:=upper(trim(p_status)); review boolean;
begin
 select * into c from public.office_ethics_cases where id=p_case for update;
 if c.id is null then raise exception 'Ethics case not found'; end if;
 if p_actor=c.reporter_user_id and target='WITHDRAWN' then
  if c.status not in ('SUBMITTED','TRIAGE') then raise exception 'Case can no longer be withdrawn by reporter'; end if;
  update public.office_ethics_cases set status='WITHDRAWN',updated_at=now(),closed_at=now() where id=c.id;
  insert into public.office_ethics_events(case_id,actor_user_id,event_type,previous_status,new_status) values(c.id,p_actor,'CASE_WITHDRAWN',c.status,'WITHDRAWN');
  return 'WITHDRAWN';
 end if;
 review:=target in ('CLOSED','UNSUBSTANTIATED');
 if review then
  if not public.office_effective_permission(p_actor,'ethics.case.review','COMPANY',null,null) then raise exception 'Independent ethics review permission is required'; end if;
  if p_actor=c.reporter_user_id or p_actor=c.investigator_user_id then raise exception 'Reporter/investigator cannot independently close the same ethics case'; end if;
  if c.status<>'AWAITING_REVIEW' then raise exception 'Case awaiting independent review is required'; end if;
  if nullif(trim(coalesce(p_outcome,'')),'') is null or nullif(trim(coalesce(p_reporter_outcome,'')),'') is null then raise exception 'Restricted and reporter-safe outcome summaries are required'; end if;
 else
  if not public.office_effective_permission(p_actor,'ethics.case.manage','COMPANY',null,null) or p_actor<>c.investigator_user_id then raise exception 'Assigned investigator authority is required'; end if;
  if target not in ('TRIAGE','INVESTIGATING','ACTION_PENDING','AWAITING_REVIEW') then raise exception 'Invalid ethics investigation transition'; end if;
 end if;
 update public.office_ethics_cases set status=target,reviewer_user_id=case when review then p_actor else reviewer_user_id end,outcome_summary=case when review then trim(p_outcome) else outcome_summary end,reporter_safe_outcome=case when review then trim(p_reporter_outcome) else reporter_safe_outcome end,updated_at=now(),closed_at=case when review then now() else closed_at end where id=c.id;
 insert into public.office_ethics_events(case_id,actor_user_id,event_type,previous_status,new_status) values(c.id,p_actor,'CASE_TRANSITION',c.status,target);
 return target;
end; $$;

revoke all on function public.office_ethics_report(uuid,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.office_ethics_assign(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.office_ethics_note(uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.office_ethics_transition(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.office_ethics_report(uuid,text,text,text,text,text) to service_role;
grant execute on function public.office_ethics_assign(uuid,uuid,uuid) to service_role;
grant execute on function public.office_ethics_note(uuid,uuid,text,text,text) to service_role;
grant execute on function public.office_ethics_transition(uuid,uuid,text,text,text) to service_role;
