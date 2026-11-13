-- Disposable PostgreSQL integration fixture only, never production.
do $fixture$
begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end;
$fixture$;
create table public.office_employee_intake_profiles (
  employee_user_id uuid primary key,
  legal_name text,
  status text not null default 'DRAFT'
);
alter table public.office_employee_intake_profiles enable row level security;
insert into public.office_employee_intake_profiles(employee_user_id,legal_name)
values ('a0000000-0000-4000-8000-000000000001','Synthetic isolated CI record');
