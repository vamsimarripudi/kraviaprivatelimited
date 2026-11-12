-- KRAVIA Office: live workforce overview needs non-secret Office session status.
-- The service_role currently has no SELECT privilege on auth_sessions_v2,
-- making the entire People availability widget fail with a generic 503.
-- Least privilege: grant only the seven status columns requested by the
-- existing server read model. Never expose refresh_token_hash, user-agent
-- fingerprints, IP addresses or arbitrary session records to browser roles.
grant select (
  user_id, status, aal, created_at, last_seen_at, expires_at, revoked_at
) on public.office_auth_sessions_v2 to service_role;

-- RLS remains enabled. Neither anon nor authenticated can select the table.
-- No employee, session, login state, attendance or MFA fact is mutated here.
