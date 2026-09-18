# KRAVIA Office v2.0 — Audited Development Handover

## Purpose and canonical URLs

KRAVIA Office is the company operating system for KRAVIA PRIVATE LIMITED and present/future KRAVIA products. The source remains the `Backend/` FastAPI subsystem plus the `Frontend/` Next.js path-workspace surface inside `vamsimarripudi/kraviaprivatelimited`; a separate Office repository is not required.

Canonical browser model:

- `https://kraviaprivatelimited.com/` — public company website;
- `https://kraviaprivatelimited.com/office` — directors, corporate operations, governance, HR, legal/CS and product administration;
- `https://kraviaprivatelimited.com/finance` — Finance/CA/Auditor/GST/accounting/banking/reconciliation and authorised ownership/funding views;
- `https://kraviaprivatelimited.com/admin` — public website/content/request administration using its separate website-admin identity boundary.

`office.kraviaprivatelimited.com` is no longer the canonical application URL. Keep it until the path deployment has been accepted, then redirect or retire it.

## Architecture principle

Products create business. KRAVIA Office provides the canonical corporate/commercial control layer:

`Product event → customer/commercial context → billing/tax → payment → accounting → reconciliation → evidence → governance/compliance/audit`.

Legal ownership, shareholder/director funding, customer revenue and vendor/company payouts are separate domains. A payment or contribution never changes ownership automatically.

## Path-workspace security architecture

The public Next.js application is the browser-facing gateway for `/office` and `/finance`.

- Dedicated KRAVIA Office Supabase Auth tenant, separate from the website-admin Supabase tenant.
- Asymmetric JWT signing system active.
- `public.office_custom_access_token_hook` active with explicit `office_roles` and `office_access_status` claims.
- Public Office self-signup disabled.
- First named approved identity is ACTIVE with intentionally assigned `OWNER` role.
- Password sessions use server-side BFF routes and HttpOnly, SameSite=Strict cookies; access/refresh tokens are not returned to application JavaScript.
- TOTP enrollment/challenge/verification is integrated into `/office/login` and `/finance/login`.
- Workspace entry requires `aal2` plus an active permitted Office role.
- Browser mutations have an explicit same-origin guard.
- `/api/office-runtime/[...path]` forwards allowlisted calls to the canonical FastAPI runtime using the server-held verified JWT.
- Browser-supplied Authorization/cookies/host headers are not forwarded to FastAPI.
- Provider webhook/auth/public backend paths are not reachable through the browser runtime gateway.
- Upstream redirects are refused, body size is bounded and responses are uncached.
- FastAPI remains the downstream JWT/RBAC/business-rule authority.

Crawler/sitemap controls also classify `/office`, `/finance`, `/admin`, `/api`, `/auth` and legacy `/corporate` as private route families.

## Included executable capabilities

- FastAPI API with SQLAlchemy persistence and Alembic migrations through v8
- PostgreSQL-ready configuration
- production OIDC/JWT verification with mandatory `aal2`
- root Next.js `/office` and `/finance` role-scoped workspaces
- same-origin FastAPI BFF gateway for canonical operational data
- TOTP enrollment/challenge/verification web flow with no Office self-registration endpoint
- server-side RBAC and maker-checker approval controls
- company/product/customer masters and commercial plans/subscriptions
- invoices, GST calculations, payments, receipts, credit notes, refunds and settlements
- double-entry operational journal and trial balance
- accounting/TAX/BOTH period locks with controlled reopen
- bank-account registry, bank transaction ingestion and reconciliation
- Finance & Ownership share ledger, funding, expenses, contribution calls, mandates and payment instructions
- disabled/sandbox/live finance execution boundary, RazorpayX adapter and signed Razorpay webhook handling
- governance meetings, resolutions, CTC generation and authority grants
- compliance, authority notices, vendors, contracts, people and assets
- versioned/locked private document vault with SHA-256 integrity
- inspection cases and evidence-pack manifests
- read-only Google Drive metadata discovery/readiness
- transactional outbox/domain-event model and workflow registry
- dedicated durable background-worker runtime with distributed advisory locking, heartbeat and bounded outbox processing
- backend-owned runtime alerts/operations summary and explicit SLO measurement-readiness boundaries
- audit-retention policies, legal holds and deterministic archive manifests with destructive purge disabled
- CSP/security headers, Origin guard, trusted-host option and shared database-backed cross-replica mutation rate limiting
- reproducible OpenAPI drift verification, secret scan and blocking dependency audit

