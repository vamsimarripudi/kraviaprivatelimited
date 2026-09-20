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

- FastAPI API with SQLAlchemy persistence and Alembic migrations through v14
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
- root Vitest: **85 files / 408 tests passed**
- Next.js 16.3.5 production build: **PASS**
- production build route manifest includes `/office`, `/finance`, their login/dynamic routes, Office auth APIs and Office runtime gateway
- Python compile: **PASS**
- OpenAPI drift check: **PASS**
- clean Alembic upgrade through v14: **PASS**
- Office backend: **100 tests passed**
- hardened Office quality gate: **PASS**

The test suite covers path-workspace roles, legacy redirects, cookie token non-disclosure, same-origin mutations, fixed-origin runtime proxy controls, identity/MFA/AAL2, Finance & Ownership, GST, accounting close, banking/reconciliation, treasury, expenses/funding, ownership posting, financial assurance, company registrations, Office/runtime audit evidence, Drive taxonomy, security middleware, RBAC, governance and document controls. Route audit confirms **50/50 Office sections and 20/20 Finance sections use specialised surfaces**.

## Production identity state

The active Office identity architecture is **KRAVIA first-party FastAPI/PostgreSQL** and has live acceptance evidence.

Verified on 20 Sep 2026:

- the protected one-time Founder bootstrap has completed;
- the Founder identity is ACTIVE;
- TOTP enrollment is verified and AAL2 has been exercised;
- successful login, refresh and MFA verification events exist in the live first-party auth event ledger;
- active first-party sessions exist in `office_auth_sessions_v2`;
- the live database is at Alembic v14;
- Office password/session authority is not Supabase Auth.

Supabase remains the hosted PostgreSQL/control-plane platform. Trusted server-side `OFFICE_SUPABASE_*` variables are database/control-plane credentials; they must not be used as the login-readiness signal. The browser-facing Office/Finance path must gate on the first-party runtime configured through `OFFICE_API_ORIGIN`.

The former Supabase Auth artifacts may remain as rollback/history until deliberately retired, but new Office identity features must not depend on `admin.auth.admin`, Supabase password recovery, Supabase MFA, or Supabase invite APIs.

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

The FastAPI runtime uses the accepted first-party identity path with `AUTH_MODE=first_party`, `OFFICE_REQUIRED_AAL=aal2` and a strong signing secret. The one-time Founder bootstrap has already completed; bootstrap credentials should remain controlled and should not be re-opened.

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

Supabase may still report leaked-password protection as disabled. That setting is not an active KRAVIA Office identity gate because Office password/session authority is first-party FastAPI/PostgreSQL; enable it only if Supabase Auth is deliberately reused for another surface.

## Current deployment reality — verified 20 Sep 2026

### Accepted source/runtime baseline

Current accepted `main` commit: `faa24b2878e2884f0a3004ab5da0985ebed9f1c4`.

- GitHub Actions: **SUCCESS**.
- Frontend quality: **85 Vitest files / 408 tests**, lint, typecheck, npm dependency audit, secret scan and Next.js production build all pass.
- Backend quality: **100 pytest tests**, OpenAPI drift verification, Alembic through v14, quality gate, API-container liveness and worker smoke all pass.
- Vercel deployment check on current `main`: **SUCCESS**.
- Railway API latest deployment: **SUCCESS**.
- Railway worker latest deployment: **SUCCESS**.
- Worker heartbeat is live on the configured 60-second cadence with no recorded failure at audit time.
- Supabase/PostgreSQL live revision: **v14** (`63d2f419ab77`).
- Checked first-party auth/GST tables expose no `anon` or `authenticated` table grants; service-only RLS remains fail-closed.

### Evidence gaps that remain

The Vercel connector in this chat is scoped to a different team from the canonical `kravia1/kraviaprivatelimited` project. GitHub proves the deployment check is green, but production environment/domain read-back—including direct inspection of `OFFICE_API_ORIGIN`—still requires the correct Vercel team scope.

Railway currently reports one staged production change. Its exact field/value is not readable with the present connector and this audit did not accept or deploy it.

### GST provider state

Source now contains:

- IRIS IRP/e-Invoice integration;
- IRIS VAS purchase-data download/import/reconciliation;
- product tax profiles and GST return workings;
- Fynamics/FYN Gateway GSP taxpayer OTP, save/submit, EVC filing request, ARN/status verification and GSTR-2B/ledger reads.

The Railway API environment does not currently expose the required `GST_IRP_*`, `GST_IRP_VAS_*`, or `GST_GSP_*` provider configuration. These workflows therefore remain correctly fail-closed until provider onboarding, taxpayer authorization, sandbox acceptance and production credentials are completed. The final Fynamics EVC path remains version-gated by the configured filing contract.

### Audit-resume branch

Branch `office/audit-resume-20260920` fixes the cutover inconsistencies found during this audit:

- Finance login now gates on the first-party runtime;
- the shared Office/Finance workspace guard now gates on the first-party runtime;
- collaboration @mention resolution now uses `office_auth_users`, not Supabase Auth;
- workforce administration now uses `office_auth_users`, not Supabase Auth;
- Operations Readiness now distinguishes first-party auth runtime from Supabase database authority;
- Operations Readiness now reads `office_auth_sessions_v2` rather than the empty legacy tracking-session table;
- environment documentation now describes Supabase as the data/control plane, not the active identity provider.

These changes remain unmerged at the point this handover was updated and are gated by PR CI on the exact branch head.

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

## Production activation sequence from the current accepted state

1. Run PR CI for `office/audit-resume-20260920`; review and merge only after all frontend/backend/database/repository gates are green.
2. Re-authenticate the Vercel connector to the canonical `kravia1` team and read back the production project, domain and `OFFICE_API_ORIGIN` configuration.
3. Inspect the single staged Railway production change before any acceptance/deploy operation; do not accept an unknown staged patch.
4. Complete a full all-role IDOR/BOLA, browser, accessibility and security acceptance pass against the production-like deployment.
5. Verify restricted database networking, backup/PITR, restore drill and secret rotation procedures.
6. Configure IRIS IRP sandbox credentials and acceptance-test GSTIN verification plus e-Invoice generate/cancel before enabling live IRN operations.
7. Configure IRIS VAS authorization and acceptance-test purchase-data download/import/reconciliation against authoritative provider data.
8. Complete Fynamics/FYN Gateway GSP onboarding, taxpayer OTP/session authorization and sandbox contract acceptance; only then enable the version-gated final EVC filing contract.
9. Load/lock authoritative Company Master, GST and ownership evidence and obtain CA approval for GST/SAC/invoice/accounting mappings and return review procedure.
10. Obtain CS/legal review for governance, ownership/register handling, retention and controlled funding/mandate language.
11. Configure live Razorpay/RazorpayX, bank/accounting, private object storage/malware scanning, eSign/DSC and Drive service identity only after each provider is approved and acceptance-tested.
12. Connect verified external SLO telemetry, durable audit archive storage and provider edge/WAF controls.
13. Enable each live financial/statutory execution capability only after its applicable evidence gate is satisfied.

## Production rule

Never turn a configuration or evidence gap into fabricated success. If a bank feed, GST status, payment provider, FastAPI runtime, cap table or statutory record is not connected and verified, Office must say so explicitly and remain fail-closed for high-risk actions.

The software implements controls and workflows; it does not replace statutory judgment by the company's CA, CS, auditor or legal counsel.
