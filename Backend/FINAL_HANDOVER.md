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

The public Next.js application remains the browser-facing gateway for `/office` and `/finance`.

- KRAVIA now owns Office identity: FastAPI/PostgreSQL handles passwords, sessions, MFA, Founder bootstrap and private invitations.
- Supabase Auth is not used by the target Office login/register/MFA flow; Supabase/PostgreSQL remains the hosted database/control plane.
- Passwords use Argon2id and are never stored in plaintext.
- Refresh credentials are random, rotated and stored only as hashes; short-lived access JWTs are signed by KRAVIA.
- Access/refresh credentials remain server-side in HttpOnly, SameSite=Strict cookies and are not returned to application JavaScript.
- TOTP MFA is mandatory for Office business access; its secret is encrypted at rest.
- The one-time Founder registration uses a locked Founder display role, maps internally to the protected OWNER authorization boundary, requires a trusted server bootstrap secret and permanently closes after first success.
- New people register only from single-use, expiring private links issued inside Office by AAL2 OWNER/ADMIN authority.
- Existing `office_identity_users`, `office_user_roles`, departments and permission profiles remain the live authorization source of truth.
- Browser mutations retain explicit same-origin protection.
- `/api/office-runtime/[...path]` forwards allowlisted requests using the server-held KRAVIA access token.
- Browser-supplied Authorization/cookies/host headers are not forwarded to FastAPI.
- Provider webhook/public backend paths are not reachable through the browser runtime gateway.
- Upstream redirects are refused, body size is bounded and responses are uncached.
- FastAPI remains the downstream session/RBAC/business-rule authority.

Crawler/sitemap controls continue to classify `/office`, `/finance`, `/admin`, `/api`, `/auth` and legacy `/corporate` as private route families.

## Included executable capabilities

- FastAPI API with SQLAlchemy persistence and Alembic migrations through v9
- PostgreSQL-ready configuration
- KRAVIA first-party JWT/session verification with mandatory `aal2`
- root Next.js `/office` and `/finance` role-scoped workspaces
- same-origin FastAPI BFF gateway for canonical operational data
- one-time Founder registration plus private single-use invitation registration and TOTP activation
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
- root Vitest: **84 files / 394 tests passed**
- Next.js 16.3.5 production build: **PASS**
- production build route manifest includes `/office`, `/finance`, their login/dynamic routes, Office auth APIs and Office runtime gateway
- Python compile: **PASS**
- OpenAPI drift check: **PASS**
- clean Alembic upgrade through v10: **PASS**
- Office backend: **77 tests passed**
- hardened Office quality gate: **PASS**

The test suite covers path-workspace roles, legacy redirects, cookie token non-disclosure, same-origin mutations, fixed-origin runtime proxy controls, identity/MFA/AAL2, Finance & Ownership, GST, accounting close, banking/reconciliation, treasury, expenses/funding, ownership posting, financial assurance, company registrations, Office/runtime audit evidence, Drive taxonomy, security middleware, RBAC, governance and document controls. Route audit confirms **50/50 Office sections and 20/20 Finance sections use specialised surfaces**.

## Production identity state

Target identity architecture is **KRAVIA first-party**.

Source/CI-complete:

- one-time protected Founder bootstrap;
- Argon2id passwords;
- signed short-lived access JWTs;
- rotating hashed refresh sessions;
- encrypted-at-rest TOTP with AAL2;
- failed-login lockout and auditable authentication events;
- private single-use registration links for future people;
- existing authorization/role ledgers reused rather than replaced.

Production cutover remains intentionally pending until the required Railway/Vercel secrets are present and the new backend can deploy outside Railway Free-tier Singapore peak hours. The former Supabase Auth tenant is retained only as a rollback asset until this cutover is accepted; do not delete it before first-party login/MFA acceptance.

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

The FastAPI runtime must use `AUTH_MODE=first_party`, a strong `OFFICE_AUTH_SIGNING_SECRET`, `OFFICE_REQUIRED_AAL=aal2`, and a strong `OFFICE_AUTH_BOOTSTRAP_SECRET`. The bootstrap secret must match the trusted Vercel BFF value until the first Founder registration succeeds.

## Live Supabase security state — verified 18 Sep 2026

The connected `KRAVIA Office` Supabase project is active in `ap-south-1`.

Verified live changes:

