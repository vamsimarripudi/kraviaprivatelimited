# KRAVIA Office v2.0 — Audited Development Handover

## Purpose and canonical URLs

KRAVIA Office is the company operating system for KRAVIA PRIVATE LIMITED and present/future KRAVIA products. The source remains the `office/` bounded FastAPI subsystem plus the root Next.js path-workspace frontend inside `vamsimarripudi/kraviaprivatelimited`; a separate Office repository is not required.

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

- FastAPI API with SQLAlchemy persistence and Alembic migrations through v5
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
- CSP/security headers, Origin guard, trusted-host option and baseline mutation rate limiter
- reproducible OpenAPI drift verification, secret scan and blocking dependency audit

## Verified automated state

Latest fully green `main` quality run verified:

- `npm ci`: **0 vulnerabilities**
- blocking `npm audit --audit-level=high`: **0 vulnerabilities**
- secret scan: **PASS**
- ESLint: **PASS**
- TypeScript typecheck: **PASS**
- root Vitest: **18 files / 64 tests passed**
- Next.js 16.3.5 production build: **PASS**
- production build route manifest includes `/office`, `/finance`, their login/dynamic routes, Office auth APIs and Office runtime gateway
- Python compile: **PASS**
- OpenAPI drift check: **PASS**
- clean Alembic upgrade through v5: **PASS**
- Office backend: **36 tests passed**
- hardened Office quality gate: **PASS**

The test suite covers path-workspace roles, legacy redirects, cookie token non-disclosure, same-origin mutations, fixed-origin runtime proxy controls, identity/MFA/AAL2, Finance & Ownership, period close, Drive taxonomy, security middleware, RBAC, governance, audit chain and documents.

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
cd office
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

## Current Vercel deployment gate

The connected Vercel project historically had no framework preset and a non-root project Root Directory.

Root `vercel.json` now forces `framework: "nextjs"`. Vercel accepted that override and began the Next.js builder, then returned `NEXT_NO_VERSION` because its configured Root Directory does not contain the repository-root `package.json`. The repository itself is correct: normal CI runs `next build` successfully and produces all required routes.

One Vercel project setting must therefore be changed before live route acceptance:

- **Project Settings → Build and Deployment → Root Directory → repository root** (blank / `.`).

After that, redeploy `main`, configure the production environment values above, and attach the apex `kraviaprivatelimited.com` domain. This Root Directory setting is project metadata and has no supported `vercel.json` override.

## Run checks

```bash
npm ci
npm audit --audit-level=high
npm run lint
npm run typecheck
npm test
npm run build

cd office
python -m pytest backend/tests -q
python scripts/export_openapi.py --check
python scripts/quality_gate.py
```

## Drive evidence boundary

The reviewed KRAVIA Office Drive taxonomy covers Company Master, Governance, Compliance, Finance & Accounting, GST & Tax, Banking & Payments, Customers & Contracts, Vendors & Procurement, and People & HR. The application reports evidence areas by metadata and can flag obvious filing anomalies without copying private documents.

Evidence presence is not treated as legal approval. Company, ownership, tax and governance values must come from authoritative reviewed records.

## Production activation sequence

1. Correct the Vercel project Root Directory to the repository root and redeploy `main`.
2. Configure the dedicated Office Supabase variables and attach `kraviaprivatelimited.com`; verify `/`, `/office/login`, `/finance/login`, `/admin/login` and legacy redirects.
3. Deploy the canonical FastAPI runtime and set `OFFICE_API_ORIGIN`; configure matching production OIDC/JWKS/AAL2 settings.
4. Sign in through `/office/login`, enroll/verify the first TOTP factor and prove `aal2`.
5. Provision/verify managed PostgreSQL, restricted networking, backups/PITR, restore drill and secret manager.
6. Load/lock verified Company Master and ownership data from authoritative evidence.
7. Obtain CA approval for GSTIN/tax/SAC/invoice/accounting mappings and close procedure.
8. Obtain CS/legal review for governance, ownership/register handling, retention and controlled funding/mandate language.
9. Configure private object storage + malware scanning and read-only Google Drive runtime identity.
10. Configure Razorpay/RazorpayX, bank/accounting and eSign/DSC providers only after eligibility/approval.
11. Provision queue/background workers, shared edge/WAF controls, monitoring, alerts, SLOs and audit retention.
12. Perform staging browser/accessibility/security and all-role IDOR/BOLA acceptance plus backup restore drill.
13. After `/office` and `/finance` are accepted, redirect/retire `office.kraviaprivatelimited.com`.
14. Enable live finance execution only after every applicable production gate has evidence.

## Production rule

Never turn a configuration or evidence gap into fabricated success. If a bank feed, GST status, payment provider, FastAPI runtime, cap table or statutory record is not connected and verified, Office must say so explicitly and remain fail-closed for high-risk actions.

The software implements controls and workflows; it does not replace statutory judgment by the company's CA, CS, auditor or legal counsel.
