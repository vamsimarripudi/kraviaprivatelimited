-- KRAVIA Office OS — contract obligation engine.
-- Converts signed contracts into owned, evidence-backed operational duties.

insert into public.office_permission_catalog(code,module,action,label,description,sensitivity,high_risk,requires_managed_device,active) values
 ('legal.obligation.read','LEGAL','READ_OBLIGATION','Read contract obligations','Read contract duties, dates and evidence inside authorised scope.','SENSITIVE',false,true,true),
 ('legal.obligation.manage','LEGAL','MANAGE_OBLIGATION','Manage contract obligations','Create and maintain owned contract duties without independently waiving them.','HIGH',true,true,true),
 ('legal.obligation.review','LEGAL','REVIEW_OBLIGATION','Review contract obligations','Independently waive, close or record exception decisions on contract obligations.','CRITICAL',true,true,true)
on conflict(code) do update set module=excluded.module,action=excluded.action,label=excluded.label,description=excluded.description,sensitivity=excluded.sensitivity,high_risk=excluded.high_risk,requires_managed_device=excluded.requires_managed_device,active=true;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type) values
 ('LEGAL_COUNSEL','legal.obligation.read','ALLOW','COMPANY'),
 ('LEGAL_COUNSEL','legal.obligation.manage','ALLOW','COMPANY'),
 ('LEGAL_COUNSEL','legal.obligation.review','ALLOW','COMPANY'),
 ('OPERATIONS_MANAGER','legal.obligation.read','ALLOW','COMPANY'),
 ('OPERATIONS_MANAGER','legal.obligation.manage','ALLOW','COMPANY'),
 ('CS_SECRETARIAL','legal.obligation.read','ALLOW','COMPANY'),
 ('FINANCE_MANAGER','legal.obligation.read','ALLOW','COMPANY'),
 ('AUDITOR_READONLY','legal.obligation.read','ALLOW','COMPANY')
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

create sequence if not exists public.office_contract_obligation_seq;
grant usage,select on sequence public.office_contract_obligation_seq to service_role;

