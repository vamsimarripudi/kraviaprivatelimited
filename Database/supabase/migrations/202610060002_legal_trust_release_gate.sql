-- Legal & Trust Center: a policy is not public merely because it is in the
-- generic content workflow. This adds release evidence bound to the exact
-- candidate hash, scope and effective period. It does not seed or publish a
-- policy from the supplied review pack.

create table public.legal_document_releases (
  content_id uuid primary key references public.content_records(id) on delete restrict,
  source_id text not null unique check (source_id ~ '^P[0-9]{2}$'),
  canonical_path text not null unique check (canonical_path ~ '^/legal/[a-z0-9]+(?:-[a-z0-9]+)*$'),
  document_version text not null check (char_length(trim(document_version)) between 1 and 32),
  release_state text not null default 'REVIEW_DRAFT' check (release_state in ('REVIEW_DRAFT','APPROVED_FUTURE','CURRENT','ARCHIVED','WITHDRAWN','PLANNED')),
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  approved_content_sha256 text check (approved_content_sha256 is null or approved_content_sha256 ~ '^[a-f0-9]{64}$'),
  approval_scope text,
  effective_from date,
  effective_to date,
  legal_approved_by uuid references public.profiles(id) on delete restrict,
  legal_approved_at timestamptz,
  operations_approved_by uuid references public.profiles(id) on delete restrict,
  operations_approved_at timestamptz,
  release_approved_by uuid references public.profiles(id) on delete restrict,
  release_approved_at timestamptz,
  public_pdf_path text check (public_pdf_path is null or public_pdf_path ~ '^/'),
  required_gate_evidence jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_from is null or effective_to >= effective_from),
  check ((release_state not in ('APPROVED_FUTURE','CURRENT')) or (
    approved_content_sha256 = content_sha256
    and nullif(trim(coalesce(approval_scope, '')), '') is not null
    and effective_from is not null
    and legal_approved_by is not null and legal_approved_at is not null
    and operations_approved_by is not null and operations_approved_at is not null
    and release_approved_by is not null and release_approved_at is not null
  ))
);

create index legal_document_releases_current_idx on public.legal_document_releases(effective_from, effective_to)
  where release_state in ('APPROVED_FUTURE','CURRENT');

alter table public.legal_document_releases enable row level security;

create policy "legal releases authorised read" on public.legal_document_releases
for select to authenticated using (public.content_can_edit() or public.content_can_publish() or public.content_can_review_domain('LEGAL'));

create policy "legal releases publisher write" on public.legal_document_releases
for all to authenticated using (public.content_can_publish()) with check (public.content_can_publish());

create or replace function public.legal_document_is_releasable(p_content_id uuid, p_release_at timestamptz default now())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.legal_document_releases r
    where r.content_id = p_content_id
      and r.release_state in ('APPROVED_FUTURE','CURRENT')
      and r.approved_content_sha256 = r.content_sha256
      and nullif(trim(coalesce(r.approval_scope, '')), '') is not null
      and r.legal_approved_by is not null and r.legal_approved_at is not null
      and r.operations_approved_by is not null and r.operations_approved_at is not null
      and r.release_approved_by is not null and r.release_approved_at is not null
      and r.effective_from <= p_release_at::date
      and (r.effective_to is null or r.effective_to >= p_release_at::date)
  );
$$;
revoke all on function public.legal_document_is_releasable(uuid,timestamptz) from public;
grant execute on function public.legal_document_is_releasable(uuid,timestamptz) to authenticated;

create or replace function public.legal_document_releases_touch()
returns trigger
language plpgsql
as $$
begin
  if old.release_state in ('CURRENT','ARCHIVED','WITHDRAWN') and new.content_sha256 is distinct from old.content_sha256 then
    raise exception 'A controlled legal release cannot be retargeted to different content.';
  end if;
  new.updated_at = now();
  return new;
end;
$$;
create trigger legal_document_releases_touch
before update on public.legal_document_releases
for each row execute function public.legal_document_releases_touch();

-- Keep the existing content-review controls and add the legal release gate for
-- policies. This explicitly prevents a generic publisher, future date, or
-- successful deployment from exposing a review draft.
create or replace function public.content_records_touch_and_validate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'PUBLISHED' and new.status = 'PUBLISHED' and new.body is distinct from old.body then
    raise exception 'Published content is immutable; create a revised version and use the controlled publication workflow.';
  end if;
  if new.status in ('APPROVED','SCHEDULED','PUBLISHED') and not public.content_can_publish() then
    raise exception 'Only an authorised publisher can approve, schedule or publish content.';
  end if;
  if new.status in ('APPROVED','SCHEDULED','PUBLISHED') and not exists(select 1 from public.content_reviews r where r.content_id = new.id and r.version = new.version and r.review_domain = 'CONTENT' and r.status = 'APPROVED') then
    raise exception 'Content approval requires an approved content review.';
  end if;
  if new.content_type in ('POLICY','CORPORATE_DISCLOSURE') and new.status in ('APPROVED','SCHEDULED','PUBLISHED') and not exists(select 1 from public.content_reviews r where r.content_id = new.id and r.version = new.version and r.review_domain = 'LEGAL' and r.status = 'APPROVED') then
    raise exception 'Legal review is required for this content type.';
  end if;
  -- A future policy can complete its editorial and legal review before its
  -- effective date. It still cannot be scheduled or publicly published until
  -- its exact approved hash, scope, named approvals and effective period are
  -- all valid at the release time.
  if new.content_type = 'POLICY' and new.status in ('SCHEDULED','PUBLISHED') and not public.legal_document_is_releasable(new.id, coalesce(new.scheduled_for, now())) then
    raise exception 'Policy publication requires recorded hash, scope, effective period and named legal, operations and release approvals.';
  end if;
  if new.content_type = 'PRODUCT' and new.status in ('APPROVED','SCHEDULED','PUBLISHED') and not exists(select 1 from public.content_reviews r where r.content_id = new.id and r.version = new.version and r.review_domain = 'PRODUCT' and r.status = 'APPROVED') then
    raise exception 'Product review is required before publication.';
  end if;
  if new.status = 'PUBLISHED' and new.visibility <> 'PUBLIC' then raise exception 'Published content must be explicitly public.'; end if;
  if new.status = 'PUBLISHED' and new.published_at is null then new.published_at = now(); end if;
  new.updated_at = now();
  return new;
end;
$$;
