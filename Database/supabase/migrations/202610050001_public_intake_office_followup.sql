-- Link public Contact, Support and Trust intake to the authenticated Office
-- review workflow without duplicating requester data into a second inbox.
-- Public-request records remain the source of truth; this only adds Office
-- attribution, versioning and append-only follow-up history.

alter table public.contact_enquiries
  add column if not exists office_assigned_to uuid references public.office_identity_users(user_id) on delete set null,
  add column if not exists version integer not null default 1 check (version > 0);

alter table public.support_cases
  add column if not exists office_assigned_to uuid references public.office_identity_users(user_id) on delete set null;

alter table public.support_case_updates
  add column if not exists office_author_user_id uuid references public.office_identity_users(user_id) on delete set null,
  add column if not exists email_delivery_event_id text,
  add column if not exists email_delivery_status text not null default 'NOT_REQUESTED'
    check (email_delivery_status in ('NOT_REQUESTED','PENDING','SENT','FAILED','UNKNOWN')),
  add column if not exists email_delivery_recorded_at timestamptz;

create table if not exists public.contact_enquiry_updates (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.contact_enquiries(id) on delete restrict,
  office_author_user_id uuid references public.office_identity_users(user_id) on delete set null,
  body text not null check (char_length(trim(body)) between 1 and 5000),
  customer_visible boolean not null default false,
  email_delivery_event_id text,
  email_delivery_status text not null default 'NOT_REQUESTED'
    check (email_delivery_status in ('NOT_REQUESTED','PENDING','SENT','FAILED','UNKNOWN')),
  email_delivery_recorded_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists contact_enquiries_office_queue_idx
  on public.contact_enquiries(status, office_assigned_to, updated_at desc);
create index if not exists contact_enquiry_updates_enquiry_idx
  on public.contact_enquiry_updates(enquiry_id, created_at asc);
create index if not exists support_cases_office_queue_idx
  on public.support_cases(queue, status, office_assigned_to, updated_at desc);

alter table public.contact_enquiry_updates enable row level security;
revoke all on public.contact_enquiry_updates from anon, authenticated;
grant select, insert, update on public.contact_enquiry_updates to service_role;

-- Security reports are deliberately not exposed to the general support or
-- privacy workspaces. Only named security operators can open or follow up on
-- them, and a managed device is required for replies.
insert into public.office_permission_catalog(
  code,module,action,label,description,sensitivity,high_risk,requires_managed_device,active
) values
  ('security.public_intake.read','SECURITY','READ_PUBLIC_INTAKE','Read public security reports','Read public security reports without exposing them to general support queues.','CRITICAL',true,true,true),
  ('security.public_intake.manage','SECURITY','MANAGE_PUBLIC_INTAKE','Manage public security reports','Claim, record and send a reviewed response to a public security report.','CRITICAL',true,true,true)
on conflict(code) do update set
  module=excluded.module,action=excluded.action,label=excluded.label,description=excluded.description,
  sensitivity=excluded.sensitivity,high_risk=excluded.high_risk,
  requires_managed_device=excluded.requires_managed_device,active=true;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type) values
  ('SECURITY_OPERATOR','security.public_intake.read','ALLOW','COMPANY'),
  ('SECURITY_OPERATOR','security.public_intake.manage','ALLOW','COMPANY')
on conflict(profile_code,permission_code) do update set
  effect=excluded.effect,default_scope_type=excluded.default_scope_type;
