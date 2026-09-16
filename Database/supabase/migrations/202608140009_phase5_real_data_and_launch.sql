-- Phase 5: controlled onboarding of verified real corporate data and launch governance.
-- This migration intentionally creates no company records, users, registrations or documents.
-- Apply to staging first, capture a backup, and complete authorised review before production use.

create table public.migration_batches (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  source_name text not null,
  source_type text not null check (source_type in ('COMPANY_PROFILE','DIRECTORS','SHAREHOLDING','REGISTRATIONS','BOARD_RECORDS','GST','ROC_MCA','AUDITOR','BANK_METADATA','DOCUMENTS','CONTRACTS','IP','DOMAINS','POLICIES','COMPLIANCE_EVIDENCE','OTHER')),
  source_inventory_reference text,
  status text not null default 'INVENTORIED' check (status in ('INVENTORIED','STAGED','VALIDATED','REVIEW_PENDING','APPROVED','COMMITTED','REJECTED','ROLLBACK_REQUESTED','ROLLED_BACK')),
  record_count integer not null default 0 check (record_count >= 0),
  validation_error_count integer not null default 0 check (validation_error_count >= 0),
  warning_count integer not null default 0 check (warning_count >= 0),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  created_by uuid not null references public.profiles(id) on delete restrict,
  approved_by uuid references public.profiles(id) on delete restrict,
  committed_by uuid references public.profiles(id) on delete restrict,
  committed_at timestamptz,
  rollback_status text,
  rollback_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status <> 'COMMITTED') or (approved_by is not null and committed_by is not null and committed_at is not null))
);

create table public.migration_staging_records (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.migration_batches(id) on delete restrict,
  source_record_reference text,
  entity_type text not null,
  classification text not null default 'CONFIDENTIAL' check (classification in ('PUBLIC','INTERNAL','CONFIDENTIAL','HIGHLY_CONFIDENTIAL','DIRECTORS_ONLY','PROFESSIONAL_ASSIGNED')),
  validation_status text not null default 'STAGED' check (validation_status in ('STAGED','VALID','WARNING','DUPLICATE','REJECTED','IMPORTED')),
  validation_notes jsonb not null default '[]'::jsonb,
  metadata_preview jsonb not null default '{}'::jsonb,
  source_checksum text,
  target_entity_type text,
  target_entity_id uuid,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(batch_id, source_record_reference)
);

create table public.professional_review_records (
  id uuid primary key default gen_random_uuid(),
  review_type text not null check (review_type in ('COMPANY_SECRETARY','CHARTERED_ACCOUNTANT','LEGAL_COUNSEL','DIRECTOR','SECURITY','PRIVACY')),
  scope text not null,
  status text not null default 'READY_FOR_REVIEW' check (status in ('READY_FOR_REVIEW','IN_REVIEW','CHANGES_REQUIRED','APPROVED','NOT_APPLICABLE','REVIEW_PENDING')),
  reviewer_profile_id uuid references public.profiles(id) on delete set null,
  reviewer_name text,
  review_date date,
  approved_version text,
  comments text,
  follow_up text,
  evidence_document_id uuid references public.corporate_documents(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.production_environment_inventory (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('DEPLOYMENT','DOMAIN','DNS','TLS','EMAIL','SUPABASE','BACKUP','MONITORING','ANALYTICS','CI_CD','OTHER')),
  label text not null,
  provider text,
  environment text not null default 'PRODUCTION' check (environment in ('DEVELOPMENT','STAGING','PRODUCTION')),
  status text not null default 'NEEDS_CONFIGURATION' check (status in ('READY','NEEDS_CONFIGURATION','NEEDS_OWNER_INPUT','NEEDS_PROFESSIONAL_REVIEW','BLOCKER','NOT_APPLICABLE')),
  public_reference text,
  credential_reference text,
  owner_id uuid references public.profiles(id) on delete set null,
  last_verified_at timestamptz,
  last_verified_by uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(category, label, environment)
);

create index migration_batches_status_idx on public.migration_batches(status, created_at desc);
create index migration_staging_records_batch_idx on public.migration_staging_records(batch_id, validation_status);
create index professional_review_status_idx on public.professional_review_records(status, review_type);
create index production_environment_inventory_status_idx on public.production_environment_inventory(environment, status);

alter table public.migration_batches enable row level security;
alter table public.migration_staging_records enable row level security;
alter table public.professional_review_records enable row level security;
alter table public.production_environment_inventory enable row level security;

create policy "migration batches authorised read" on public.migration_batches for select to authenticated using (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "migration batches authorised insert" on public.migration_batches for insert to authenticated with check (created_by = auth.uid() and public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "migration batches authorised update" on public.migration_batches for update to authenticated using (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[])) with check (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "migration staging authorised read" on public.migration_staging_records for select to authenticated using (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "migration staging authorised insert" on public.migration_staging_records for insert to authenticated with check (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "migration staging authorised update" on public.migration_staging_records for update to authenticated using (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[])) with check (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "professional reviews authorised read" on public.professional_review_records for select to authenticated using (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','LEGAL_REVIEWER','CA','CA_AUDITOR','AUDITOR','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "professional reviews controlled write" on public.professional_review_records for all to authenticated using (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[])) with check (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "environment inventory authorised read" on public.production_environment_inventory for select to authenticated using (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "environment inventory authorised write" on public.production_environment_inventory for all to authenticated using (public.has_active_corporate_role(array['DIRECTOR','SYSTEM_ADMIN']::public.corporate_role[])) with check (public.has_active_corporate_role(array['DIRECTOR','SYSTEM_ADMIN']::public.corporate_role[]));

create or replace function public.prevent_committed_migration_mutation() returns trigger language plpgsql as $$
begin
  if old.status = 'COMMITTED' then raise exception 'Committed migration batches are immutable; use a controlled rollback request.'; end if;
  new.updated_at = now(); return new;
end;
$$;
create trigger migration_batches_lock_committed before update on public.migration_batches for each row execute function public.prevent_committed_migration_mutation();

create or replace function public.prevent_committed_staging_mutation() returns trigger language plpgsql as $$
begin
  if exists (select 1 from public.migration_batches where id = old.batch_id and status = 'COMMITTED') then raise exception 'Imported migration staging records are immutable.'; end if;
  new.updated_at = now(); return new;
end;
$$;
create trigger migration_staging_lock_committed before update on public.migration_staging_records for each row execute function public.prevent_committed_staging_mutation();

create or replace function public.touch_professional_review_record() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
create trigger professional_review_records_touch before update on public.professional_review_records for each row execute function public.touch_professional_review_record();
create or replace function public.touch_production_environment_inventory() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
create trigger production_environment_inventory_touch before update on public.production_environment_inventory for each row execute function public.touch_production_environment_inventory();