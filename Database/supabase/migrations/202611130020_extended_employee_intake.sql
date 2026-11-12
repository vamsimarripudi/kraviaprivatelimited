-- KRAVIA Office: optional extended employee intake evidence.
-- Adds only private supplementary fields to the established HR intake table.
-- Does not change employment status, issue employee IDs, send email, or create data.
-- Onboarding remains independently approved through existing guarded services.

alter table public.office_employee_intake_profiles
  add column if not exists emergency_contacts jsonb not null default '[]'::jsonb,
  add column if not exists prior_experience jsonb not null default '[]'::jsonb,
  add column if not exists tax_declarations jsonb not null default '{}'::jsonb;

do $kravia_extended_intake$
begin
  if not exists(select 1 from pg_catalog.pg_constraint
    where conrelid='public.office_employee_intake_profiles'::regclass
      and conname='office_employee_intake_emergency_array') then
    alter table public.office_employee_intake_profiles
      add constraint office_employee_intake_emergency_array
      check (jsonb_typeof(emergency_contacts)='array' and jsonb_array_length(emergency_contacts)<=4);
  end if;
  if not exists(select 1 from pg_catalog.pg_constraint
    where conrelid='public.office_employee_intake_profiles'::regclass
      and conname='office_employee_intake_experience_array') then
    alter table public.office_employee_intake_profiles
      add constraint office_employee_intake_experience_array
      check (jsonb_typeof(prior_experience)='array' and jsonb_array_length(prior_experience)<=15);
  end if;
  if not exists(select 1 from pg_catalog.pg_constraint
    where conrelid='public.office_employee_intake_profiles'::regclass
      and conname='office_employee_intake_tax_object') then
    alter table public.office_employee_intake_profiles
      add constraint office_employee_intake_tax_object
      check (jsonb_typeof(tax_declarations)='object');
  end if;
end;
$kravia_extended_intake$;

-- Preserve the existing table-level private service access only.
-- Anonymous and client authenticated roles cannot query or mutate any field.
alter table public.office_employee_intake_profiles enable row level security;
revoke all on public.office_employee_intake_profiles from public,anon,authenticated;
grant select,insert,update on public.office_employee_intake_profiles to service_role;

comment on column public.office_employee_intake_profiles.emergency_contacts is
  'Employee-entered private emergency contacts; read only by self and authorised HR.';
comment on column public.office_employee_intake_profiles.prior_experience is
  'Employee-reported work history, pending HR verification, not inferred employment.';
comment on column public.office_employee_intake_profiles.tax_declarations is
  'Non-identifying tax declarations only; do not store raw PAN, Aadhaar or tax IDs here.';
