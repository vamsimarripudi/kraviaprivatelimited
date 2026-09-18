-- KRAVIA Office OS — strategy, objectives and key results.
-- Progress and health are explicitly reported by accountable humans. No employee-performance score is derived from activity telemetry.

insert into public.office_permission_catalog(code,module,action,label,description,sensitivity,high_risk,requires_managed_device,active) values
 ('strategy.read','STRATEGY','READ','Read strategy','Read approved/active strategy cycles, objectives and key results in authorised scope.','STANDARD',false,false,true),
 ('strategy.manage','STRATEGY','MANAGE','Manage strategy','Create and maintain strategy cycles and objectives without independently approving own cycle.','HIGH',true,true,true),
 ('strategy.review','STRATEGY','REVIEW','Review strategy','Independently approve/reject/close strategy cycles.','HIGH',true,true,true),
 ('strategy.progress.update','STRATEGY','UPDATE_PROGRESS','Update key-result progress','Update human-reported key-result measurement, status and evidence in authorised scope.','STANDARD',false,false,true)
on conflict(code) do update set module=excluded.module,action=excluded.action,label=excluded.label,description=excluded.description,sensitivity=excluded.sensitivity,high_risk=excluded.high_risk,requires_managed_device=excluded.requires_managed_device,active=true;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type)
select code,'strategy.read','ALLOW','COMPANY' from public.office_access_profile_catalog
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type) values
 ('PRODUCT_MANAGER','strategy.manage','ALLOW','DEPARTMENT'),
 ('PRODUCT_MANAGER','strategy.progress.update','ALLOW','DEPARTMENT'),
 ('ENGINEERING_MANAGER','strategy.manage','ALLOW','DEPARTMENT'),
 ('ENGINEERING_MANAGER','strategy.progress.update','ALLOW','DEPARTMENT'),
 ('OPERATIONS_MANAGER','strategy.manage','ALLOW','DEPARTMENT'),
 ('OPERATIONS_MANAGER','strategy.progress.update','ALLOW','DEPARTMENT'),
 ('HR_MANAGER','strategy.manage','ALLOW','DEPARTMENT'),
 ('HR_MANAGER','strategy.progress.update','ALLOW','DEPARTMENT'),
 ('FINANCE_MANAGER','strategy.manage','ALLOW','DEPARTMENT'),
 ('FINANCE_MANAGER','strategy.progress.update','ALLOW','DEPARTMENT'),
 ('RISK_MANAGER','strategy.read','ALLOW','COMPANY'),
 ('RISK_MANAGER','strategy.review','ALLOW','COMPANY'),
 ('AUDITOR_READONLY','strategy.read','ALLOW','COMPANY')
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

create sequence if not exists public.office_strategy_cycle_seq;
create sequence if not exists public.office_strategy_objective_seq;
create sequence if not exists public.office_strategy_kr_seq;
grant usage,select on sequence public.office_strategy_cycle_seq,public.office_strategy_objective_seq,public.office_strategy_kr_seq to service_role;

create table if not exists public.office_strategy_cycles(
 id uuid primary key default gen_random_uuid(),
 cycle_code text not null unique default ('KR-STR-'||lpad(nextval('public.office_strategy_cycle_seq')::text,6,'0')),
 title text not null check(char_length(trim(title)) between 3 and 220),
 scope_type text not null check(scope_type in ('COMPANY','DEPARTMENT')),
 scope_key text,
 period_start date not null,
 period_end date not null,
 owner_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 status text not null default 'DRAFT' check(status in ('DRAFT','SUBMITTED','APPROVED','ACTIVE','CLOSED','REJECTED','CANCELLED')),
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 reviewed_by uuid references public.office_identity_users(user_id) on delete restrict,
 reviewed_at timestamptz,
 review_note text,
 closure_evidence_reference text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(period_end>=period_start),
 check((scope_type='COMPANY' and scope_key is null) or (scope_type='DEPARTMENT' and scope_key is not null))
);
create index if not exists office_strategy_cycles_scope_idx on public.office_strategy_cycles(scope_type,scope_key,status,period_end);

