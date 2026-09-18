# Deployment Discovery — refreshed 18 Sep 2026

## GitHub

Canonical repository:

`vamsimarripudi/kraviaprivatelimited`

`main` is the accepted integration branch. Current audited source baseline `a5176bcf36c1d5d3dc0a043540b738e86bf899f3` passed repository, database, backend and frontend GitHub quality gates.

**Decision:** retain KRAVIA Office inside this repository. Do not create a disconnected Office codebase.

## Source architecture

- `Frontend/` — canonical Next.js browser surface for the public company site plus `/office`, `/finance` and `/admin`.
- `Backend/` — canonical FastAPI API/control-plane service (`backend.app:app`).
- `Database/` — versioned Supabase/PostgreSQL control-plane migrations.

Route audit on current `main` confirms **50/50 Office sections and 20/20 Finance sections have specialised surfaces; zero sections fall through to the generic WorkspaceModule fallback**.

## CI

Current accepted `main` run #789 verifies:

- npm install/audit with zero vulnerabilities;
- secret scan;
- ESLint and TypeScript;
- **82 Vitest files / 390 tests**;
- Next.js production build;
- Python dependency/compile checks;
- OpenAPI drift;
- Alembic upgrade through v8;
- **70 backend pytest tests**;
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
- expected production variable names for OIDC, database/Supabase, Company Master, HTTP security and finance execution.

The latest active deployment remains `SLEEPING`, created 17 Sep 2026 (`ae07954a-2cdc-4985-858d-8ef219ef7894`). The service watches `Backend/**`; recent Git-linked main deployments remain `SKIPPED`, including the 18 Sep Finance command-center commit. Current `main` therefore still has no accepted production backend deployment. Service configuration currently shows one Singapore replica, API Dockerfile deployment, pre-deploy Alembic migration and no dedicated background-worker service.

## Supabase live state

Project: `KRAVIA Office` (`xjtazosozxmudkbxqhjl`, `ap-south-1`).

Verified:

- company-registration registry migration applied;
- trigger-only SECURITY DEFINER EXECUTE hardening applied;
- registration tables are RLS-enabled and browser SELECT is denied;
- registration functions are SECURITY INVOKER and browser EXECUTE is denied;
- anon/authenticated have no effective CRUD privilege on any of the 52 legacy FastAPI tables currently lacking RLS;
- `kravia_office_backend` has effective CRUD on all 52, enabling a controlled RLS-policy design once Railway's actual DB login role is confirmed.

Outstanding:

- Supabase Auth leaked-password protection is disabled;
- 52 legacy FastAPI tables remain RLS-disabled as a defense-in-depth gap; do not enable RLS without backend-role policies;
- many Office tables intentionally use service-role-only access and therefore surface RLS-enabled/no-policy INFO findings.

## Vercel

Fresh Vercel discovery on the connected hobby team `vamsimarripudis-projects` still exposes **no project linked to `vamsimarripudi/kraviaprivatelimited`**.

GitHub still receives a failing `Vercel` status pointing to a build-rate-limit condition. Because the corresponding KRAVIA project is not visible through the connected account, current Root Directory, framework, environment-variable and domain configuration cannot be verified.

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

1. Successful frontend deployment from current `main` on the canonical Vercel project.
2. Successful backend deployment from current `main` on the existing Railway service.
3. Frontend `OFFICE_API_ORIGIN` wired to the accepted backend origin.
4. Reconcile subsequent Office Supabase migrations; registration + trigger hardening are already applied.
5. Enable Supabase leaked-password protection and confirm the backend role before legacy-table RLS enforcement.
6. First OWNER live TOTP/AAL2 acceptance.
7. Deploy the dedicated background worker service from `Backend/Dockerfile.worker`, connect verified SLO telemetry/archive storage, and configure provider edge/WAF controls.
8. Production evidence/provider/security gates listed in `FINAL_HANDOVER.md`.

No provider state should be described as complete without read-back evidence.
