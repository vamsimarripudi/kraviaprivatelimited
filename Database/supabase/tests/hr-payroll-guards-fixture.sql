-- Isolated HR payroll regression fixture. Never apply to production.
-- The pre-existing workforce CI fixture intentionally stubs the payroll period.
-- Reproduce the real period columns used by the draft invalidation trigger.
alter table public.office_payroll_periods
  add column if not exists approval_request_id uuid,
  add column if not exists updated_at timestamptz not null default now();
alter table public.office_payroll_adjustments
  add column if not exists amount_minor bigint not null default 0,
  add column if not exists status text not null default 'DRAFT',
  add column if not exists created_by uuid references public.office_identity_users(user_id),
  add column if not exists approved_by uuid references public.office_identity_users(user_id),
  add column if not exists employee_user_id uuid references public.office_identity_users(user_id);
create table if not exists public.office_payroll_attendance_snapshots (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.office_payroll_periods(id),
  employment_id uuid not null references public.office_employment_registry(employment_id),
  prepared_by uuid not null references public.office_identity_users(user_id),
  employee_user_id uuid not null default 'f0000000-0000-4000-8000-000000000004'::uuid references public.office_identity_users(user_id),
  basis_units numeric not null default 126,
  payable_units numeric not null default 6,
  paid_leave_units numeric not null default 0,
  unpaid_leave_units numeric not null default 0,
  absence_units numeric not null default 0,
  unresolved_units numeric not null default 120,
  source_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'DRAFT',
  reviewed_by uuid references public.office_identity_users(user_id),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);
create table if not exists public.office_payroll_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid references public.office_identity_users(user_id),
  period_id uuid references public.office_payroll_periods(id),
  employment_id uuid references public.office_employment_registry(employment_id),
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb
);