- the governed company-registration registry migration is applied;
- `office_company_registrations` and `office_registration_events` have RLS enabled;
- anon/authenticated cannot SELECT the registration tables; service role can;
- registration lifecycle functions are SECURITY INVOKER and browser EXECUTE is denied;
- trigger-only SECURITY DEFINER helpers `office_identity_create_person()` and `office_sync_employment_identity()` have PUBLIC/anon/authenticated EXECUTE revoked and service-role EXECUTE retained;
- all 52 legacy FastAPI tables are owned by `kravia_office_backend`, have RLS enabled and still expose zero anon/authenticated CRUD;
- production SQLAlchemy runtime and Alembic migrations apply transaction-scoped `SET LOCAL ROLE kravia_office_backend` via `DATABASE_EXECUTION_ROLE`;
- the five Alembic v6-v9 service tables are owned by `kravia_office_backend`, have RLS enabled, and explicitly deny anon/authenticated CRUD;
- the live role/ownership/RLS state was read back after migration.

The legacy FastAPI RLS rollout is complete: all 52 tables are RLS-enabled, browser roles retain zero CRUD, production transactions execute under `kravia_office_backend`, and no permissive browser policies were added. Supabase may still report informational no-policy findings for intentionally service-only tables.

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

Railway deployment `7ace95b8-b966-43be-aa4a-f2656624ed74` for backend commit `2e706e4e20838b00688b0c76f60f61d2e21c935e` reached **SUCCESS**. The service still tracks `main`, watches `Backend/**`, uses `Dockerfile.api`, runs `alembic upgrade head` before deploy, checks `/health/live`, and is configured for one Singapore replica. Alembic reached v9 and the pre-deploy/startup path passed with `DATABASE_EXECUTION_ROLE=kravia_office_backend`. A dedicated worker service is not currently provisioned because Railway rejected additional resource creation under the current Free-plan resource limit.

### Vercel frontend

GitHub now reports the Vercel deployment check for current `main` as **SUCCESS** under `kravia1/kraviaprivatelimited`. The connected Vercel token remains scoped to `vamsimarripudis-projects`; direct inspection of the `kravia1` project returns 403 until the connector is re-authenticated to that team. Build success is verified, while root/build settings, production environment variables and domain assignment still require read-back from the correct scope.

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

1. Configure the same strong `OFFICE_AUTH_BOOTSTRAP_SECRET` in the Railway API and trusted Vercel production BFF; never expose it to browser code.
2. Configure a separate strong `OFFICE_AUTH_SIGNING_SECRET` in Railway and set `OFFICE_REQUIRED_AAL=aal2`.
3. Keep the currently live backend on its accepted auth mode until the first-party backend deployment is possible; at cutover set `AUTH_MODE=first_party`.
4. Merge/deploy the first-party identity release, allow Alembic v10 to create/harden the identity tables, then verify `/health/live` and `/api/v1/auth/readiness`.
5. Verify Vercel has the canonical `OFFICE_API_ORIGIN` and deploy the matching frontend release.
6. Open `/office/register`, perform the **one-time Founder registration**, enroll TOTP, verify AAL2 and confirm the page is permanently closed afterward.
7. Sign out and sign back in through `/office/login` using the newly registered first-party credentials.
8. From Office Access Administration, issue a test private registration link for a non-owner role, verify it can be used once only, and revoke/delete the test identity as appropriate.
9. Keep the previous Supabase Auth tenant available only for rollback until this acceptance is complete; then schedule controlled retirement rather than adding new users there.
10. Verify restricted database networking, backups/PITR, restore drill and secret-management/rotation controls.
11. Load/lock verified Company Master and ownership evidence from authoritative sources.
12. Obtain CA approval for GSTIN/tax/SAC/invoice/accounting mappings and close procedure.
13. Obtain CS/legal review for governance, ownership/register handling, retention and controlled funding/mandate language.
14. Configure private object storage + malware scanning and read-only Google Drive runtime identity.
15. Configure Razorpay/RazorpayX, bank/accounting and eSign/DSC providers only after eligibility/approval.
16. Upgrade/provision Railway capacity and deploy the dedicated background-worker service; then connect verified external SLO telemetry/audit archive storage and edge/WAF controls.
17. Perform staging browser/accessibility/security and all-role IDOR/BOLA acceptance plus backup restore drill.
18. Enable live finance execution only after every applicable production gate has evidence.

## Production rule

Never turn a configuration or evidence gap into fabricated success. If a bank feed, GST status, payment provider, FastAPI runtime, cap table or statutory record is not connected and verified, Office must say so explicitly and remain fail-closed for high-risk actions.

The software implements controls and workflows; it does not replace statutory judgment by the company's CA, CS, auditor or legal counsel.
