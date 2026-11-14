-- Isolated Postgres-17 setup. No KRAVIA production schema is touched.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create extension if not exists pgcrypto;
create table public.office_identity_users(user_id uuid primary key,status text not null);
create table public.office_it_service_tickets(id uuid primary key,status text not null,due_at timestamptz);
create function public.office_effective_permission(
 p_actor uuid,p_permission text,p_scope text default 'COMPANY',
 p_key text default null,p_owner uuid default null
) returns boolean language sql stable as $$
 select case
   when p_actor='00000000-0000-4000-8000-000000000001'::uuid and p_permission='it.service.manage' then true
   when p_actor='00000000-0000-4000-8000-000000000002'::uuid and p_permission='it.service.read' then true
   else false end
$$;
