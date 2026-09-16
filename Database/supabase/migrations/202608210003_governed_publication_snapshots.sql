-- Phase 5B: preserve a currently published public revision while an editor
-- prepares the next private revision. No business records are seeded.
-- Apply after 202608210002_public_corporate_facts.sql.

create table public.content_publications (
  content_id uuid primary key references public.content_records(id) on delete restrict,
  version integer not null check (version > 0),
  state text not null default 'PUBLISHED' check (state in ('PUBLISHED', 'ARCHIVED')),
  snapshot jsonb not null,
  published_at timestamptz not null default now(),
  published_by uuid references public.profiles(id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index content_publications_public_idx on public.content_publications(published_at desc) where state = 'PUBLISHED';

-- Existing public records become the first durable public snapshot. The source
-- record remains governed by its existing history and RLS rules.
insert into public.content_publications (content_id, version, state, snapshot, published_at, published_by, created_at, updated_at)
select id, version, 'PUBLISHED', to_jsonb(content_records), coalesce(published_at, now()), approved_by, now(), now()
from public.content_records
where status = 'PUBLISHED' and visibility = 'PUBLIC'
on conflict (content_id) do nothing;

alter table public.content_publications enable row level security;

create policy "content publications public read" on public.content_publications
for select using (state = 'PUBLISHED');

create policy "content publications authorised read" on public.content_publications
for select to authenticated
using (public.content_can_read_private(content_id));

create policy "content publishers manage public snapshots" on public.content_publications
for all to authenticated
using (public.content_can_publish())
with check (public.content_can_publish());

-- A content editor may turn a published record into a private revision draft.
-- The last approved public snapshot remains available until a publisher replaces
-- or archives it through the application workflow.
create policy "content editor begins governed revision" on public.content_records
for update to authenticated
using (public.content_can_edit() and status = 'PUBLISHED')
with check (public.content_can_edit() and status = 'DRAFT' and visibility = 'PRIVATE');

create or replace function public.content_publications_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger content_publications_touch
before update on public.content_publications
for each row execute function public.content_publications_touch();
-- Critical revision/publication transitions run atomically. Server actions also
-- enforce Kravia MFA/capability checks before calling these functions.
create or replace function public.revise_content_record(
  p_content_id uuid,
  p_content_type text,
  p_slug text,
  p_title text,
  p_summary text,
  p_body jsonb,
  p_category text,
  p_author_name text,
  p_seo jsonb,
  p_change_summary text,
  p_materiality text
) returns public.content_records
language plpgsql
security definer
set search_path = public
as $$
declare
  current_record public.content_records%rowtype;
  revised_record public.content_records%rowtype;
  next_version integer;
begin
  if not public.content_can_edit() then raise exception 'Content editing is not authorised.'; end if;
  if p_materiality not in ('EDITORIAL', 'MINOR', 'MATERIAL', 'LEGAL_POLICY', 'CORPORATE_FACT') then raise exception 'Invalid change materiality.'; end if;
  select * into current_record from public.content_records where id = p_content_id for update;
  if not found then raise exception 'Content record not found.'; end if;
  if current_record.status not in ('DRAFT', 'CHANGES_REQUESTED') then raise exception 'Open a governed revision before editing this record.'; end if;
  next_version := current_record.version + 1;
  update public.content_records
  set content_type = p_content_type, slug = p_slug, title = p_title, summary = p_summary, body = p_body,
      category = p_category, author_name = p_author_name, seo = p_seo, status = 'DRAFT', visibility = 'PRIVATE',
      version = next_version, updated_by = auth.uid()
  where id = p_content_id
  returning * into revised_record;
  insert into public.content_versions (content_id, version, snapshot, change_summary, materiality, created_by)
  values (revised_record.id, next_version, to_jsonb(revised_record), p_change_summary, p_materiality, auth.uid());
  return revised_record;
end;
$$;

create or replace function public.publish_content_snapshot(p_content_id uuid, p_scheduled_for timestamptz default null)
returns public.content_records
language plpgsql
security definer
set search_path = public
as $$
declare
  current_record public.content_records%rowtype;
  published_record public.content_records%rowtype;
begin
  if not public.content_can_publish() then raise exception 'Content publishing is not authorised.'; end if;
  select * into current_record from public.content_records where id = p_content_id for update;
  if not found or current_record.status <> 'APPROVED' then raise exception 'Only approved content can be scheduled or published.'; end if;
  if p_scheduled_for is not null and p_scheduled_for > now() then
    update public.content_records set status = 'SCHEDULED', visibility = 'PUBLIC', scheduled_for = p_scheduled_for, updated_by = auth.uid()
    where id = p_content_id returning * into published_record;
    insert into public.content_publication_events (content_id, event_type) values (p_content_id, 'SCHEDULED');
    return published_record;
  end if;
  update public.content_records set status = 'PUBLISHED', visibility = 'PUBLIC', scheduled_for = null, published_at = now(), approved_by = auth.uid(), updated_by = auth.uid()
  where id = p_content_id returning * into published_record;
  insert into public.content_publications (content_id, version, state, snapshot, published_at, published_by, archived_at, archived_by)
  values (published_record.id, published_record.version, 'PUBLISHED', to_jsonb(published_record), published_record.published_at, auth.uid(), null, null)
  on conflict (content_id) do update set version = excluded.version, state = excluded.state, snapshot = excluded.snapshot,
    published_at = excluded.published_at, published_by = excluded.published_by, archived_at = null, archived_by = null;
  insert into public.content_publication_events (content_id, event_type) values (p_content_id, 'PUBLISHED');
  return published_record;
end;
$$;

create or replace function public.archive_content_snapshot(p_content_id uuid, p_reason text)
returns public.content_records
language plpgsql
security definer
set search_path = public
as $$
declare
  current_record public.content_records%rowtype;
  archived_record public.content_records%rowtype;
begin
  if not public.content_can_publish() then raise exception 'Content archiving is not authorised.'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'An archive reason is required.'; end if;
  select * into current_record from public.content_records where id = p_content_id for update;
  if not found or current_record.status = 'ARCHIVED' then raise exception 'This content cannot be archived.'; end if;
  if current_record.status = 'PUBLISHED' then
    update public.content_publications set state = 'ARCHIVED', archived_at = now(), archived_by = auth.uid()
    where content_id = p_content_id and state = 'PUBLISHED';
    if not found then raise exception 'The active public snapshot is unavailable.'; end if;
  end if;
  update public.content_records set status = 'ARCHIVED', visibility = 'PRIVATE', updated_by = auth.uid()
  where id = p_content_id returning * into archived_record;
  insert into public.content_publication_events (content_id, event_type, reason) values (p_content_id, 'ARCHIVED', p_reason);
  return archived_record;
end;
$$;

revoke all on function public.revise_content_record(uuid, text, text, text, text, jsonb, text, text, jsonb, text, text) from public;
revoke all on function public.publish_content_snapshot(uuid, timestamptz) from public;
revoke all on function public.archive_content_snapshot(uuid, text) from public;
grant execute on function public.revise_content_record(uuid, text, text, text, text, jsonb, text, text, jsonb, text, text) to authenticated;
grant execute on function public.publish_content_snapshot(uuid, timestamptz) to authenticated;
grant execute on function public.archive_content_snapshot(uuid, text) to authenticated;