## Verified automated state

Latest fully green `main` quality run verified:

- `npm ci`: **0 vulnerabilities**
- blocking `npm audit --audit-level=high`: **0 vulnerabilities**
- secret scan: **PASS**
- ESLint: **PASS**
- TypeScript typecheck: **PASS**
- root Vitest: **82 files / 390 tests passed**
- Next.js 16.3.5 production build: **PASS**
- production build route manifest includes `/office`, `/finance`, their login/dynamic routes, Office auth APIs and Office runtime gateway
- Python compile: **PASS**
- OpenAPI drift check: **PASS**
- clean Alembic upgrade through v8: **PASS**
- Office backend: **70 tests passed**
- hardened Office quality gate: **PASS**

The test suite covers path-workspace roles, legacy redirects, cookie token non-disclosure, same-origin mutations, fixed-origin runtime proxy controls, identity/MFA/AAL2, Finance & Ownership, GST, accounting close, banking/reconciliation, treasury, expenses/funding, ownership posting, financial assurance, company registrations, Office/runtime audit evidence, Drive taxonomy, security middleware, RBAC, governance and document controls. Route audit confirms **50/50 Office sections and 20/20 Finance sections use specialised surfaces**.

## Production identity state

Dedicated hosted project: `KRAVIA Office`, project ref `xjtazosozxmudkbxqhjl`, Mumbai (`ap-south-1`).

Completed hosted identity actions:

- asymmetric signing key activated;
- custom access-token hook enabled;
- public signup disabled;
- first named identity created and confirmed;
- first named identity set ACTIVE and assigned OWNER;
- hook output verified for the assigned OWNER and fail-closed unassigned identities.

Remaining first-user identity acceptance: enroll/verify the OWNER TOTP factor through `/office/login` and prove the resulting session reaches `aal2`.

## Canonical FastAPI runtime

ASGI application:

```text
backend.app:app
```

Development:

