-- The Office BFF uses a server-only Supabase service credential for selected
-- cross-domain read models. Legacy core tables are owned by the backend role,
-- so grant SELECT explicitly instead of granting mutation privileges.

grant select on public.customers to service_role;
grant select on public.products to service_role;
grant select on public.invoices to service_role;
grant select on public.contracts to service_role;
grant select on public.compliance_obligations to service_role;
grant select on public.integration_registry to service_role;
grant select on public.operational_alerts to service_role;
grant select on public.legal_entities to service_role;
