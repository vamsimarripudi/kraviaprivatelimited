-- Disposable PostgreSQL 17 fixture for the Office handbook.
-- NO production identity data, bank evidence or emails.
create role anon noinherit;
create role authenticated noinherit;
create role service_role noinherit bypassrls;
create extension if not exists pgcrypto;
create table public.office_identity_users (
  user_id uuid primary key, status text not null
);
grant select on public.office_identity_users to service_role;
insert into public.office_identity_users(user_id,status) values
 ('11111111-1111-4111-8111-111111111111','ACTIVE'),
 ('22222222-2222-4222-8222-222222222222','SUSPENDED');
