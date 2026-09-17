-- KRAVIA Office OS — engineering control center registry, deployment evidence and incident ledger.
-- Product IDs are logical references because the canonical product table is owned by the core application schema.

create sequence if not exists public.office_engineering_service_seq start with 1 increment by 1;
create sequence if not exists public.office_engineering_incident_seq start with 1 increment by 1;

create table if not exists public.office_engineering_services (
  id uuid primary key default gen_random_uuid(),
  service_code text not null unique default ('KR-SVC-' || lpad(nextval('public.office_engineering_service_seq')::text,6,'0')),
  product_id varchar,
  name text not null check (char_length(name) between 2 and 160),
  project_key text not null check (char_length(project_key) between 2 and 120),
  repository_key text,
  repository_provider text,
  runtime_provider text,
  runtime_service_key text,
  environment text not null default 'PRODUCTION' check (environment in ('DEVELOPMENT','PREVIEW','STAGING','PRODUCTION')),
  public_url text,
  owner_team text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','PAUSED','RETIRED')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_key,name,environment)
);
create index if not exists office_engineering_services_project_idx on public.office_engineering_services(project_key,status);
create index if not exists office_engineering_services_repository_idx on public.office_engineering_services(repository_key) where repository_key is not null;
create index if not exists office_engineering_services_product_idx on public.office_engineering_services(product_id) where product_id is not null;

