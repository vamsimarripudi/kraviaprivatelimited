-- KRAVIA Office: private employee onboarding and immutable display references.
-- Existing person_id, employment_id and employment_code are never replaced.
-- No generated ID, salary, letter, bank verification or email is inferred by this migration.

create table if not exists public.office_employee_intake_profiles (
  employee_user_id uuid primary key references public.office_identity_users(user_id) on delete restrict,
  legal_name text check (legal_name is null or length(legal_name) between 2 and 160),
  preferred_name text check (preferred_name is null or length(preferred_name) between 1 and 120),
  contact_phone text check (contact_phone is null or length(contact_phone) <= 32),
  date_of_birth date,
  current_address jsonb not null default '{}'::jsonb check(jsonb_typeof(current_address)='object'),
  education jsonb not null default '[]'::jsonb check(jsonb_typeof(education)='array'),
  certificates jsonb not null default '[]'::jsonb check(jsonb_typeof(certificates)='array'),
  bank_account_ciphertext text,
  bank_account_last4 text check(bank_account_last4 is null or bank_account_last4 ~ '^[0-9]{4}$'),
  bank_ifsc text check(bank_ifsc is null or bank_ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  bank_account_holder text check(bank_account_holder is null or length(bank_account_holder) between 2 and 160),
  bank_verified_by uuid references public.office_identity_users(user_id) on delete restrict,
  bank_verified_at timestamptz,
  bank_verification_evidence text check(bank_verification_evidence is null or length(bank_verification_evidence)<=400),
  photo_storage_reference text check(photo_storage_reference is null or length(photo_storage_reference)<=300),
  signature_evidence_reference text check(signature_evidence_reference is null or length(signature_evidence_reference)<=450),
  policy_acknowledged_at timestamptz,
  status text not null default 'DRAFT'
    check(status in ('DRAFT','SUBMITTED','RETURNED','VERIFIED')),
  submitted_at timestamptz,
  reviewed_by uuid references public.office_identity_users(user_id) on delete restrict,
  reviewed_at timestamptz,
  review_note text check(review_note is null or length(review_note)<=1000),
  revision integer not null default 1 check(revision>=1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.office_employee_reference_ids (
  employee_user_id uuid primary key references public.office_identity_users(user_id) on delete restrict,
  employment_id uuid not null unique references public.office_employment_registry(employment_id) on delete restrict,
  reference_code text not null unique check(reference_code ~ '^KRV-E[0-9]{2}-[A-F0-9]{16}$'),
  issued_by uuid not null references public.office_identity_users(user_id) on delete restrict,
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.office_employee_intake_events (
  id bigint generated always as identity primary key,
  employee_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
  actor_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
  event_type text not null check(event_type in (
    'PROFILE_DRAFT_SAVED','PROFILE_SUBMITTED','PROFILE_RETURNED','PROFILE_VERIFIED',
    'PHOTO_SCANNED','CERTIFICATE_SCANNED','BANK_DETAILS_VERIFIED','REFERENCE_ID_ISSUED')),
  metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now()
);

-- Durable, private delivery ledger. An email is never marked delivered merely
-- because an ID was issued; delivery requires an acknowledged provider result.
create table if not exists public.office_employee_mail_outbox (
  id uuid primary key default gen_random_uuid(),
  employee_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
  recipient_email text not null check(recipient_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  kind text not null check(kind in ('EMPLOYEE_ID_ISSUED','ONBOARDING_APPROVED')),
  reference_code text not null,
  status text not null default 'PENDING' check(status in ('PENDING','SENDING','SENT','UNKNOWN','REJECTED')),
  provider_message_id text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique(employee_user_id,kind,reference_code)
);

create index if not exists office_employee_intake_status_idx on public.office_employee_intake_profiles(status,updated_at);
create index if not exists office_employee_intake_events_employee_idx on public.office_employee_intake_events(employee_user_id,created_at desc);
create index if not exists office_employee_mail_pending_idx on public.office_employee_mail_outbox(status,created_at);

alter table public.office_employee_intake_profiles enable row level security;
alter table public.office_employee_reference_ids enable row level security;
alter table public.office_employee_intake_events enable row level security;
alter table public.office_employee_mail_outbox enable row level security;

revoke all on public.office_employee_intake_profiles,public.office_employee_reference_ids,
  public.office_employee_intake_events,public.office_employee_mail_outbox from public,anon,authenticated;
grant select,insert,update on public.office_employee_intake_profiles,
  public.office_employee_reference_ids,public.office_employee_mail_outbox to service_role;
grant select,insert on public.office_employee_intake_events to service_role;
grant usage,select on sequence public.office_employee_intake_events_id_seq to service_role;

-- Keep uploaded photos and certificates private. Only the authorised Office
-- service performs session-scoped upload/download operations with malware scan.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('office-employee-intake','office-employee-intake',false,10485760,
  array['image/jpeg','image/png','image/webp','application/pdf']::text[])
on conflict(id) do update set public=false,file_size_limit=10485760,
  allowed_mime_types=excluded.allowed_mime_types;

comment on table public.office_employee_intake_profiles is
'Private verified Office employee intake. Bank ciphertext uses independent AES-256-GCM key stored outside the database.';
comment on table public.office_employee_reference_ids is
'Permanent, unique employee-facing reference; internal employment identifiers remain unchanged.';
comment on table public.office_employee_mail_outbox is
'Provider-acknowledged employee transactional mail only. No automatic sends on schema or profile creation.';

-- Final issuance is a single durable transaction; service role only.
-- No bank details are placed in the outbox or email payload.
create or replace function public.office_employee_reference_issue(
  p_actor uuid, p_employee uuid, p_reference text, p_reason text
) returns text language plpgsql security definer set search_path=public as $$
declare
  v_profile public.office_employee_intake_profiles%rowtype;
  v_employment public.office_employment_registry%rowtype;
  v_email text;
  v_existing text;
begin
  if p_actor is null or p_employee is null or p_actor=p_employee then
    raise exception 'Independent HR approval is required';
  end if;
  if p_reference !~ '^KRV-E[0-9]{2}-[A-F0-9]{16}$' then
    raise exception 'Invalid employee reference format';
  end if;
  if length(trim(coalesce(p_reason,''))) < 12 then
    raise exception 'Documented issuance reason required';
  end if;
  if not exists (select 1 from public.office_user_roles
                 where user_id=p_actor and role in ('OWNER','HR')
                   and (expires_at is null or expires_at>now())) then
    raise exception 'Director or authorised HR reviewer required';
  end if;
  if public.office_department_permission_verdict(p_actor,'people.update') = 'DENY' then
    raise exception 'Department ownership was transferred; issuer has read-only access';
  end if;
  select * into v_profile from public.office_employee_intake_profiles
    where employee_user_id=p_employee for update;
  if v_profile.employee_user_id is null or v_profile.status <> 'VERIFIED' or
     v_profile.bank_verified_at is null or v_profile.signature_evidence_reference is null then
    raise exception 'Verified onboarding, Finance evidence and signed-document reference required';
  end if;
  if not exists (
    select 1 from public.office_role_package_onboarding_tasks
    where employee_user_id=p_employee and task_code='APPOINTMENT_SIGNED'
      and status='VERIFIED'
  ) then
    raise exception 'Independent signed appointment verification is required';
  end if;
  select * into v_employment from public.office_employment_registry
    where identity_user_id=p_employee and status='ACTIVE'
    order by created_at desc limit 1;
  if v_employment.employment_id is null or v_employment.start_date is null then
    raise exception 'Verified active employment with effective date required';
  end if;
  select reference_code into v_existing from public.office_employee_reference_ids
    where employee_user_id=p_employee;
  if v_existing is not null then return v_existing; end if;
  select email into v_email from public.office_auth_users
    where id=p_employee::text and status='ACTIVE';
  if v_email is null or v_email not like '%@kraviaprivatelimited.com' then
    raise exception 'Verified corporate registration email required';
  end if;
  insert into public.office_employee_reference_ids(
    employee_user_id,employment_id,reference_code,issued_by
  ) values(p_employee,v_employment.employment_id,p_reference,p_actor);
  insert into public.office_employee_mail_outbox(
    employee_user_id,recipient_email,kind,reference_code,status
  ) values(p_employee,v_email,'EMPLOYEE_ID_ISSUED',p_reference,'PENDING')
    on conflict(employee_user_id,kind,reference_code) do nothing;
  insert into public.office_employee_intake_events(
    employee_user_id,actor_user_id,event_type,metadata
  ) values(p_employee,p_actor,'REFERENCE_ID_ISSUED',
    jsonb_build_object('reference_code',p_reference,'reason',trim(p_reason)));
  return p_reference;
end;
$$;
revoke all on function public.office_employee_reference_issue(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.office_employee_reference_issue(uuid,uuid,text,text) to service_role;
