-- KRAVIA Office FastAPI service-table hardening.
-- Reconciles Alembic v6-v9 tables with the dedicated production backend role.
-- Safe to reapply: ownership/RLS/revokes are idempotent, and missing objects are skipped.

do $$
declare
  object_name text;
begin
  if exists (select 1 from pg_roles where rolname = 'kravia_office_backend') then
    foreach object_name in array array[
      'worker_heartbeats',
      'audit_retention_policies',
      'audit_legal_holds',
      'audit_archive_manifests',
      'shared_rate_limit_windows'
    ]
    loop
      if to_regclass(format('public.%I', object_name)) is not null then
        execute format('alter table public.%I owner to kravia_office_backend', object_name);
        execute format('alter table public.%I enable row level security', object_name);
        execute format('revoke all on table public.%I from anon, authenticated', object_name);
      end if;
    end loop;
  end if;
end
$$;
