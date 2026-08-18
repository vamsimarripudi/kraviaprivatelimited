-- Phase 5B: governed public corporate content. No sample posts, jobs, claims, facts or public records are seeded.
-- Apply after 202608140010_content_role_extensions.sql and validate RLS with controlled accounts before production use.

create table public.content_records (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('COMPANY','PRODUCT','MILESTONE','PRINCIPLE','LEADERSHIP','TECHNOLOGY','RESEARCH','NEWS','PRESS_RELEASE','ENGINEERING_ARTICLE','TRUST_DOCUMENT','POLICY','CORPORATE_DISCLOSURE','REPORT','CAREER','PARTNER','FAQ')),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (length(trim(title)) > 0),
  summary text,
  body jsonb not null default '[]'::jsonb,
  status text not null default 'DRAFT' check (status in ('DRAFT','IN_REVIEW','CHANGES_REQUESTED','APPROVED','SCHEDULED','PUBLISHED','ARCHIVED')),
  visibility text not null default 'PRIVATE' check (visibility in ('PRIVATE','PUBLIC')),
  category text,
  author_name text,
  content_owner uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  published_at timestamptz,
  scheduled_for timestamptz,
  last_reviewed_at timestamptz,
  next_review_at timestamptz,
  version integer not null default 1 check (version > 0),
  seo jsonb not null default '{}'::jsonb,
  related_entity_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status <> 'PUBLISHED') or (visibility = 'PUBLIC' and published_at is not null)),
  check ((status <> 'SCHEDULED') or scheduled_for is not null)
);

