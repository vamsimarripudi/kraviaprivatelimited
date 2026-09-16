-- Phase 3: governed Corporate Office. Apply through the Supabase migration pipeline, never manually in production.
-- This migration deliberately creates no real corporate, filing or Board data.


create type public.document_classification as enum ('PUBLIC','INTERNAL','CONFIDENTIAL','HIGHLY_CONFIDENTIAL','DIRECTORS_ONLY','PROFESSIONAL_ASSIGNED');
create type public.meeting_lifecycle_status as enum ('PROPOSED','SCHEDULED','NOTICE_PREPARATION','NOTICE_ISSUED','AGENDA_OPEN','MEETING_IN_PROGRESS','MEETING_CONCLUDED','MINUTES_DRAFTING','MINUTES_REVIEW','MINUTES_FINALISATION','CLOSED');
create type public.review_status as enum ('DRAFT','INTERNAL_REVIEW','PROFESSIONAL_REVIEW','CHANGES_REQUESTED','APPROVED','REJECTED','CANCELLED','LOCKED');
create type public.compliance_status as enum ('DRAFT','INTERNAL_REVIEW','PROFESSIONAL_REVIEW','APPROVED','READY_TO_FILE','FILED_EVIDENCE_REQUIRED','ACKNOWLEDGED','COMPLETED','OVERDUE','NOT_APPLICABLE');
create type public.approval_status as enum ('REQUESTED','ASSIGNED','IN_REVIEW','CHANGES_REQUESTED','APPROVED','REJECTED','CANCELLED');

alter table public.profiles add column if not exists is_active boolean not null default true;
alter table public.profiles add column if not exists access_expires_at timestamptz;
alter table public.profiles add column if not exists last_access_review_at timestamptz;
alter table public.board_meetings add column if not exists lifecycle_status public.meeting_lifecycle_status not null default 'PROPOSED';
alter table public.board_meetings add column if not exists internal_reference text unique;
alter table public.board_meetings add column if not exists purpose text;
alter table public.board_meetings add column if not exists expected_duration_minutes integer check (expected_duration_minutes is null or expected_duration_minutes > 0);
alter table public.board_meetings add column if not exists record_version integer not null default 1;
alter table public.corporate_documents add column if not exists category text;
alter table public.corporate_documents add column if not exists classification public.document_classification not null default 'CONFIDENTIAL';
alter table public.corporate_documents add column if not exists retention_policy_id uuid;
alter table public.corporate_documents add column if not exists current_version_id uuid;
alter table public.corporate_documents add column if not exists record_version integer not null default 1;

create table public.corporate_role_assignments (
  id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.profiles(id) on delete restrict,
  role public.corporate_role not null, scope_type text not null default 'CORPORATE', scope_id uuid,
  starts_at timestamptz not null default now(), expires_at timestamptz, assigned_by uuid references public.profiles(id) on delete set null,
  reason text, revoked_at timestamptz, revoked_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), check (expires_at is null or expires_at > starts_at)
);
create index corporate_role_assignments_active_idx on public.corporate_role_assignments(profile_id, role, expires_at) where revoked_at is null;

create table public.resource_assignments (
  id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.profiles(id) on delete restrict,
  resource_type text not null, resource_id uuid not null, permission text not null default 'VIEW',
  expires_at timestamptz, assigned_by uuid references public.profiles(id) on delete set null, reason text,
  created_at timestamptz not null default now(), revoked_at timestamptz,
  unique(profile_id, resource_type, resource_id, permission)
);
create index resource_assignments_lookup_idx on public.resource_assignments(profile_id, resource_type, resource_id, expires_at) where revoked_at is null;

