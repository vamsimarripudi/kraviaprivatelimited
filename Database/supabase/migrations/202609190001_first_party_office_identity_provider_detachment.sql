-- Detach KRAVIA Office identity foreign keys from Supabase Auth.
--
-- The Office domain now owns its identity root in public.office_identity_users.
-- This migration is intentionally fail-closed: if any existing Office row refers
-- to an auth.users row without a matching Office identity, no constraints change.

do $$
declare
  r record;
  missing_count bigint;
  on_delete_clause text;
  on_update_clause text;
  deferrability_clause text;
begin
  if to_regclass('public.office_identity_users') is null then
    raise exception 'office_identity_users is required before detaching Office foreign keys from auth.users';
  end if;

  for r in
    select
      ns.nspname as schema_name,
      rel.relname as table_name,
      con.conname,
      att.attname as column_name,
      con.confdeltype,
      con.confupdtype,
      con.condeferrable,
      con.condeferred
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    join unnest(con.conkey) with ordinality ck(attnum, ordinality) on true
    join pg_attribute att
      on att.attrelid = rel.oid
     and att.attnum = ck.attnum
    where con.contype = 'f'
      and con.confrelid = 'auth.users'::regclass
      and ns.nspname = 'public'
      and left(rel.relname, 7) = 'office_'
      and array_length(con.conkey, 1) = 1
  loop
    execute format(
      'select count(*) from %I.%I t where t.%I is not null and not exists (select 1 from public.office_identity_users i where i.user_id = t.%I)',
      r.schema_name,
      r.table_name,
      r.column_name,
      r.column_name
    )
    into missing_count;

    if missing_count > 0 then
      raise exception
        'Cannot detach %.% constraint %: % row(s) reference auth.users without an office_identity_users row',
        r.table_name,
        r.column_name,
        r.conname,
        missing_count;
    end if;
  end loop;

  for r in
    select
      ns.nspname as schema_name,
      rel.relname as table_name,
      con.conname,
      att.attname as column_name,
      con.confdeltype,
      con.confupdtype,
      con.condeferrable,
      con.condeferred
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    join unnest(con.conkey) with ordinality ck(attnum, ordinality) on true
    join pg_attribute att
      on att.attrelid = rel.oid
     and att.attnum = ck.attnum
    where con.contype = 'f'
      and con.confrelid = 'auth.users'::regclass
      and ns.nspname = 'public'
      and left(rel.relname, 7) = 'office_'
      and array_length(con.conkey, 1) = 1
    order by rel.relname, con.conname
  loop
    execute format(
      'alter table %I.%I drop constraint %I',
      r.schema_name,
      r.table_name,
      r.conname
    );

    if r.table_name = 'office_identity_users' and r.column_name = 'user_id' then
      continue;
    end if;

    on_delete_clause := case r.confdeltype
      when 'c' then 'CASCADE'
      when 'n' then 'SET NULL'
      when 'd' then 'SET DEFAULT'
      when 'r' then 'RESTRICT'
      else 'NO ACTION'
    end;

    on_update_clause := case r.confupdtype
      when 'c' then 'CASCADE'
      when 'n' then 'SET NULL'
      when 'd' then 'SET DEFAULT'
      when 'r' then 'RESTRICT'
      else 'NO ACTION'
    end;

    deferrability_clause :=
      case
        when r.condeferrable and r.condeferred then ' DEFERRABLE INITIALLY DEFERRED'
        when r.condeferrable then ' DEFERRABLE INITIALLY IMMEDIATE'
        else ' NOT DEFERRABLE'
      end;

    execute format(
      'alter table %I.%I add constraint %I foreign key (%I) references public.office_identity_users(user_id) on update %s on delete %s%s',
      r.schema_name,
      r.table_name,
      r.conname,
      r.column_name,
      on_update_clause,
      on_delete_clause,
      deferrability_clause
    );
  end loop;
end
$$;

comment on table public.office_identity_users is
  'Canonical KRAVIA Office identity root. Provider-independent as of first-party Office authentication cutover.';