create table if not exists public.office_strategy_objectives(
 id uuid primary key default gen_random_uuid(),
 objective_code text not null unique default ('KR-OBJ-'||lpad(nextval('public.office_strategy_objective_seq')::text,7,'0')),
 cycle_id uuid not null references public.office_strategy_cycles(id) on delete restrict,
 parent_objective_id uuid references public.office_strategy_objectives(id) on delete restrict,
 title text not null check(char_length(trim(title)) between 3 and 220),
 description text not null check(char_length(trim(description))>=3),
 owner_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 priority text not null default 'MEDIUM' check(priority in ('LOW','MEDIUM','HIGH','CRITICAL')),
 status text not null default 'DRAFT' check(status in ('DRAFT','ACTIVE','COMPLETED','CANCELLED')),
 completion_evidence_reference text,
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists office_strategy_objectives_cycle_idx on public.office_strategy_objectives(cycle_id,status,priority);

create table if not exists public.office_strategy_key_results(
 id uuid primary key default gen_random_uuid(),
 key_result_code text not null unique default ('KR-KR-'||lpad(nextval('public.office_strategy_kr_seq')::text,8,'0')),
 objective_id uuid not null references public.office_strategy_objectives(id) on delete restrict,
 title text not null check(char_length(trim(title)) between 3 and 220),
 owner_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 measurement_kind text not null check(measurement_kind in ('PERCENT','NUMBER','CURRENCY','BOOLEAN','MILESTONE')),
 unit text,
 start_value numeric,
 target_value numeric,
 current_value numeric,
 currency text check(currency is null or char_length(currency)=3),
 reported_status text not null default 'NOT_STARTED' check(reported_status in ('NOT_STARTED','ON_TRACK','AT_RISK','OFF_TRACK','ACHIEVED','CANCELLED')),
 progress_note text,
 evidence_reference text,
 due_on date,
 last_reported_by uuid references public.office_identity_users(user_id) on delete restrict,
 last_reported_at timestamptz,
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists office_strategy_kr_objective_idx on public.office_strategy_key_results(objective_id,reported_status,due_on);
create index if not exists office_strategy_kr_owner_idx on public.office_strategy_key_results(owner_user_id,reported_status,due_on);

create table if not exists public.office_strategy_events(
 id bigint generated always as identity primary key,
 actor_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 cycle_id uuid references public.office_strategy_cycles(id) on delete restrict,
 objective_id uuid references public.office_strategy_objectives(id) on delete restrict,
 key_result_id uuid references public.office_strategy_key_results(id) on delete restrict,
 event_type text not null,
 previous_status text,
 new_status text,
 note text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

alter table public.office_strategy_cycles enable row level security;
alter table public.office_strategy_objectives enable row level security;
alter table public.office_strategy_key_results enable row level security;
alter table public.office_strategy_events enable row level security;
revoke all on public.office_strategy_cycles,public.office_strategy_objectives,public.office_strategy_key_results,public.office_strategy_events from public,anon,authenticated;
grant select,insert,update on public.office_strategy_cycles,public.office_strategy_objectives,public.office_strategy_key_results to service_role;
grant select,insert on public.office_strategy_events to service_role;

create or replace function public.office_strategy_cycle_create(
 p_actor uuid,p_title text,p_scope_type text,p_scope_key text,p_start date,p_end date,p_owner uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; st text:=upper(trim(p_scope_type)); sk text:=upper(trim(coalesce(p_scope_key,'')));
begin
 if st='COMPANY' then
   if not public.office_effective_permission(p_actor,'strategy.manage','COMPANY',null,null) then raise exception 'Company strategy management permission is required'; end if;
   sk:=null;
 elsif st='DEPARTMENT' then
   if not public.office_effective_permission(p_actor,'strategy.manage','COMPANY',null,null)
      and not public.office_effective_permission(p_actor,'strategy.manage','DEPARTMENT',sk,null) then raise exception 'Department strategy management permission is required'; end if;
 else raise exception 'Invalid strategy scope';
 end if;
 if not exists(select 1 from public.office_identity_users where user_id=p_owner and status='ACTIVE') then raise exception 'Active strategy owner is required'; end if;
 insert into public.office_strategy_cycles(title,scope_type,scope_key,period_start,period_end,owner_user_id,created_by)
 values(trim(p_title),st,sk,p_start,p_end,p_owner,p_actor) returning id into v_id;
 insert into public.office_strategy_events(actor_user_id,cycle_id,event_type,new_status) values(p_actor,v_id,'STRATEGY_CYCLE_CREATED','DRAFT');
 return v_id;
end; $$;

create or replace function public.office_strategy_cycle_transition(
 p_actor uuid,p_cycle uuid,p_status text,p_evidence text,p_note text
) returns text language plpgsql security definer set search_path='' as $$
declare c public.office_strategy_cycles%rowtype; target text:=upper(trim(p_status)); review boolean; manage_allowed boolean; review_allowed boolean;
begin
 select * into c from public.office_strategy_cycles where id=p_cycle for update;
 if c.id is null then raise exception 'Strategy cycle not found'; end if;
 manage_allowed:=public.office_effective_permission(p_actor,'strategy.manage','COMPANY',null,null)
   or (c.scope_type='DEPARTMENT' and public.office_effective_permission(p_actor,'strategy.manage','DEPARTMENT',c.scope_key,null));
 review_allowed:=public.office_effective_permission(p_actor,'strategy.review','COMPANY',null,null)
   or (c.scope_type='DEPARTMENT' and public.office_effective_permission(p_actor,'strategy.review','DEPARTMENT',c.scope_key,null));
 review:=target in ('APPROVED','REJECTED','CLOSED','CANCELLED');
 if review then
  if not review_allowed then raise exception 'Independent strategy review permission is required'; end if;
  if p_actor=c.owner_user_id or p_actor=c.created_by then raise exception 'Strategy owner/creator cannot independently review the same cycle'; end if;
 else
  if not manage_allowed and p_actor<>c.owner_user_id then raise exception 'Strategy management permission is required'; end if;
 end if;
 if c.status='DRAFT' and target<>'SUBMITTED' then raise exception 'Draft strategy must be submitted first'; end if;
 if c.status='SUBMITTED' and target not in ('APPROVED','REJECTED') then raise exception 'Submitted strategy must be approved or rejected'; end if;
 if c.status='APPROVED' and target not in ('ACTIVE','CANCELLED') then raise exception 'Approved strategy must become active or be cancelled'; end if;
 if c.status='ACTIVE' and target not in ('CLOSED','CANCELLED') then raise exception 'Active strategy may only close or cancel'; end if;
 if c.status in ('CLOSED','REJECTED','CANCELLED') then raise exception 'Finalized strategy cycle cannot be transitioned'; end if;
 if target='CLOSED' then
  if exists(select 1 from public.office_strategy_objectives where cycle_id=c.id and status not in ('COMPLETED','CANCELLED')) then raise exception 'All objectives must be completed or cancelled before cycle closure'; end if;
  if nullif(trim(coalesce(p_evidence,'')),'') is null then raise exception 'Strategy closure evidence is required'; end if;
 end if;
 update public.office_strategy_cycles set status=target,reviewed_by=case when review then p_actor else reviewed_by end,reviewed_at=case when review then now() else reviewed_at end,review_note=coalesce(nullif(trim(coalesce(p_note,'')),''),review_note),closure_evidence_reference=case when target='CLOSED' then trim(p_evidence) else closure_evidence_reference end,updated_at=now() where id=c.id;
 insert into public.office_strategy_events(actor_user_id,cycle_id,event_type,previous_status,new_status,note) values(p_actor,c.id,'STRATEGY_CYCLE_TRANSITION',c.status,target,left(p_note,2000));
 return target;
end; $$;

create or replace function public.office_strategy_objective_create(
 p_actor uuid,p_cycle uuid,p_parent uuid,p_title text,p_description text,p_owner uuid,p_priority text
) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.office_strategy_cycles%rowtype; v_id uuid; allowed boolean;
begin
 select * into c from public.office_strategy_cycles where id=p_cycle and status not in ('CLOSED','REJECTED','CANCELLED');
 if c.id is null then raise exception 'Open strategy cycle is required'; end if;
 allowed:=public.office_effective_permission(p_actor,'strategy.manage','COMPANY',null,null)
   or (c.scope_type='DEPARTMENT' and public.office_effective_permission(p_actor,'strategy.manage','DEPARTMENT',c.scope_key,null));
 if not allowed then raise exception 'Strategy management permission is required'; end if;
 if p_parent is not null and not exists(select 1 from public.office_strategy_objectives where id=p_parent and cycle_id=c.id and status<>'CANCELLED') then raise exception 'Parent objective must belong to the same cycle'; end if;
 if not exists(select 1 from public.office_identity_users where user_id=p_owner and status='ACTIVE') then raise exception 'Active objective owner is required'; end if;
 insert into public.office_strategy_objectives(cycle_id,parent_objective_id,title,description,owner_user_id,priority,created_by)
 values(c.id,p_parent,trim(p_title),trim(p_description),p_owner,upper(trim(p_priority)),p_actor) returning id into v_id;
 insert into public.office_strategy_events(actor_user_id,cycle_id,objective_id,event_type,new_status) values(p_actor,c.id,v_id,'OBJECTIVE_CREATED','DRAFT');
 return v_id;
end; $$;

create or replace function public.office_strategy_objective_transition(
 p_actor uuid,p_objective uuid,p_status text,p_evidence text,p_note text
) returns text language plpgsql security definer set search_path='' as $$
declare o public.office_strategy_objectives%rowtype; c public.office_strategy_cycles%rowtype; target text:=upper(trim(p_status)); allowed boolean;
begin
 select * into o from public.office_strategy_objectives where id=p_objective for update;
 if o.id is null then raise exception 'Objective not found'; end if;
 select * into c from public.office_strategy_cycles where id=o.cycle_id;
 allowed:=p_actor=o.owner_user_id
   or public.office_effective_permission(p_actor,'strategy.manage','COMPANY',null,null)
   or (c.scope_type='DEPARTMENT' and public.office_effective_permission(p_actor,'strategy.manage','DEPARTMENT',c.scope_key,null));
 if not allowed then raise exception 'Objective ownership or strategy management permission is required'; end if;
 if o.status='DRAFT' and target not in ('ACTIVE','CANCELLED') then raise exception 'Draft objective must activate or cancel'; end if;
 if o.status='ACTIVE' and target not in ('COMPLETED','CANCELLED') then raise exception 'Active objective may complete or cancel'; end if;
 if o.status in ('COMPLETED','CANCELLED') then raise exception 'Finalized objective cannot be transitioned'; end if;
 if target='COMPLETED' then
  if exists(select 1 from public.office_strategy_key_results where objective_id=o.id and reported_status not in ('ACHIEVED','CANCELLED')) then raise exception 'All key results must be achieved or cancelled before objective completion'; end if;
  if nullif(trim(coalesce(p_evidence,'')),'') is null then raise exception 'Objective completion evidence is required'; end if;
 end if;
 update public.office_strategy_objectives set status=target,completion_evidence_reference=case when target='COMPLETED' then trim(p_evidence) else completion_evidence_reference end,updated_at=now() where id=o.id;
 insert into public.office_strategy_events(actor_user_id,cycle_id,objective_id,event_type,previous_status,new_status,note) values(p_actor,o.cycle_id,o.id,'OBJECTIVE_TRANSITION',o.status,target,left(p_note,2000));
 return target;
end; $$;

create or replace function public.office_strategy_kr_create(
 p_actor uuid,p_objective uuid,p_title text,p_owner uuid,p_kind text,p_unit text,p_start numeric,p_target numeric,p_currency text,p_due date
) returns uuid language plpgsql security definer set search_path='' as $$
declare o public.office_strategy_objectives%rowtype; c public.office_strategy_cycles%rowtype; v_id uuid; allowed boolean; kind text:=upper(trim(p_kind));
begin
 select * into o from public.office_strategy_objectives where id=p_objective and status not in ('COMPLETED','CANCELLED');
 if o.id is null then raise exception 'Open objective is required'; end if;
 select * into c from public.office_strategy_cycles where id=o.cycle_id;
 allowed:=public.office_effective_permission(p_actor,'strategy.manage','COMPANY',null,null)
   or (c.scope_type='DEPARTMENT' and public.office_effective_permission(p_actor,'strategy.manage','DEPARTMENT',c.scope_key,null));
 if not allowed then raise exception 'Strategy management permission is required'; end if;
 if not exists(select 1 from public.office_identity_users where user_id=p_owner and status='ACTIVE') then raise exception 'Active key-result owner is required'; end if;
 if kind not in ('PERCENT','NUMBER','CURRENCY','BOOLEAN','MILESTONE') then raise exception 'Invalid key-result measurement kind'; end if;
 if kind='CURRENCY' and (p_currency is null or char_length(trim(p_currency))<>3) then raise exception 'Currency key result requires ISO currency code'; end if;
 insert into public.office_strategy_key_results(objective_id,title,owner_user_id,measurement_kind,unit,start_value,target_value,current_value,currency,due_on,created_by)
 values(o.id,trim(p_title),p_owner,kind,nullif(trim(coalesce(p_unit,'')),''),p_start,p_target,p_start,case when kind='CURRENCY' then upper(trim(p_currency)) else null end,p_due,p_actor)
 returning id into v_id;
 insert into public.office_strategy_events(actor_user_id,cycle_id,objective_id,key_result_id,event_type,new_status) values(p_actor,o.cycle_id,o.id,v_id,'KEY_RESULT_CREATED','NOT_STARTED');
 return v_id;
end; $$;

create or replace function public.office_strategy_kr_report(
 p_actor uuid,p_kr uuid,p_value numeric,p_status text,p_note text,p_evidence text
) returns text language plpgsql security definer set search_path='' as $$
declare k public.office_strategy_key_results%rowtype; o public.office_strategy_objectives%rowtype; c public.office_strategy_cycles%rowtype; target text:=upper(trim(p_status)); allowed boolean;
begin
 select * into k from public.office_strategy_key_results where id=p_kr for update;
 if k.id is null or k.reported_status in ('ACHIEVED','CANCELLED') then raise exception 'Open key result is required'; end if;
 select * into o from public.office_strategy_objectives where id=k.objective_id;
 select * into c from public.office_strategy_cycles where id=o.cycle_id;
 allowed:=p_actor=k.owner_user_id
   or public.office_effective_permission(p_actor,'strategy.progress.update','COMPANY',null,null)
   or (c.scope_type='DEPARTMENT' and public.office_effective_permission(p_actor,'strategy.progress.update','DEPARTMENT',c.scope_key,null));
 if not allowed then raise exception 'Key-result ownership or progress permission is required'; end if;
 if target not in ('NOT_STARTED','ON_TRACK','AT_RISK','OFF_TRACK','ACHIEVED','CANCELLED') then raise exception 'Invalid key-result status'; end if;
 if target in ('AT_RISK','OFF_TRACK') and nullif(trim(coalesce(p_note,'')),'') is null then raise exception 'Progress note is required for at-risk/off-track key result'; end if;
 if target='ACHIEVED' and nullif(trim(coalesce(p_evidence,'')),'') is null then raise exception 'Achievement evidence is required'; end if;
 update public.office_strategy_key_results set current_value=p_value,reported_status=target,progress_note=nullif(trim(coalesce(p_note,'')),''),evidence_reference=case when target='ACHIEVED' then trim(p_evidence) else evidence_reference end,last_reported_by=p_actor,last_reported_at=now(),updated_at=now() where id=k.id;
 insert into public.office_strategy_events(actor_user_id,cycle_id,objective_id,key_result_id,event_type,previous_status,new_status,note,metadata) values(p_actor,o.cycle_id,o.id,k.id,'KEY_RESULT_PROGRESS',k.reported_status,target,left(p_note,2000),jsonb_build_object('current_value',p_value));
 return target;
end; $$;

revoke all on function public.office_strategy_cycle_create(uuid,text,text,text,date,date,uuid) from public,anon,authenticated;
revoke all on function public.office_strategy_cycle_transition(uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.office_strategy_objective_create(uuid,uuid,uuid,text,text,uuid,text) from public,anon,authenticated;
revoke all on function public.office_strategy_objective_transition(uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.office_strategy_kr_create(uuid,uuid,text,uuid,text,text,numeric,numeric,text,date) from public,anon,authenticated;
revoke all on function public.office_strategy_kr_report(uuid,uuid,numeric,text,text,text) from public,anon,authenticated;

grant execute on function public.office_strategy_cycle_create(uuid,text,text,text,date,date,uuid) to service_role;
grant execute on function public.office_strategy_cycle_transition(uuid,uuid,text,text,text) to service_role;
grant execute on function public.office_strategy_objective_create(uuid,uuid,uuid,text,text,uuid,text) to service_role;
grant execute on function public.office_strategy_objective_transition(uuid,uuid,text,text,text) to service_role;
grant execute on function public.office_strategy_kr_create(uuid,uuid,text,uuid,text,text,numeric,numeric,text,date) to service_role;
grant execute on function public.office_strategy_kr_report(uuid,uuid,numeric,text,text,text) to service_role;