create table public.regulatory_sources (
  id uuid primary key default gen_random_uuid(), authority text not null check (authority in ('MCA','INDIA_CODE','ICSI','CBIC','GST','INCOME_TAX','MEITY','EGAZETTE','OTHER_OFFICIAL')),
  title text not null, section_or_rule text, notification_number text, source_url text not null,
  effective_from date, effective_to date, last_verified_at timestamptz not null, verified_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.compliance_rules (
  id uuid primary key default gen_random_uuid(), reference text not null unique, title text not null, category text not null,
  created_at timestamptz not null default now(), archived_at timestamptz
);
create table public.compliance_rule_versions (
  id uuid primary key default gen_random_uuid(), rule_id uuid not null references public.compliance_rules(id) on delete restrict,
  version integer not null, effective_from date not null, effective_to date, applicability_expression jsonb not null default '{}'::jsonb,
  trigger_definition jsonb not null default '{}'::jsonb, calculation_definition jsonb not null default '{}'::jsonb,
  source_id uuid not null references public.regulatory_sources(id) on delete restrict, professional_review_status public.review_status not null default 'DRAFT',
  reviewed_by uuid references public.profiles(id) on delete set null, reviewed_at timestamptz, change_summary text,
  created_at timestamptz not null default now(), unique(rule_id, version), check (effective_to is null or effective_to >= effective_from)
);
create index compliance_rule_versions_effective_idx on public.compliance_rule_versions(rule_id, effective_from desc);
create table public.company_applicability_profiles (
  id uuid primary key default gen_random_uuid(), key text not null, value jsonb not null, source text, effective_from date not null,
  effective_to date, reviewed_by uuid references public.profiles(id) on delete set null, last_reviewed_at timestamptz, created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);
create index company_applicability_profiles_current_idx on public.company_applicability_profiles(key, effective_from desc);
create table public.compliance_obligations (
  id uuid primary key default gen_random_uuid(), reference text not null unique, title text not null, category text not null,
  rule_version_id uuid references public.compliance_rule_versions(id) on delete restrict, financial_year text, trigger_context jsonb not null default '{}'::jsonb,
  calculated_due_date date, override_due_date date, owner_id uuid references public.profiles(id) on delete set null,
  reviewer_id uuid references public.profiles(id) on delete set null, status public.compliance_status not null default 'DRAFT',
  applicability_explanation text, calculation_explanation text, portal_reference text, completed_at timestamptz,
  record_version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index compliance_obligations_due_idx on public.compliance_obligations(status, calculated_due_date);
create table public.compliance_overrides (
  id uuid primary key default gen_random_uuid(), obligation_id uuid not null references public.compliance_obligations(id) on delete restrict,
  field_name text not null, system_value jsonb, override_value jsonb not null, reason text not null,
  source_reference text, created_by uuid not null references public.profiles(id) on delete restrict, created_at timestamptz not null default now()
);
create table public.compliance_evidence (
  id uuid primary key default gen_random_uuid(), obligation_id uuid not null references public.compliance_obligations(id) on delete restrict,
  document_id uuid references public.corporate_documents(id) on delete restrict, evidence_type text not null, reference text,
  confirmed_by uuid references public.profiles(id) on delete set null, confirmed_at timestamptz, created_at timestamptz not null default now()
);

create table public.meeting_notices (
  id uuid primary key default gen_random_uuid(), meeting_id uuid not null references public.board_meetings(id) on delete restrict,
  version integer not null default 1, status public.review_status not null default 'DRAFT', issued_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null, approved_at timestamptz, storage_document_id uuid references public.corporate_documents(id) on delete set null,
  shorter_notice boolean not null default false, shorter_notice_reason text, created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(), unique(meeting_id, version)
);
create table public.notice_deliveries (
  id uuid primary key default gen_random_uuid(), notice_id uuid not null references public.meeting_notices(id) on delete restrict,
  recipient_id uuid references public.profiles(id) on delete restrict, channel text not null, destination_masked text,
  sent_at timestamptz, provider_message_id text, delivery_status text not null default 'PENDING', delivery_evidence_document_id uuid references public.corporate_documents(id) on delete set null,
  failure_reason text, retry_count integer not null default 0, created_at timestamptz not null default now()
);
create table public.meeting_attendees (
  id uuid primary key default gen_random_uuid(), meeting_id uuid not null references public.board_meetings(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete restrict, invited boolean not null default true,
  attendance_status text not null default 'INVITED' check (attendance_status in ('INVITED','ATTENDING','ABSENT','LEAVE_OF_ABSENCE')),
  mode text, joined_at timestamptz, left_at timestamptz, attendance_evidence_document_id uuid references public.corporate_documents(id) on delete set null,
  unique(meeting_id, profile_id)
);
create table public.meeting_minutes_versions (
  id uuid primary key default gen_random_uuid(), meeting_id uuid not null references public.board_meetings(id) on delete restrict,
  version integer not null, body jsonb not null default '{}'::jsonb, change_summary text, source_version_id uuid references public.meeting_minutes_versions(id) on delete restrict,
  status public.review_status not null default 'DRAFT', checksum text, created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(), approved_by uuid references public.profiles(id) on delete set null, approved_at timestamptz,
  unique(meeting_id, version)
);
create table public.minutes_comments (
  id uuid primary key default gen_random_uuid(), minutes_version_id uuid not null references public.meeting_minutes_versions(id) on delete restrict,
  author_id uuid not null references public.profiles(id) on delete restrict, body text not null, status text not null default 'OPEN' check (status in ('OPEN','RESOLVED')),
  created_at timestamptz not null default now(), resolved_at timestamptz, resolved_by uuid references public.profiles(id) on delete set null
);
create table public.board_action_items (
  id uuid primary key default gen_random_uuid(), reference text not null unique, meeting_id uuid references public.board_meetings(id) on delete restrict,
  resolution_id uuid references public.resolutions(id) on delete restrict, task text not null, owner_id uuid references public.profiles(id) on delete set null,
  due_date date, priority text not null default 'NORMAL', status text not null default 'OPEN' check (status in ('OPEN','IN_PROGRESS','BLOCKED','COMPLETED','ARCHIVED')),
  evidence_document_id uuid references public.corporate_documents(id) on delete set null, completed_at timestamptz, reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index board_action_items_due_idx on public.board_action_items(status, due_date);
create table public.resolution_votes (
  id uuid primary key default gen_random_uuid(), resolution_id uuid not null references public.resolutions(id) on delete restrict,
  director_id uuid not null references public.profiles(id) on delete restrict, decision text not null check (decision in ('APPROVE','REJECT','ABSTAIN','DEFER')),
  comment text, authenticated_aal text not null check (authenticated_aal in ('aal1','aal2')), recorded_at timestamptz not null default now(), unique(resolution_id, director_id)
);

create table public.retention_policies (
  id uuid primary key default gen_random_uuid(), name text not null unique, applies_to text not null, trigger_description text not null,
  review_required_at date, legal_source_id uuid references public.regulatory_sources(id) on delete set null, professional_review_status public.review_status not null default 'DRAFT',
  created_at timestamptz not null default now(), archived_at timestamptz
);
create table public.document_versions (
  id uuid primary key default gen_random_uuid(), document_id uuid not null references public.corporate_documents(id) on delete restrict,
  version integer not null, storage_path text not null unique, mime_type text not null, byte_size bigint not null check (byte_size >= 0), checksum text not null,
  status public.review_status not null default 'DRAFT', uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(), unique(document_id, version)
);
alter table public.corporate_documents add constraint corporate_documents_current_version_fk foreign key (current_version_id) references public.document_versions(id) on delete restrict;
create table public.document_access_events (
  id bigint generated always as identity primary key, document_id uuid not null references public.corporate_documents(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete set null, event_type text not null check (event_type in ('VIEWED','DOWNLOADED','SIGNED_URL_ISSUED')),
  created_at timestamptz not null default now(), context jsonb not null default '{}'::jsonb
);
create table public.legal_holds (
  id uuid primary key default gen_random_uuid(), entity_type text not null, entity_id uuid not null, reason text not null,
  authority text, set_by uuid not null references public.profiles(id) on delete restrict, set_at timestamptz not null default now(),
  released_at timestamptz, released_by uuid references public.profiles(id) on delete set null
);

create table public.registrations (
  id uuid primary key default gen_random_uuid(), reference text not null unique, registration_type text not null, authority text,
  identifier_masked text, status text not null default 'DRAFT', effective_date date, expiry_date date,
  classification public.document_classification not null default 'CONFIDENTIAL', owner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index registrations_expiry_idx on public.registrations(status, expiry_date);
create table public.registration_documents (
  registration_id uuid not null references public.registrations(id) on delete restrict,
  document_id uuid not null references public.corporate_documents(id) on delete restrict, primary key(registration_id, document_id)
);
create table public.approval_requests (
  id uuid primary key default gen_random_uuid(), entity_type text not null, entity_id uuid not null, request_type text not null,
  status public.approval_status not null default 'REQUESTED', requested_by uuid not null references public.profiles(id) on delete restrict,
  assigned_to uuid references public.profiles(id) on delete set null, separation_required boolean not null default false,
  created_at timestamptz not null default now(), resolved_at timestamptz
);
create table public.approval_decisions (
  id uuid primary key default gen_random_uuid(), request_id uuid not null references public.approval_requests(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict, decision public.approval_status not null check (decision in ('APPROVED','REJECTED','CHANGES_REQUESTED')),
  note text, created_at timestamptz not null default now()
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.profiles(id) on delete restrict,
  category text not null, title text not null, body text, entity_type text, entity_id uuid, read_at timestamptz, archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_inbox_idx on public.notifications(profile_id, read_at, created_at desc);
create table public.security_incidents (
  id uuid primary key default gen_random_uuid(), reference text not null unique, detected_at timestamptz not null, reported_by uuid references public.profiles(id) on delete set null,
  severity text not null check (severity in ('LOW','MEDIUM','HIGH','CRITICAL')), status text not null default 'OPEN', affected_systems text[], affected_data_categories text[],
  containment text, investigation text, actions text, closure_at timestamptz, created_at timestamptz not null default now()
);
create table public.statutory_register_definitions (
  id uuid primary key default gen_random_uuid(), title text not null unique, source_id uuid references public.regulatory_sources(id) on delete set null,
  enabled boolean not null default false, professional_review_status public.review_status not null default 'DRAFT', created_at timestamptz not null default now()
);
create table public.statutory_register_entries (
  id uuid primary key default gen_random_uuid(), definition_id uuid not null references public.statutory_register_definitions(id) on delete restrict,
  effective_from date not null, effective_to date, data jsonb not null default '{}'::jsonb, record_version integer not null default 1,
  created_by uuid not null references public.profiles(id) on delete restrict, created_at timestamptz not null default now(), check (effective_to is null or effective_to >= effective_from)
);

-- RLS helpers deliberately prefer explicit role / resource assignment over broad company membership.
create or replace function public.is_active_corporate_member() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_active and (p.access_expires_at is null or p.access_expires_at > now()))
$$;
create or replace function public.has_active_corporate_role(roles public.corporate_role[]) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_active_corporate_member() and exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = any(roles))
$$;
create or replace function public.has_resource_assignment(p_resource_type text, p_resource_id uuid, p_permission text default 'VIEW') returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.resource_assignments a where a.profile_id = auth.uid() and a.resource_type = p_resource_type and a.resource_id = p_resource_id and a.permission = p_permission and a.revoked_at is null and (a.expires_at is null or a.expires_at > now()))
$$;
create or replace function public.is_aal2() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
$$;
revoke all on function public.is_active_corporate_member() from public; grant execute on function public.is_active_corporate_member() to authenticated;
revoke all on function public.has_active_corporate_role(public.corporate_role[]) from public; grant execute on function public.has_active_corporate_role(public.corporate_role[]) to authenticated;
revoke all on function public.has_resource_assignment(text, uuid, text) from public; grant execute on function public.has_resource_assignment(text, uuid, text) to authenticated;
revoke all on function public.is_aal2() from public; grant execute on function public.is_aal2() to authenticated;

-- Remove the Phase 1 broad-read policies before applying scoped Phase 3 policies.
drop policy if exists "documents: corporate members read permitted records" on public.corporate_documents;
drop policy if exists "documents: privileged write" on public.corporate_documents;
drop policy if exists "documents: privileged update" on public.corporate_documents;
drop policy if exists "board: directors and secretaries" on public.board_meetings;
drop policy if exists "agenda: board access" on public.meeting_agenda_items;
drop policy if exists "resolutions: board access" on public.resolutions;
drop policy if exists "compliance: authorised read" on public.compliance_items;
drop policy if exists "compliance: privileged write" on public.compliance_items;
drop policy if exists "audit: privileged read" on public.audit_events;
drop policy if exists "private storage: authorised metadata owners only" on storage.objects;
drop policy if exists "private storage: privileged upload" on storage.objects;

create policy "documents scoped read" on public.corporate_documents for select to authenticated using (
  public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[])
  or (classification in ('INTERNAL','CONFIDENTIAL') and public.has_active_corporate_role(array['LEGAL_REVIEWER','FINANCE_REVIEWER','COMPLIANCE_REVIEWER']::public.corporate_role[]))
  or public.has_resource_assignment('DOCUMENT', id, 'VIEW')
);
create policy "documents controlled write" on public.corporate_documents for insert to authenticated with check (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "documents controlled update" on public.corporate_documents for update to authenticated using (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[])) with check (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "board restricted read" on public.board_meetings for select to authenticated using (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[]) or public.has_resource_assignment('BOARD_MEETING', id, 'VIEW'));
create policy "board controlled write" on public.board_meetings for insert to authenticated with check (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "board controlled update" on public.board_meetings for update to authenticated using (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[])) with check (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "agenda restricted" on public.meeting_agenda_items for all to authenticated using (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[])) with check (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "resolutions restricted" on public.resolutions for all to authenticated using (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[])) with check (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "compliance scoped read" on public.compliance_items for select to authenticated using (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','CA_AUDITOR','CA','AUDITOR','FINANCE_REVIEWER','COMPLIANCE_REVIEWER','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "compliance controlled write" on public.compliance_items for all to authenticated using (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','CA_AUDITOR','CA','COMPLIANCE_REVIEWER','SYSTEM_ADMIN']::public.corporate_role[])) with check (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','CA_AUDITOR','CA','COMPLIANCE_REVIEWER','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "private storage scoped read" on storage.objects for select to authenticated using (bucket_id = 'corporate-private' and public.is_active_corporate_member() and exists(select 1 from public.corporate_documents d where d.storage_path = name));
create policy "private storage controlled upload" on storage.objects for insert to authenticated with check (bucket_id = 'corporate-private' and public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[]));

-- All new corporate tables are deny-by-default. Read/write routes must be introduced with narrowly reviewed RLS policies.
alter table public.corporate_role_assignments enable row level security; alter table public.resource_assignments enable row level security; alter table public.regulatory_sources enable row level security; alter table public.compliance_rules enable row level security; alter table public.compliance_rule_versions enable row level security; alter table public.company_applicability_profiles enable row level security; alter table public.compliance_obligations enable row level security; alter table public.compliance_overrides enable row level security; alter table public.compliance_evidence enable row level security; alter table public.meeting_notices enable row level security; alter table public.notice_deliveries enable row level security; alter table public.meeting_attendees enable row level security; alter table public.meeting_minutes_versions enable row level security; alter table public.minutes_comments enable row level security; alter table public.board_action_items enable row level security; alter table public.resolution_votes enable row level security; alter table public.retention_policies enable row level security; alter table public.document_versions enable row level security; alter table public.document_access_events enable row level security; alter table public.legal_holds enable row level security; alter table public.registrations enable row level security; alter table public.registration_documents enable row level security; alter table public.approval_requests enable row level security; alter table public.approval_decisions enable row level security; alter table public.notifications enable row level security; alter table public.security_incidents enable row level security; alter table public.statutory_register_definitions enable row level security; alter table public.statutory_register_entries enable row level security;

create policy "notifications self read" on public.notifications for select to authenticated using (profile_id = auth.uid() and public.is_active_corporate_member());
create policy "notifications self update" on public.notifications for update to authenticated using (profile_id = auth.uid() and public.is_active_corporate_member()) with check (profile_id = auth.uid());
create policy "audit strict read" on public.audit_events for select to authenticated using (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[]));

-- Finalisation is a narrow SECURITY DEFINER operation; only an AAL2 authorised governance role can lock the selected version.
create or replace function public.finalise_minutes(p_meeting_id uuid, p_minutes_version_id uuid, p_checksum text) returns void language plpgsql security definer set search_path = public as $$
declare v_role public.corporate_role; begin
  select role into v_role from public.profiles where id = auth.uid() and is_active and (access_expires_at is null or access_expires_at > now());
  if v_role is null or v_role not in ('DIRECTOR','SYSTEM_ADMIN') or not public.is_aal2() then raise exception 'AAL2 director-level finalisation is required'; end if;
  if not exists(select 1 from public.meeting_minutes_versions where id = p_minutes_version_id and meeting_id = p_meeting_id and status = 'APPROVED') then raise exception 'Only an approved minutes version may be finalised'; end if;
  update public.meeting_minutes_versions set status = 'LOCKED', checksum = p_checksum, approved_by = auth.uid(), approved_at = now() where id = p_minutes_version_id;
  update public.board_meetings set status = 'FINAL', lifecycle_status = 'CLOSED', finalised_at = now(), finalised_by = auth.uid(), record_version = record_version + 1 where id = p_meeting_id and status <> 'FINAL';
  if not found then raise exception 'Meeting is already finalised or unavailable'; end if;
end $$;
revoke all on function public.finalise_minutes(uuid, uuid, text) from public; grant execute on function public.finalise_minutes(uuid, uuid, text) to authenticated;

create or replace function public.prevent_locked_minutes_update() returns trigger language plpgsql security definer set search_path = public as $$ begin if old.status = 'LOCKED' then raise exception 'Locked minutes cannot be overwritten; create an amendment record'; end if; return new; end $$;
create trigger minutes_version_lock_guard before update or delete on public.meeting_minutes_versions for each row execute function public.prevent_locked_minutes_update();

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
-- authenticated receives only RLS-constrained table access; service_role remains server-only and must never reach the browser.
grant select, insert, update on public.profiles, public.corporate_documents, public.board_meetings, public.meeting_agenda_items, public.resolutions, public.compliance_items, public.publications, public.audit_events to authenticated;