create table public.content_versions (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content_records(id) on delete restrict,
  version integer not null check (version > 0),
  snapshot jsonb not null,
  change_summary text,
  materiality text not null default 'EDITORIAL' check (materiality in ('EDITORIAL','MINOR','MATERIAL','LEGAL_POLICY','CORPORATE_FACT')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(content_id, version)
);

create table public.content_reviews (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content_records(id) on delete restrict,
  version integer not null check (version > 0),
  review_domain text not null check (review_domain in ('CONTENT','PRODUCT','TECHNOLOGY','SECURITY','PRIVACY','LEGAL','CORPORATE','DIRECTOR')),
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','CHANGES_REQUESTED','REJECTED')),
  assigned_to uuid references public.profiles(id) on delete set null,
  reviewer_id uuid references public.profiles(id) on delete set null,
  note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(content_id, version, review_domain)
);

create table public.public_claims (
  id uuid primary key default gen_random_uuid(),
  claim text not null unique,
  category text not null check (category in ('PRODUCT','SECURITY','PRIVACY','AI','CORPORATE','PERFORMANCE')),
  evidence text,
  evidence_document_id uuid references public.corporate_documents(id) on delete set null,
  verification_status text not null default 'UNVERIFIED' check (verification_status in ('UNVERIFIED','VERIFIED','EXPIRED','REVIEW_REQUIRED')),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  verified_at timestamptz,
  next_review_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.content_claim_links (
  content_id uuid not null references public.content_records(id) on delete restrict,
  claim_id uuid not null references public.public_claims(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (content_id, claim_id)
);

create table public.corporate_facts (
  id uuid primary key default gen_random_uuid(),
  fact_key text not null,
  value jsonb not null,
  visibility text not null default 'PRIVATE' check (visibility in ('PRIVATE','PUBLIC')),
  verification_status text not null default 'UNVERIFIED' check (verification_status in ('UNVERIFIED','DOCUMENT_VERIFIED','PROFESSIONAL_VERIFIED','DIRECTOR_APPROVED','PUBLIC_APPROVED')),
  evidence_document_id uuid references public.corporate_documents(id) on delete set null,
  verification_source text,
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  effective_from date,
  effective_to date,
  last_reviewed_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_from is null or effective_to >= effective_from)
);

create table public.content_relationships (
  id uuid primary key default gen_random_uuid(),
  from_entity_type text not null, from_entity_id uuid not null,
  predicate text not null check (predicate in ('BUILDS','IS_A','OPERATES_IN','HAS_POLICY','RELATES_TO','ANNOUNCES','HAS_ROLE')),
  to_entity_type text not null, to_entity_id uuid not null,
  public boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(from_entity_type, from_entity_id, predicate, to_entity_type, to_entity_id)
);

create table public.content_media_assets (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  asset_type text not null check (asset_type in ('IMAGE','LOGO','PHOTO','PDF','DIAGRAM','VIDEO','OTHER')),
  alt_type text not null default 'INFORMATIVE' check (alt_type in ('INFORMATIVE','DECORATIVE')),
  alt_text text,
  caption text,
  rights_status text not null default 'REVIEW_REQUIRED' check (rights_status in ('APPROVED','REVIEW_REQUIRED','EXPIRED','RESTRICTED')),
  usage_permission text,
  usage_expires_at timestamptz,
  approved boolean not null default false,
  superseded_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check ((alt_type = 'DECORATIVE' and coalesce(alt_text, '') = '') or (alt_type = 'INFORMATIVE' and length(trim(coalesce(alt_text, ''))) > 0))
);

create table public.content_redirects (
  id uuid primary key default gen_random_uuid(),
  source_path text not null unique check (source_path like '/%'),
  destination_path text not null check (destination_path like '/%'),
  redirect_type smallint not null default 301 check (redirect_type in (301, 302, 307, 308)),
  reason text not null,
  active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (source_path <> destination_path)
);

create table public.content_link_checks (
  id uuid primary key default gen_random_uuid(),
  content_id uuid references public.content_records(id) on delete cascade,
  url text not null,
  status text not null check (status in ('OK','BROKEN','REDIRECTED','TIMEOUT','REVIEW_REQUIRED')),
  http_status integer,
  checked_at timestamptz not null default now(),
  detail text,
  unique(content_id, url)
);

create table public.content_publication_events (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content_records(id) on delete restrict,
  event_type text not null check (event_type in ('CREATED','REVIEW_REQUESTED','CHANGES_REQUESTED','APPROVED','SCHEDULED','PUBLISHED','UNPUBLISHED','ARCHIVED','RESTORED')),
  actor_id uuid references public.profiles(id) on delete set null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index content_records_public_idx on public.content_records(content_type, published_at desc) where status = 'PUBLISHED' and visibility = 'PUBLIC';
create index content_records_review_idx on public.content_records(status, scheduled_for, next_review_at);
create index content_reviews_assignment_idx on public.content_reviews(assigned_to, status);
create index corporate_facts_public_idx on public.corporate_facts(fact_key, effective_from desc) where visibility = 'PUBLIC';
create index content_relationships_public_idx on public.content_relationships(from_entity_id, predicate) where public;
create index content_link_checks_status_idx on public.content_link_checks(status, checked_at desc);

alter table public.content_records enable row level security;
alter table public.content_versions enable row level security;
alter table public.content_reviews enable row level security;
alter table public.public_claims enable row level security;
alter table public.content_claim_links enable row level security;
alter table public.corporate_facts enable row level security;
alter table public.content_relationships enable row level security;
alter table public.content_media_assets enable row level security;
alter table public.content_redirects enable row level security;
alter table public.content_link_checks enable row level security;
alter table public.content_publication_events enable row level security;

create or replace function public.content_can_edit() returns boolean language sql stable security definer set search_path = public as $$
  select public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','SYSTEM_ADMIN','CONTENT_EDITOR']::public.corporate_role[])
$$;
create or replace function public.content_can_review_domain(p_domain text) returns boolean language sql stable security definer set search_path = public as $$
  select public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','SYSTEM_ADMIN','CORPORATE_REVIEWER']::public.corporate_role[])
    or (p_domain = 'PRODUCT' and public.has_active_corporate_role(array['PRODUCT_REVIEWER']::public.corporate_role[]))
    or (p_domain = 'SECURITY' and public.has_active_corporate_role(array['SECURITY_REVIEWER']::public.corporate_role[]))
    or (p_domain = 'PRIVACY' and public.has_active_corporate_role(array['PRIVACY_REVIEWER','LEGAL_REVIEWER']::public.corporate_role[]))
    or (p_domain = 'LEGAL' and public.has_active_corporate_role(array['LEGAL_REVIEWER']::public.corporate_role[]))
    or (p_domain = 'TECHNOLOGY' and public.has_active_corporate_role(array['PRODUCT_REVIEWER']::public.corporate_role[]))
$$;
create or replace function public.content_can_publish() returns boolean language sql stable security definer set search_path = public as $$
  select public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','SYSTEM_ADMIN','PUBLISHER']::public.corporate_role[])
$$;
create or replace function public.content_can_read_private(p_content_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.content_can_edit()
    or exists(select 1 from public.content_reviews r where r.content_id = p_content_id and r.assigned_to = auth.uid())
$$;
revoke all on function public.content_can_edit() from public; grant execute on function public.content_can_edit() to authenticated;
revoke all on function public.content_can_review_domain(text) from public; grant execute on function public.content_can_review_domain(text) to authenticated;
revoke all on function public.content_can_publish() from public; grant execute on function public.content_can_publish() to authenticated;
revoke all on function public.content_can_read_private(uuid) from public; grant execute on function public.content_can_read_private(uuid) to authenticated;

create policy "content public published read" on public.content_records for select using (status = 'PUBLISHED' and visibility = 'PUBLIC');
create policy "content authorised private read" on public.content_records for select to authenticated using (public.content_can_read_private(id));
create policy "content editor creates drafts" on public.content_records for insert to authenticated with check (public.content_can_edit() and created_by = auth.uid() and status = 'DRAFT' and visibility = 'PRIVATE');
create policy "content editor updates unpublished" on public.content_records for update to authenticated using (public.content_can_edit() and status <> 'PUBLISHED') with check (public.content_can_edit());
create policy "content publisher controls approved status" on public.content_records for update to authenticated using (public.content_can_publish()) with check (public.content_can_publish());

create policy "content versions scoped read" on public.content_versions for select to authenticated using (public.content_can_read_private(content_id));
create policy "content versions editor insert" on public.content_versions for insert to authenticated with check (public.content_can_edit() and created_by = auth.uid());
create policy "content reviews scoped read" on public.content_reviews for select to authenticated using (public.content_can_edit() or assigned_to = auth.uid());
create policy "content reviews editor create" on public.content_reviews for insert to authenticated with check (public.content_can_edit());
create policy "content reviews assigned reviewer update" on public.content_reviews for update to authenticated using (assigned_to = auth.uid() and public.content_can_review_domain(review_domain)) with check (reviewer_id = auth.uid() and public.content_can_review_domain(review_domain));

create policy "claims controlled read" on public.public_claims for select to authenticated using (public.content_can_edit() or public.content_can_review_domain('CORPORATE'));
create policy "claims controlled write" on public.public_claims for all to authenticated using (public.content_can_edit()) with check (public.content_can_edit());
create policy "content claim links scoped read" on public.content_claim_links for select to authenticated using (public.content_can_read_private(content_id));
create policy "content claim links editor write" on public.content_claim_links for all to authenticated using (public.content_can_edit()) with check (public.content_can_edit());
create policy "corporate facts controlled read" on public.corporate_facts for select to authenticated using (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN','CORPORATE_REVIEWER']::public.corporate_role[]));
create policy "corporate facts controlled write" on public.corporate_facts for all to authenticated using (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[])) with check (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "relationships controlled read" on public.content_relationships for select to authenticated using (public.content_can_edit() or public.content_can_review_domain('CORPORATE'));
create policy "relationships controlled write" on public.content_relationships for all to authenticated using (public.content_can_edit()) with check (public.content_can_edit());
create policy "media controlled read" on public.content_media_assets for select to authenticated using (public.content_can_edit() or public.content_can_review_domain('CORPORATE'));
create policy "media controlled write" on public.content_media_assets for all to authenticated using (public.content_can_edit()) with check (public.content_can_edit());
create policy "redirects controlled read" on public.content_redirects for select to authenticated using (public.content_can_edit() or public.content_can_publish());
create policy "redirects controlled write" on public.content_redirects for all to authenticated using (public.content_can_publish()) with check (public.content_can_publish());
create policy "link checks controlled read" on public.content_link_checks for select to authenticated using (public.content_can_edit() or public.content_can_publish());
create policy "link checks controlled write" on public.content_link_checks for all to authenticated using (public.content_can_edit()) with check (public.content_can_edit());
create policy "publication events scoped read" on public.content_publication_events for select to authenticated using (public.content_can_read_private(content_id));
create policy "publication events controlled write" on public.content_publication_events for insert to authenticated with check (public.content_can_edit() or public.content_can_publish());

create or replace function public.content_records_touch_and_validate() returns trigger language plpgsql as $$
begin
  if old.status = 'PUBLISHED' and new.status = 'PUBLISHED' and new.body is distinct from old.body then
    raise exception 'Published content is immutable; create a revised version and use the controlled publication workflow.';
  end if;
  if new.status = 'PUBLISHED' and new.visibility <> 'PUBLIC' then raise exception 'Published content must be explicitly public.'; end if;
  if new.status = 'PUBLISHED' and new.published_at is null then new.published_at = now(); end if;
  new.updated_at = now();
  return new;
end;
$$;
create trigger content_records_validate before update on public.content_records for each row execute function public.content_records_touch_and_validate();

create or replace function public.prevent_content_version_mutation() returns trigger language plpgsql as $$ begin raise exception 'Content versions are append-only.'; end; $$;
create trigger content_versions_immutable before update or delete on public.content_versions for each row execute function public.prevent_content_version_mutation();
create or replace function public.content_touch_review() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
create trigger content_reviews_touch before update on public.content_reviews for each row execute function public.content_touch_review();
create or replace function public.content_touch_facts_claims() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
create trigger public_claims_touch before update on public.public_claims for each row execute function public.content_touch_facts_claims();
create trigger corporate_facts_touch before update on public.corporate_facts for each row execute function public.content_touch_facts_claims();

-- Reviewer access is scoped to explicitly assigned reviews or an unclaimed review in the reviewer’s authorised domain.
create or replace function public.content_can_read_private(p_content_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.content_can_edit()
    or exists(select 1 from public.content_reviews r where r.content_id = p_content_id and (r.assigned_to = auth.uid() or (r.assigned_to is null and public.content_can_review_domain(r.review_domain))))
$$;

drop policy "content reviews scoped read" on public.content_reviews;
create policy "content reviews scoped read" on public.content_reviews for select to authenticated using (public.content_can_edit() or assigned_to = auth.uid() or (assigned_to is null and public.content_can_review_domain(review_domain)));
drop policy "content reviews assigned reviewer update" on public.content_reviews;
create policy "content reviews scoped reviewer update" on public.content_reviews for update to authenticated using ((assigned_to = auth.uid() or (assigned_to is null and public.content_can_review_domain(review_domain))) and public.content_can_review_domain(review_domain)) with check (reviewer_id = auth.uid() and public.content_can_review_domain(review_domain));
create policy "content reviewer requests changes" on public.content_records for update to authenticated using (exists(select 1 from public.content_reviews r where r.content_id = id and r.reviewer_id = auth.uid())) with check (status = 'CHANGES_REQUESTED');
create policy "content redirects public read" on public.content_redirects for select using (active);

-- A privileged publisher cannot skip the required review record. Review requirements deliberately remain conservative;
-- specialised policy/security mapping can be tightened as Kravia configures each content domain.
create or replace function public.content_records_touch_and_validate() returns trigger language plpgsql security definer set search_path = public as $$
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
  if new.content_type = 'PRODUCT' and new.status in ('APPROVED','SCHEDULED','PUBLISHED') and not exists(select 1 from public.content_reviews r where r.content_id = new.id and r.version = new.version and r.review_domain = 'PRODUCT' and r.status = 'APPROVED') then
    raise exception 'Product review is required before publication.';
  end if;
  if new.status = 'PUBLISHED' and new.visibility <> 'PUBLIC' then raise exception 'Published content must be explicitly public.'; end if;
  if new.status = 'PUBLISHED' and new.published_at is null then new.published_at = now(); end if;
  new.updated_at = now();
  return new;
end;
$$;

-- This adds an append-oriented business audit event without storing title/body/evidence content in the audit record.
create or replace function public.audit_content_record_change() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_events(actor_id, action, entity_type, entity_id, context)
  values (auth.uid(), case when tg_op = 'INSERT' then 'CONTENT_CREATED' when old.status is distinct from new.status then 'CONTENT_STATUS_CHANGED' else 'CONTENT_UPDATED' end, 'content_record', new.id, jsonb_build_object('status', new.status, 'version', new.version));
  return new;
end;
$$;
create trigger content_records_audit after insert or update on public.content_records for each row execute function public.audit_content_record_change();
