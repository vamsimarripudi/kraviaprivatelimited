-- KRAVIA Office OS — permanent company identity foundation.
-- Person identity is permanent. Employment relationships are effective-dated and ended, never deleted.

create sequence if not exists public.office_person_code_seq start with 1 increment by 1 no cycle;
create sequence if not exists public.office_employment_code_seq start with 1 increment by 1 no cycle;

create or replace function public.office_next_person_code() returns text
language sql volatile set search_path=''
as $$ select 'KR-P-' || lpad(nextval('public.office_person_code_seq')::text, 6, '0') $$;

create or replace function public.office_next_employment_code() returns text
language sql volatile set search_path=''
as $$ select 'KR-E-' || lpad(nextval('public.office_employment_code_seq')::text, 6, '0') $$;

create table if not exists public.office_people_registry (
  person_id uuid primary key default gen_random_uuid(),
  person_code text not null unique default public.office_next_person_code(),
  identity_user_id uuid not null unique references public.office_identity_users(user_id) on delete restrict,
  lifecycle_status text not null default 'ACTIVE' check (lifecycle_status in ('ACTIVE','INACTIVE','ARCHIVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint office_person_code_format check (person_code ~ '^KR-P-[0-9]{6,}$')
);

create table if not exists public.office_employment_registry (
  employment_id uuid primary key default gen_random_uuid(),
  employment_code text not null unique default public.office_next_employment_code(),
  person_id uuid not null references public.office_people_registry(person_id) on delete restrict,
  identity_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
  relationship_type text not null check (relationship_type in ('EMPLOYEE','CONTRACTOR','INTERN','TRAINEE','ADVISOR','PROFESSIONAL')),
  status text not null check (status in ('PLANNED','ACTIVE','ON_LEAVE','ENDED')),
  start_date date,
  end_date date,
  end_reason text check (end_reason is null or char_length(end_reason) <= 500),
  source text not null default 'JOB_ASSIGNMENT' check (source in ('JOB_ASSIGNMENT','ONBOARDING','MIGRATION','REHIRE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint office_employment_code_format check (employment_code ~ '^KR-E-[0-9]{6,}$'),
  constraint office_employment_dates check (end_date is null or start_date is null or end_date >= start_date)
);

create unique index if not exists office_one_open_employment_per_person
  on public.office_employment_registry(person_id)
  where status in ('PLANNED','ACTIVE','ON_LEAVE');
create index if not exists office_employment_identity_idx on public.office_employment_registry(identity_user_id,created_at desc);
create index if not exists office_employment_person_idx on public.office_employment_registry(person_id,created_at desc);

alter table public.office_people_registry enable row level security;
alter table public.office_employment_registry enable row level security;
revoke all on public.office_people_registry,public.office_employment_registry from anon,authenticated,public;

drop policy if exists office_people_registry_deny_client_access on public.office_people_registry;
create policy office_people_registry_deny_client_access on public.office_people_registry as restrictive for all to anon,authenticated using(false) with check(false);
drop policy if exists office_employment_registry_deny_client_access on public.office_employment_registry;
create policy office_employment_registry_deny_client_access on public.office_employment_registry as restrictive for all to anon,authenticated using(false) with check(false);

create or replace function public.office_protect_permanent_identity() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' then raise exception 'KRAVIA permanent identity records cannot be deleted'; end if;
  if tg_table_name='office_people_registry' and (new.person_id is distinct from old.person_id or new.person_code is distinct from old.person_code or new.identity_user_id is distinct from old.identity_user_id) then
    raise exception 'KRAVIA Person ID is immutable';
  end if;
  if tg_table_name='office_employment_registry' and (new.employment_id is distinct from old.employment_id or new.employment_code is distinct from old.employment_code or new.person_id is distinct from old.person_id or new.identity_user_id is distinct from old.identity_user_id) then
    raise exception 'KRAVIA Employment ID is immutable';
  end if;
  new.updated_at:=now();
  return new;
end; $$;

drop trigger if exists office_people_permanent_identity_guard on public.office_people_registry;
create trigger office_people_permanent_identity_guard before update or delete on public.office_people_registry for each row execute function public.office_protect_permanent_identity();
drop trigger if exists office_employment_permanent_identity_guard on public.office_employment_registry;
create trigger office_employment_permanent_identity_guard before update or delete on public.office_employment_registry for each row execute function public.office_protect_permanent_identity();

create or replace function public.office_ensure_person_identity(p_user uuid) returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_person uuid;
begin
  select p.person_id into v_person from public.office_people_registry p where p.identity_user_id=p_user;
  if v_person is not null then return v_person; end if;
  insert into public.office_people_registry(identity_user_id,lifecycle_status)
  values(p_user,'ACTIVE')
  on conflict(identity_user_id) do update set lifecycle_status=case when public.office_people_registry.lifecycle_status='ARCHIVED' then 'ARCHIVED' else 'ACTIVE' end
  returning person_id into v_person;
  return v_person;
end; $$;

create or replace function public.office_identity_create_person() returns trigger
language plpgsql security definer set search_path=''
as $$ begin perform public.office_ensure_person_identity(new.user_id); return new; end; $$;
drop trigger if exists office_identity_create_person_guard on public.office_identity_users;
create trigger office_identity_create_person_guard after insert on public.office_identity_users for each row execute function public.office_identity_create_person();

create or replace function public.office_sync_employment_identity() returns trigger
language plpgsql security definer set search_path=''
as $$
declare
  v_person uuid;
  v_current public.office_employment_registry%rowtype;
begin
  v_person:=public.office_ensure_person_identity(new.user_id);
  select * into v_current from public.office_employment_registry e
  where e.person_id=v_person and e.status in ('PLANNED','ACTIVE','ON_LEAVE')
  order by e.created_at desc limit 1 for update;

  if new.status in ('PLANNED','ACTIVE','ON_LEAVE') then
    if v_current.employment_id is null then
      insert into public.office_employment_registry(person_id,identity_user_id,relationship_type,status,start_date,end_date,source)
      values(v_person,new.user_id,new.employment_type,new.status,new.start_date,new.end_date,'JOB_ASSIGNMENT');
    else
      update public.office_employment_registry set relationship_type=new.employment_type,status=new.status,start_date=coalesce(new.start_date,start_date),end_date=new.end_date,end_reason=null
      where employment_id=v_current.employment_id;
    end if;
  elsif new.status='ENDED' then
    if v_current.employment_id is not null then
      update public.office_employment_registry set status='ENDED',end_date=coalesce(new.end_date,current_date),end_reason=coalesce(end_reason,'Job assignment ended') where employment_id=v_current.employment_id;
    else
      insert into public.office_employment_registry(person_id,identity_user_id,relationship_type,status,start_date,end_date,end_reason,source)
      values(v_person,new.user_id,new.employment_type,'ENDED',new.start_date,coalesce(new.end_date,current_date),'Migrated ended job assignment','MIGRATION');
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists office_job_sync_employment_identity on public.office_job_assignments;
create trigger office_job_sync_employment_identity after insert or update of employment_type,status,start_date,end_date on public.office_job_assignments for each row execute function public.office_sync_employment_identity();

insert into public.office_people_registry(identity_user_id,lifecycle_status)
select i.user_id,case when i.status='REVOKED' then 'INACTIVE' else 'ACTIVE' end
from public.office_identity_users i
where not exists(select 1 from public.office_people_registry p where p.identity_user_id=i.user_id)
on conflict(identity_user_id) do nothing;

insert into public.office_employment_registry(person_id,identity_user_id,relationship_type,status,start_date,end_date,end_reason,source)
select p.person_id,j.user_id,j.employment_type,j.status,j.start_date,j.end_date,case when j.status='ENDED' then 'Migrated ended job assignment' else null end,'MIGRATION'
from public.office_job_assignments j
join public.office_people_registry p on p.identity_user_id=j.user_id
where not exists(select 1 from public.office_employment_registry e where e.identity_user_id=j.user_id and e.status in ('PLANNED','ACTIVE','ON_LEAVE'))
  and not exists(select 1 from public.office_employment_registry e where e.identity_user_id=j.user_id and e.status='ENDED' and j.status='ENDED')
on conflict do nothing;

create or replace function public.office_current_company_identity(p_user uuid) returns jsonb
language sql stable security definer set search_path=''
as $$
  select jsonb_build_object(
    'person_id',p.person_id,'person_code',p.person_code,'person_status',p.lifecycle_status,
    'employment_id',e.employment_id,'employment_code',e.employment_code,'employment_type',e.relationship_type,
    'employment_status',e.status,'start_date',e.start_date,'end_date',e.end_date
  )
  from public.office_people_registry p
  left join lateral (
    select x.* from public.office_employment_registry x where x.person_id=p.person_id
    order by (x.status in ('ACTIVE','ON_LEAVE','PLANNED')) desc,x.created_at desc limit 1
  ) e on true
  where p.identity_user_id=p_user
$$;

revoke all on function public.office_ensure_person_identity(uuid) from anon,authenticated,public;
revoke all on function public.office_current_company_identity(uuid) from anon,authenticated,public;
grant execute on function public.office_current_company_identity(uuid) to service_role;

comment on table public.office_people_registry is 'Permanent KRAVIA Person identity. Never delete on exit; revoke access and end relationships instead.';
comment on table public.office_employment_registry is 'Versioned KRAVIA employment/professional relationship identities. Ended relationships remain historical evidence.';