```bash
cd Backend
python -m pip install -r backend/requirements.txt
alembic upgrade head
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

The production browser should not use the old static Office frontend as a second canonical application. Root Next.js path workspaces call FastAPI through the same-origin BFF.

## Root deployment variables

```text
NEXT_PUBLIC_SITE_URL=https://kraviaprivatelimited.com
OFFICE_SUPABASE_URL=https://xjtazosozxmudkbxqhjl.supabase.co
OFFICE_SUPABASE_PUBLISHABLE_KEY=<active modern publishable key>
OFFICE_API_ORIGIN=https://<canonical FastAPI runtime origin>
```

The FastAPI runtime must use matching production OIDC issuer/JWKS/audience, `OIDC_ROLE_CLAIM=office_roles` and `OIDC_REQUIRED_AAL=aal2`.

## Live Supabase security state — verified 18 Sep 2026

The connected `KRAVIA Office` Supabase project is active in `ap-south-1`.

Verified live changes:

- the governed company-registration registry migration is applied;
- `office_company_registrations` and `office_registration_events` have RLS enabled;
- anon/authenticated cannot SELECT the registration tables; service role can;
- registration lifecycle functions are SECURITY INVOKER and browser EXECUTE is denied;
- trigger-only SECURITY DEFINER helpers `office_identity_create_person()` and `office_sync_employment_identity()` have PUBLIC/anon/authenticated EXECUTE revoked and service-role EXECUTE retained;
- a full effective-privilege check of all 52 legacy FastAPI tables currently lacking RLS shows anon/authenticated have no SELECT/INSERT/UPDATE/DELETE on any of them;
- `kravia_office_backend` has effective CRUD on all 52 of those legacy tables.

Do not mass-enable RLS on the 52 legacy tables until the Railway `DATABASE_URL` login role is positively confirmed and matching backend-only policies are prepared. The current state is a defense-in-depth hardening gap, **not evidence of browser access**.

Outstanding Supabase Auth setting: leaked-password protection is currently disabled and should be enabled before production identity acceptance.

## Current deployment reality — verified 18 Sep 2026

### Railway backend

An existing Railway production service is already connected:

- service: `kravia-office-api`
- GitHub source: `vamsimarripudi/kraviaprivatelimited`
- branch: `main`
- root directory: `Backend`
- builder: `Dockerfile.api`
- health check: `/health/live`
- service domain: `kravia-office-api-production.up.railway.app`
- deployment variable names include the expected production OIDC, database, Company Master, security and finance-mode configuration.

The database URL normalizer in current source also permanently canonicalizes the historical `sshmode` typo to `sslmode` and supports the configured Supabase IPv4 pooler path. The 16 Sep failure caused by `sshmode` is therefore historical.

Fresh Railway discovery confirms the existing API service still tracks `main`, watches `Backend/**`, uses `Dockerfile.api`, runs `alembic upgrade head` before deploy, checks `/health/live`, and is configured for one Singapore replica. Its latest active deployment remains the 17 Sep 2026 sleeping deployment, while newer Git-linked main records are `SKIPPED`. A dedicated worker service is not currently provisioned. Current source must not be called live on Railway until current API and worker deployments reach accepted terminal states.

### Vercel frontend

Fresh discovery on the connected Vercel hobby team `vamsimarripudis-projects` still lists no project linked to `vamsimarripudi/kraviaprivatelimited`. GitHub still receives a failing `Vercel` status pointing to a build-rate-limit condition. Therefore the prior project-specific Root Directory diagnosis is historical evidence only; the current Vercel project/account, build root, environment variables and domain assignment must be rediscovered/verified before frontend production acceptance.

Do not attach Office to an unrelated Vercel project simply to clear the status. The canonical browser model remains the company site with `/office` and `/finance`; Railway is the API runtime.

## Run checks

```bash
npm ci
npm audit --audit-level=high
npm run lint
npm run typecheck
npm test
npm run build

cd Backend
python -m pytest backend/tests -q
python scripts/export_openapi.py --check
python scripts/quality_gate.py
```

## Drive evidence boundary

The reviewed KRAVIA Office Drive taxonomy covers Company Master, Governance, Compliance, Finance & Accounting, GST & Tax, Banking & Payments, Customers & Contracts, Vendors & Procurement, and People & HR. The application reports evidence areas by metadata and can flag obvious filing anomalies without copying private documents.

Evidence presence is not treated as legal approval. Company, ownership, tax and governance values must come from authoritative reviewed records.

## Production activation sequence

1. Identify/reconnect the Vercel project that owns the KRAVIA company frontend, or create a dedicated project from this repository only if no canonical project exists; verify root/build settings instead of relying on the old mismatch diagnosis.
2. Deploy current `main` successfully on Vercel and verify `/`, `/office/login`, `/finance/login`, `/admin/login`, private-route noindex behavior and legacy redirects.
3. Deploy current `main` to the existing Railway `kravia-office-api` service and observe a terminal successful deployment plus `/health/live`.
4. Set/verify frontend `OFFICE_API_ORIGIN` against the accepted Railway API origin and exercise the same-origin runtime gateway.
5. Sign in through `/office/login`, enroll/verify the first OWNER TOTP factor and prove the resulting session reaches `aal2`.
6. Confirm the Railway `DATABASE_URL` database role, then design/apply backend-only RLS policies for the 52 legacy FastAPI tables; verify restricted networking, backups/PITR, restore drill and secret management.
7. Registration-registry and trigger-function hardening migrations are already applied live. Reconcile subsequent Office migrations and enable Supabase Auth leaked-password protection.
8. Load/lock verified Company Master and ownership evidence from authoritative sources.
9. Obtain CA approval for GSTIN/tax/SAC/invoice/accounting mappings and close procedure.
10. Obtain CS/legal review for governance, ownership/register handling, retention and controlled funding/mandate language.
11. Configure private object storage + malware scanning and read-only Google Drive runtime identity.
12. Configure Razorpay/RazorpayX, bank/accounting and eSign/DSC providers only after eligibility/approval.
13. Deploy the committed dedicated background-worker service (`Backend/Dockerfile.worker`), connect verified external SLO telemetry and audit archive storage, and configure provider edge/WAF controls.
14. Perform staging browser/accessibility/security and all-role IDOR/BOLA acceptance plus backup restore drill.
15. Enable live finance execution only after every applicable production gate has evidence.

## Production rule

Never turn a configuration or evidence gap into fabricated success. If a bank feed, GST status, payment provider, FastAPI runtime, cap table or statutory record is not connected and verified, Office must say so explicitly and remain fail-closed for high-risk actions.

The software implements controls and workflows; it does not replace statutory judgment by the company's CA, CS, auditor or legal counsel.