create table if not exists public.office_engineering_deployments (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.office_engineering_services(id) on delete restrict,
  provider text not null,
  provider_deployment_id text,
  git_sha text,
  git_ref text,
  environment text not null check (environment in ('DEVELOPMENT','PREVIEW','STAGING','PRODUCTION')),
  status text not null check (status in ('QUEUED','BUILDING','SUCCEEDED','FAILED','CANCELLED')),
  source text not null default 'IMPORT' check (source in ('AUTOMATION','MANUAL','IMPORT')),
  initiated_by uuid references auth.users(id) on delete set null,
  deployment_url text,
  started_at timestamptz,
  finished_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists office_engineering_deployments_provider_id_idx on public.office_engineering_deployments(provider,provider_deployment_id) where provider_deployment_id is not null;
create index if not exists office_engineering_deployments_service_idx on public.office_engineering_deployments(service_id,created_at desc);

create table if not exists public.office_engineering_incidents (
  id uuid primary key default gen_random_uuid(),
  incident_code text not null unique default ('KR-INC-' || lpad(nextval('public.office_engineering_incident_seq')::text,6,'0')),
  service_id uuid not null references public.office_engineering_services(id) on delete restrict,
  severity text not null check (severity in ('SEV1','SEV2','SEV3','SEV4')),
  title text not null check (char_length(title) between 3 and 180),
  summary text not null default '' check (char_length(summary)<=6000),
  status text not null default 'OPEN' check (status in ('OPEN','MITIGATING','MONITORING','RESOLVED')),
  owner_user_id uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists office_engineering_incidents_service_idx on public.office_engineering_incidents(service_id,status,started_at desc);

create table if not exists public.office_engineering_incident_events (
  id bigint generated always as identity primary key,
  incident_id uuid not null references public.office_engineering_incidents(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('CREATED','MITIGATING','MONITORING','RESOLVED','REOPENED')),
  previous_status text,
  new_status text not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists office_engineering_incident_events_idx on public.office_engineering_incident_events(incident_id,created_at desc);

alter table public.office_engineering_services enable row level security;
alter table public.office_engineering_deployments enable row level security;
alter table public.office_engineering_incidents enable row level security;
alter table public.office_engineering_incident_events enable row level security;
revoke all on public.office_engineering_services,public.office_engineering_deployments,public.office_engineering_incidents,public.office_engineering_incident_events from anon,authenticated,public;
do $$ declare t text; begin foreach t in array array['office_engineering_services','office_engineering_deployments','office_engineering_incidents','office_engineering_incident_events'] loop execute format('drop policy if exists %I on public.%I',t||'_deny_client_access',t); execute format('create policy %I on public.%I as restrictive for all to anon,authenticated using(false) with check(false)',t||'_deny_client_access',t); end loop; end $$;

create or replace function public.office_engineering_touch() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at:=now(); return new; end; $$;
drop trigger if exists office_engineering_services_touch on public.office_engineering_services;
create trigger office_engineering_services_touch before update on public.office_engineering_services for each row execute function public.office_engineering_touch();
drop trigger if exists office_engineering_incidents_touch on public.office_engineering_incidents;
create trigger office_engineering_incidents_touch before update on public.office_engineering_incidents for each row execute function public.office_engineering_touch();

create or replace function public.office_engineering_incident_events_immutable() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'KRAVIA Office incident events are immutable'; end; $$;
drop trigger if exists office_engineering_incident_events_guard on public.office_engineering_incident_events;
create trigger office_engineering_incident_events_guard before update or delete on public.office_engineering_incident_events for each row execute function public.office_engineering_incident_events_immutable();

create or replace function public.office_engineering_register_service(
  p_actor uuid,p_product varchar,p_name text,p_project text,p_repository text,p_repository_provider text,p_runtime_provider text,p_runtime_service text,p_environment text,p_public_url text,p_owner_team text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if not exists(select 1 from public.office_identity_users where user_id=p_actor and status='ACTIVE') then raise exception 'Actor is not active'; end if;
  insert into public.office_engineering_services(product_id,name,project_key,repository_key,repository_provider,runtime_provider,runtime_service_key,environment,public_url,owner_team,created_by)
  values(p_product,trim(p_name),trim(p_project),nullif(trim(coalesce(p_repository,'')),''),nullif(trim(coalesce(p_repository_provider,'')),''),nullif(trim(coalesce(p_runtime_provider,'')),''),nullif(trim(coalesce(p_runtime_service,'')),''),p_environment,nullif(trim(coalesce(p_public_url,'')),''),nullif(trim(coalesce(p_owner_team,'')),''),p_actor)
  returning id into v_id;
  return v_id;
end; $$;

create or replace function public.office_engineering_create_incident(p_actor uuid,p_service uuid,p_severity text,p_title text,p_summary text,p_owner uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if not exists(select 1 from public.office_engineering_services where id=p_service and status<>'RETIRED') then raise exception 'Engineering service not found'; end if;
  if p_severity not in ('SEV1','SEV2','SEV3','SEV4') then raise exception 'Invalid severity'; end if;
  insert into public.office_engineering_incidents(service_id,severity,title,summary,owner_user_id,created_by)
  values(p_service,p_severity,trim(p_title),coalesce(p_summary,''),p_owner,p_actor) returning id into v_id;
  insert into public.office_engineering_incident_events(incident_id,actor_user_id,action,new_status,note) values(v_id,p_actor,'CREATED','OPEN','Incident created');
  return v_id;
end; $$;

create or replace function public.office_engineering_transition_incident(p_actor uuid,p_incident uuid,p_action text,p_note text default null)
returns text language plpgsql security definer set search_path='' as $$
declare v public.office_engineering_incidents%rowtype; v_new text; v_event text;
begin
  select * into v from public.office_engineering_incidents where id=p_incident for update;
  if v.id is null then raise exception 'Incident not found'; end if;
  case p_action when 'MITIGATE' then v_new:='MITIGATING';v_event:='MITIGATING'; when 'MONITOR' then v_new:='MONITORING';v_event:='MONITORING'; when 'RESOLVE' then v_new:='RESOLVED';v_event:='RESOLVED'; when 'REOPEN' then v_new:='OPEN';v_event:='REOPENED'; else raise exception 'Invalid incident action'; end case;
  update public.office_engineering_incidents set status=v_new,resolved_at=case when v_new='RESOLVED' then now() when v_new='OPEN' then null else resolved_at end where id=p_incident;
  insert into public.office_engineering_incident_events(incident_id,actor_user_id,action,previous_status,new_status,note) values(p_incident,p_actor,v_event,v.status,v_new,nullif(trim(coalesce(p_note,'')),''));
  return v_new;
end; $$;

revoke all on function public.office_engineering_register_service(uuid,varchar,text,text,text,text,text,text,text,text,text) from anon,authenticated,public;
revoke all on function public.office_engineering_create_incident(uuid,uuid,text,text,text,uuid) from anon,authenticated,public;
revoke all on function public.office_engineering_transition_incident(uuid,uuid,text,text) from anon,authenticated,public;
grant execute on function public.office_engineering_register_service(uuid,varchar,text,text,text,text,text,text,text,text,text) to service_role;
grant execute on function public.office_engineering_create_incident(uuid,uuid,text,text,text,uuid) to service_role;
grant execute on function public.office_engineering_transition_incident(uuid,uuid,text,text) to service_role;

comment on table public.office_engineering_deployments is 'Deployment evidence imported or recorded by trusted integrations; secret values are never stored here.';
comment on table public.office_engineering_services is 'Canonical engineering service registry linking product, repository reference and runtime reference without credentials.';
