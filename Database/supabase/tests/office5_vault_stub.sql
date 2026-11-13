-- Ephemeral Postgres fixture for migration verification ONLY.
-- This is not a replacement for KRAVIA's canonical IAM.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create extension if not exists pgcrypto;
create table public.office_identity_users(user_id uuid primary key,status text not null);
create table public.office_company_registrations(id uuid primary key);
create table public.office_document_instances(id uuid primary key);
create table public.office_secure_custody_items(id uuid primary key);
create function public.office_effective_permission(
 p_actor uuid,p_permission text,p_scope text default 'COMPANY',
 p_key text default null,p_owner uuid default null
) returns boolean language sql stable as $$
 select p_actor='00000000-0000-4000-8000-000000000002'::uuid
  and p_permission in ('access.profile.assign','registration.review','document.instance.review')
$$;
