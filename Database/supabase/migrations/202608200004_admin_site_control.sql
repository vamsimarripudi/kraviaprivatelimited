-- Phase 5B site-control layer. Public form presentation is governed separately from private request data and routing.
-- No company facts, forms, requests, articles or sample data are seeded by this migration.

create table public.public_form_settings (
  form_key text primary key check (form_key in ('CONTACT','SUPPORT','TRUST_REQUEST')),
  title text check (title is null or char_length(title) <= 140),
  intro text check (intro is null or char_length(intro) <= 600),
  submit_label text check (submit_label is null or char_length(submit_label) <= 80),
  success_heading text check (success_heading is null or char_length(success_heading) <= 140),
  success_message text check (success_message is null or char_length(success_message) <= 600),
  is_enabled boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.public_form_settings enable row level security;

create or replace function public.can_manage_public_site_content() returns boolean language sql stable security definer set search_path = public as $$
  select public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','SYSTEM_ADMIN','CONTENT_EDITOR']::public.corporate_role[])
$$;
revoke all on function public.can_manage_public_site_content() from public;
grant execute on function public.can_manage_public_site_content() to authenticated;

-- Rows are intentionally limited to public presentation copy; anonymous read never grants access to support cases or routing metadata.
create policy "public form settings visible when enabled" on public.public_form_settings for select using (is_enabled = true);
create policy "public form settings managers read" on public.public_form_settings for select to authenticated using (public.can_manage_public_site_content());
create policy "public form settings managers create" on public.public_form_settings for insert to authenticated with check (public.can_manage_public_site_content() and updated_by = auth.uid());
create policy "public form settings managers update" on public.public_form_settings for update to authenticated using (public.can_manage_public_site_content()) with check (public.can_manage_public_site_content() and updated_by = auth.uid());

create or replace function public.public_form_settings_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger public_form_settings_touch before update on public.public_form_settings for each row execute function public.public_form_settings_touch();

-- Admin console navigation is also internal Corporate Office activity. Public-site visitors are never tracked here.
do $$
declare v_name text;
begin
  for v_name in
    select conname from pg_constraint
    where conrelid = 'public.corporate_access_events'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%event_type%'
      and pg_get_constraintdef(oid) like '%path%'
  loop
    execute format('alter table public.corporate_access_events drop constraint %I', v_name);
  end loop;
end $$;
alter table public.corporate_access_events add constraint corporate_access_events_path_check
  check ((event_type = 'SIGNED_IN' and path is null) or (event_type = 'PAGE_VIEWED' and (path like '/corporate/%' or path = '/admin' or path like '/admin/%')));
