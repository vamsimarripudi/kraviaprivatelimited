-- CA / Tax Professional GST delegation. KRAVIA Office, 2026-11-15.
-- Authority: grant CA operational GST rights without OWNER, payment-execution
-- or unverified statutory-signatory privileges.
-- Requires an ACTIVE CA Office identity + a separately assigned CA_TAX profile,
-- AAL2 session and trusted company-managed device for high-risk operations.
--
-- All grants are already present in the canonical permission catalog.
-- registration.manage covers company registration records; only grant CA_TAX
-- to a CA explicitly appointed to handle the company's statutory registrations.
-- Does NOT provide GST portal credentials, e-invoice/IRP activation, company
-- bank-transfer execution, identity administration or automatic EVC authority.

do $ca_gst_catalog$
begin
  if not exists(
    select 1 from public.office_access_profile_catalog
    where code='CA_TAX' and active=true
  ) then raise exception 'Active CA_TAX profile must exist'; end if;
  if not exists(select 1 from public.office_role_catalog
    where role='CA' and active=true) then raise exception 'Active CA role missing'; end if;
  if exists (
    select 1 from (values
      ('tax.gst.approve'),('registration.manage'),('finance.bank.read'),
      ('document.finance.create'),('document.instance.read'),
      ('document.instance.review'),('document.render')
    ) as desired(code)
    left join public.office_permission_catalog p on p.code=desired.code
    where p.code is null or p.active is distinct from true
  ) then raise exception 'Required GST delegation permission inactive or missing'; end if;
  if not exists (
    select 1 from public.office_permission_catalog
    where code='tax.gst.approve' and high_risk=true and requires_managed_device=true
  ) then raise exception 'GST approval must require managed device'; end if;
end $ca_gst_catalog$;

insert into public.office_access_profile_permissions
  (profile_code,permission_code,effect,default_scope_type)
values
  ('CA_TAX','tax.gst.approve','ALLOW','COMPANY'),
  ('CA_TAX','registration.manage','ALLOW','COMPANY'),
  ('CA_TAX','finance.bank.read','ALLOW','COMPANY'),
  ('CA_TAX','document.finance.create','ALLOW','COMPANY'),
  ('CA_TAX','document.instance.read','ALLOW','COMPANY'),
  ('CA_TAX','document.instance.review','ALLOW','COMPANY'),
  ('CA_TAX','document.render','ALLOW','COMPANY')
on conflict (profile_code,permission_code) do update
set effect=excluded.effect,default_scope_type=excluded.default_scope_type;