create table if not exists public.office_contract_obligations(
 id uuid primary key default gen_random_uuid(),
 obligation_code text not null unique default ('KR-OBL-'||lpad(nextval('public.office_contract_obligation_seq')::text,7,'0')),
 contract_id varchar not null references public.contracts(id) on delete restrict,
 obligation_type text not null check(obligation_type in ('PAYMENT','SLA','NOTICE','RENEWAL','SECURITY','PRIVACY','REPORTING','INSURANCE','DATA','DELIVERY','SUPPORT','OTHER')),
 title text not null check(char_length(trim(title)) between 3 and 220),
 description text not null check(char_length(trim(description)) between 3 and 10000),
 owner_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 cadence text not null default 'ONCE' check(cadence in ('ONCE','MONTHLY','QUARTERLY','ANNUAL','ONGOING')),
 next_due_at timestamptz,
 evidence_required boolean not null default true,
 status text not null default 'ACTIVE' check(status in ('ACTIVE','PAUSED','CLOSED','CANCELLED')),
 source_clause_reference text,
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 reviewed_by uuid references public.office_identity_users(user_id) on delete restrict,
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists office_contract_obligations_contract_idx on public.office_contract_obligations(contract_id,status,next_due_at);
create index if not exists office_contract_obligations_owner_idx on public.office_contract_obligations(owner_user_id,status,next_due_at);

create table if not exists public.office_contract_obligation_events(
 id bigint generated always as identity primary key,
 obligation_id uuid not null references public.office_contract_obligations(id) on delete restrict,
 actor_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 event_type text not null check(event_type in ('CREATED','SATISFIED','WAIVED','EXCEPTION','PAUSED','RESUMED','CLOSED','CANCELLED','NOTE')),
 due_at timestamptz,
 evidence_reference text,
 note text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists office_contract_obligation_events_obligation_idx on public.office_contract_obligation_events(obligation_id,created_at desc);

alter table public.office_contract_obligations enable row level security;
alter table public.office_contract_obligation_events enable row level security;
revoke all on public.office_contract_obligations,public.office_contract_obligation_events from public,anon,authenticated;
grant select,insert,update on public.office_contract_obligations to service_role;
grant select,insert on public.office_contract_obligation_events to service_role;

create or replace function public.office_contract_obligation_next_due(p_due timestamptz,p_cadence text)
returns timestamptz
language sql
immutable
set search_path=''
as $$
 select case upper(trim(p_cadence))
  when 'MONTHLY' then p_due+interval '1 month'
  when 'QUARTERLY' then p_due+interval '3 months'
  when 'ANNUAL' then p_due+interval '1 year'
  when 'ONGOING' then null
  else null
 end
$$;

create or replace function public.office_contract_obligation_create(
 p_actor uuid,p_contract varchar,p_type text,p_title text,p_description text,p_owner uuid,p_cadence text,p_due timestamptz,p_evidence_required boolean,p_clause text
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_id uuid; v_type text:=upper(trim(p_type)); v_cadence text:=upper(trim(coalesce(p_cadence,'ONCE')));
begin
 if not public.office_effective_permission(p_actor,'legal.obligation.manage','COMPANY',null,null) then raise exception 'Contract obligation management permission is required'; end if;
 if not exists(select 1 from public.contracts where id=p_contract) then raise exception 'Contract not found'; end if;
 if not exists(select 1 from public.office_identity_users where user_id=p_owner and status='ACTIVE') then raise exception 'Active obligation owner is required'; end if;
 if v_type not in ('PAYMENT','SLA','NOTICE','RENEWAL','SECURITY','PRIVACY','REPORTING','INSURANCE','DATA','DELIVERY','SUPPORT','OTHER') then raise exception 'Invalid obligation type'; end if;
 if v_cadence not in ('ONCE','MONTHLY','QUARTERLY','ANNUAL','ONGOING') then raise exception 'Invalid obligation cadence'; end if;
 if v_cadence<>'ONGOING' and p_due is null then raise exception 'Due date is required for scheduled obligations'; end if;
 insert into public.office_contract_obligations(contract_id,obligation_type,title,description,owner_user_id,cadence,next_due_at,evidence_required,source_clause_reference,created_by)
 values(p_contract,v_type,trim(p_title),trim(p_description),p_owner,v_cadence,p_due,coalesce(p_evidence_required,true),nullif(trim(coalesce(p_clause,'')),''),p_actor)
 returning id into v_id;
 insert into public.office_contract_obligation_events(obligation_id,actor_user_id,event_type,due_at,metadata)
 values(v_id,p_actor,'CREATED',p_due,jsonb_build_object('contract_id',p_contract,'owner_user_id',p_owner,'cadence',v_cadence));
 return v_id;
end;
$$;

create or replace function public.office_contract_obligation_satisfy(
 p_actor uuid,p_obligation uuid,p_evidence text,p_note text
) returns text
language plpgsql
security definer
set search_path=''
as $$
declare o public.office_contract_obligations%rowtype; next_due timestamptz; next_status text;
begin
 select * into o from public.office_contract_obligations where id=p_obligation for update;
 if o.id is null or o.status<>'ACTIVE' then raise exception 'Active contract obligation is required'; end if;
 if p_actor<>o.owner_user_id and not public.office_effective_permission(p_actor,'legal.obligation.manage','COMPANY',null,null) then
  raise exception 'Obligation ownership or management permission is required';
 end if;
 if o.evidence_required and nullif(trim(coalesce(p_evidence,'')),'') is null then raise exception 'Fulfillment evidence is required'; end if;
 next_due:=case when o.next_due_at is null then null else public.office_contract_obligation_next_due(o.next_due_at,o.cadence) end;
 next_status:=case when o.cadence='ONCE' then 'CLOSED' else 'ACTIVE' end;
 update public.office_contract_obligations set
  next_due_at=next_due,
  status=next_status,
  updated_at=now()
 where id=o.id;
 insert into public.office_contract_obligation_events(obligation_id,actor_user_id,event_type,due_at,evidence_reference,note,metadata)
 values(o.id,p_actor,'SATISFIED',o.next_due_at,nullif(trim(coalesce(p_evidence,'')),''),nullif(trim(coalesce(p_note,'')),''),jsonb_build_object('next_due_at',next_due,'next_status',next_status));
 return next_status;
end;
$$;

create or replace function public.office_contract_obligation_review(
 p_actor uuid,p_obligation uuid,p_action text,p_evidence text,p_note text
) returns text
language plpgsql
security definer
set search_path=''
as $$
declare o public.office_contract_obligations%rowtype; act text:=upper(trim(p_action)); next_due timestamptz; next_status text;
begin
 if not public.office_effective_permission(p_actor,'legal.obligation.review','COMPANY',null,null) then raise exception 'Independent contract obligation review permission is required'; end if;
 select * into o from public.office_contract_obligations where id=p_obligation for update;
 if o.id is null or o.status not in ('ACTIVE','PAUSED') then raise exception 'Open contract obligation is required'; end if;
 if p_actor=o.owner_user_id or p_actor=o.created_by then raise exception 'Obligation owner/creator cannot independently waive or close the same obligation'; end if;
 if act not in ('WAIVE','EXCEPTION','PAUSE','RESUME','CLOSE','CANCEL') then raise exception 'Invalid obligation review action'; end if;
 if act in ('WAIVE','EXCEPTION','CLOSE','CANCEL') and nullif(trim(coalesce(p_note,'')),'') is null then raise exception 'Review note is required'; end if;
 if act in ('WAIVE','EXCEPTION','CLOSE') and nullif(trim(coalesce(p_evidence,'')),'') is null then raise exception 'Review evidence is required'; end if;
 if act='RESUME' and o.status<>'PAUSED' then raise exception 'Only paused obligation can be resumed'; end if;
 if act='PAUSE' and o.status<>'ACTIVE' then raise exception 'Only active obligation can be paused'; end if;
 next_due:=o.next_due_at;
 next_status:=o.status;
 if act='WAIVE' then
  next_due:=case when o.next_due_at is null then null else public.office_contract_obligation_next_due(o.next_due_at,o.cadence) end;
  next_status:=case when o.cadence='ONCE' then 'CLOSED' else 'ACTIVE' end;
 elsif act='PAUSE' then next_status:='PAUSED';
 elsif act='RESUME' then next_status:='ACTIVE';
 elsif act='CLOSE' then next_status:='CLOSED';
 elsif act='CANCEL' then next_status:='CANCELLED';
 end if;
 update public.office_contract_obligations set status=next_status,next_due_at=next_due,reviewed_by=p_actor,reviewed_at=now(),updated_at=now() where id=o.id;
 insert into public.office_contract_obligation_events(obligation_id,actor_user_id,event_type,due_at,evidence_reference,note,metadata)
 values(o.id,p_actor,case act when 'WAIVE' then 'WAIVED' when 'EXCEPTION' then 'EXCEPTION' when 'PAUSE' then 'PAUSED' when 'RESUME' then 'RESUMED' when 'CLOSE' then 'CLOSED' else 'CANCELLED' end,
 o.next_due_at,nullif(trim(coalesce(p_evidence,'')),''),nullif(trim(coalesce(p_note,'')),''),jsonb_build_object('previous_status',o.status,'new_status',next_status,'next_due_at',next_due));
 return next_status;
end;
$$;

revoke all on function public.office_contract_obligation_next_due(timestamptz,text) from public,anon,authenticated;
revoke all on function public.office_contract_obligation_create(uuid,varchar,text,text,text,uuid,text,timestamptz,boolean,text) from public,anon,authenticated;
revoke all on function public.office_contract_obligation_satisfy(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.office_contract_obligation_review(uuid,uuid,text,text,text) from public,anon,authenticated;

grant execute on function public.office_contract_obligation_next_due(timestamptz,text) to service_role;
grant execute on function public.office_contract_obligation_create(uuid,varchar,text,text,text,uuid,text,timestamptz,boolean,text) to service_role;
grant execute on function public.office_contract_obligation_satisfy(uuid,uuid,text,text) to service_role;
grant execute on function public.office_contract_obligation_review(uuid,uuid,text,text,text) to service_role;
