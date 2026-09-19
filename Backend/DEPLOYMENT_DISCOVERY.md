# Deployment Discovery — refreshed 18 Sep 2026

## GitHub

Canonical repository:

`vamsimarripudi/kraviaprivatelimited`

`main` is the accepted integration branch. Current audited backend baseline `2e706e4e20838b00688b0c76f60f61d2e21c935e` passed repository, database, backend and frontend GitHub quality gates and its quality-gated Railway deployment completed successfully.

**Decision:** retain KRAVIA Office inside this repository. Do not create a disconnected Office codebase.

## Source architecture

- `Frontend/` — canonical Next.js browser surface for the public company site plus `/office`, `/finance` and `/admin`.
- `Backend/` — canonical FastAPI API/control-plane service (`backend.app:app`).
- `Database/` — versioned Supabase/PostgreSQL control-plane migrations.

Route audit on current `main` confirms **50/50 Office sections and 20/20 Finance sections have specialised surfaces; zero sections fall through to the generic WorkspaceModule fallback**.

## CI

Current accepted `main` run #820 verifies:

- npm install/audit with zero vulnerabilities;
- secret scan;
- ESLint and TypeScript;
- **84 Vitest files / 394 tests**;
- Next.js production build;
- Python dependency/compile checks;
- OpenAPI drift;
- Alembic upgrade through v10;
- **77 backend pytest tests**;
- hardened backend quality gate;
- Railway Docker image build and liveness smoke test;
- repository and database structure checks.

## Railway

Existing production project: `nurturing-healing`.

Existing service: `kravia-office-api`.

Verified service configuration:

- source repo `vamsimarripudi/kraviaprivatelimited`;
- branch `main`;
- root directory `Backend`;
- Dockerfile `Dockerfile.api`;
- health check `/health/live`;
- one production replica configuration;
- Railway domain `kravia-office-api-production.up.railway.app`;
- expected production variable names for database/Supabase control-plane access, Company Master, HTTP security and finance execution. The first-party release additionally requires `OFFICE_AUTH_SIGNING_SECRET`, `OFFICE_AUTH_BOOTSTRAP_SECRET`, `OFFICE_REQUIRED_AAL=aal2` and `AUTH_MODE=first_party` at cutover.

Deployment `7ace95b8-b966-43be-aa4a-f2656624ed74` for commit `2e706e4e20838b00688b0c76f60f61d2e21c935e` reached **SUCCESS** on 18 Sep 2026. The build used `Backend/Dockerfile.api`; pre-deploy Alembic completed through v9 and Railway accepted the `/health/live` health check. `DATABASE_EXECUTION_ROLE=kravia_office_backend` is present so SQLAlchemy runtime and Alembic transactions drop into the dedicated backend role even though the Supavisor login is provider-managed. Service configuration shows one Singapore replica. A dedicated background-worker service is still absent: Railway rejected creation because the current Free plan has reached its resource-provision limit.

## Supabase live state

Project: `KRAVIA Office` (`xjtazosozxmudkbxqhjl`, `ap-south-1`).

Verified:

- company-registration registry migration applied;
- trigger-only SECURITY DEFINER EXECUTE hardening applied;
- registration tables are RLS-enabled and browser SELECT is denied;
- registration functions are SECURITY INVOKER and browser EXECUTE is denied;
- all 52 legacy FastAPI tables are owned by `kravia_office_backend`, RLS-enabled, and expose zero anon/authenticated CRUD;
- production runtime/Alembic execution is constrained transaction-by-transaction with `SET LOCAL ROLE kravia_office_backend`;
- Alembic v6-v9 service tables (`worker_heartbeats`, retention/legal-hold/archive-manifest tables and shared rate-limit windows) are owned by `kravia_office_backend`, have RLS enabled and explicitly deny anon/authenticated CRUD;
- the live Supabase migration history records the ownership and RLS hardening, and the equivalent source migration is now versioned in `Database/supabase/migrations`.

Outstanding:

- Supabase Auth leaked-password protection is disabled;
- the legacy FastAPI RLS backlog is closed; remaining RLS-enabled/no-policy findings are informational for intentionally service-only tables;
- many service-only Office tables intentionally use RLS with no browser policies and therefore surface informational no-policy findings.

## Vercel

GitHub now reports the current-main Vercel deployment check as **SUCCESS** for the separate `kravia1/kraviaprivatelimited` project context.

The connected Vercel token is still scoped to the `vamsimarripudis-projects` team. Direct inspection of `kravia1` returns HTTP 403 and explicitly requires re-authentication to that scope. Therefore deployment success is verified, but current Root Directory, framework, production environment variables and domain configuration cannot yet be read back from this connector.

**Decision:** treat the old Root Directory mismatch as historical, not current fact. Rediscover or reconnect the canonical KRAVIA Vercel project/account before changing production settings. Do not attach Office to an unrelated product project.

## Canonical domains

Browser model:

- `https://kraviaprivatelimited.com/`
- `https://kraviaprivatelimited.com/office`
- `https://kraviaprivatelimited.com/finance`
- `https://kraviaprivatelimited.com/admin`

Backend API target:

- Railway service domain above until an approved custom API domain is configured.

`office.kraviaprivatelimited.com` is not the canonical application model; if it still exists, keep it only as a controlled redirect/retirement concern after path deployment acceptance.

## Immediate activation gates

1. Keep the current live identity path untouched until the first-party release is ready to deploy.
2. Configure a strong Railway-only `OFFICE_AUTH_SIGNING_SECRET`.
3. Configure the **same** strong `OFFICE_AUTH_BOOTSTRAP_SECRET` in Railway and the trusted Vercel production project; it must never be exposed to browser code.
4. At the actual backend cutover set `AUTH_MODE=first_party` and `OFFICE_REQUIRED_AAL=aal2`, deploy the new backend and verify Alembic v10 + auth readiness.
5. Verify Vercel `OFFICE_API_ORIGIN`, deploy the matching frontend and complete the one-time Founder registration/TOTP/AAL2 flow.
6. Verify Founder registration is permanently closed afterward; future onboarding must succeed only through single-use links created in Office Access Administration.
7. Keep browser database grants closed and preserve `DATABASE_EXECUTION_ROLE=kravia_office_backend`.
8. Upgrade/provision Railway capacity and deploy the dedicated background worker service when required.
9. Connect verified SLO telemetry/archive storage and configure provider edge/WAF controls.
10. Complete the remaining evidence/provider/security gates listed in `FINAL_HANDOVER.md`.

Supabase Auth leaked-password protection is no longer an Office identity gate because Supabase Auth is removed from the target login/register/MFA architecture.

No provider state should be described as complete without read-back evidence.
