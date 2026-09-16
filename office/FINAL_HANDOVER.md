# KRAVIA Office v2.0 — Audited Development Handover

## Purpose and canonical URLs

KRAVIA Office is the company operating system for KRAVIA PRIVATE LIMITED and present/future KRAVIA products. The source remains the `office/` bounded backend subsystem plus the root Next.js path-workspace frontend inside `vamsimarripudi/kraviaprivatelimited`; a separate Office repository is not required.

The canonical browser URL model is now:

- `/` — public KRAVIA PRIVATE LIMITED website;
- `/office` — directors, corporate operations, governance, HR, legal/CS and product administration;
- `/finance` — Finance/CA/Auditor/GST/accounting/banking/reconciliation and authorised ownership/funding views;
- `/admin` — public-website/content/request administration only, using a separate identity boundary.

`office.kraviaprivatelimited.com` is no longer the canonical browser application URL. Keep its DNS unchanged until `/office` and `/finance` are deployed and accepted, then retire or redirect it. See `PATH_WORKSPACES.md`.

## Architecture principle

Products create business. KRAVIA Office provides the canonical corporate/commercial control layer:

`Product event → customer/commercial context → billing/tax → payment → accounting → reconciliation → evidence → governance/compliance/audit`.

Ownership/legal equity, shareholder/director funding, customer revenue and vendor/company payouts are separate domains. A payment/contribution must never mutate ownership automatically.

Every material record should be able to answer: who owns it, what its status is, what changed, who changed it, what evidence supports it, what approval controls apply, and what happens next.

## Path-workspace security architecture

The public Next.js application is the browser-facing gateway for `/office` and `/finance`.

- Dedicated KRAVIA Office Supabase Auth tenant; it is not the website-admin Supabase tenant.
- Modern asymmetric JWT signing system activated.
- Hosted Custom Access Token hook enabled with explicit `office_roles` and `office_access_status` claims.
- Office public self-signup disabled.
- First approved human identity is active with the intentionally assigned `OWNER` role.
- Password sessions use server-side BFF routes and `HttpOnly`, `SameSite=Strict` cookies; access/refresh tokens are not returned to application JavaScript.
- TOTP enrollment/challenge/verification is integrated into `/office/login` and `/finance/login`.
- Workspace entry requires `aal2` plus an active Office role.
- Module navigation and server route guards are role-scoped.
- Browser mutations have an explicit same-origin check in addition to strict cookies.
- `/api/office-runtime/[...path]` forwards allowlisted requests to the canonical FastAPI runtime with the server-held verified JWT.
- Browser-supplied Authorization, cookies and host headers are not forwarded to FastAPI.
- Provider webhook/auth/public backend paths cannot be reached through the internal runtime gateway.
- Upstream redirects are refused, controlled request bodies are bounded, and responses are not cached.
- FastAPI remains the downstream cryptographic JWT, RBAC and business-rule authority, providing a second enforcement layer.

## Included executable capabilities

- FastAPI API with SQLAlchemy persistence and Alembic migrations through v5
- PostgreSQL-ready configuration
- production OIDC/JWT verification with custom Office role claims and mandatory `aal2` MFA gate
- root Next.js `/office` and `/finance` role-scoped workspaces
- same-origin FastAPI BFF gateway for canonical operational data
- TOTP enrollment/challenge/verification web flow with no Office public self-signup endpoint
- server-side RBAC and maker-checker approval control
- company/product/customer masters
- commercial plans/subscriptions
- invoices, GST calculations, payments, receipts, credit notes, refunds and settlements
- double-entry operational journal and trial balance
- accounting/TAX/BOTH period locks with controlled reopen approvals
- bank-account registry, bank transaction ingestion and payment matching
- Finance & Ownership share ledger, funding, expenses, contribution calls, mandates and payment-instruction state machines
- disabled/sandbox/live finance execution boundary, RazorpayX adapter and signed Razorpay webhook handling
- governance meetings, resolutions, CTC generation and authority grants
- compliance obligations and authority notices
- vendors, contracts, people and assets
- versioned/locked document vault with SHA-256 integrity
- inspection cases and hash-based manifests
- read-only Google Drive metadata discovery and evidence-taxonomy readiness reporting
- integration registry that rejects raw secrets
- transactional outbox/domain-event model and workflow registry
- CSP/security headers, browser Origin guard, optional trusted-host control and baseline mutation rate limiter
- reproducible OpenAPI export/check tooling
- secret scan and blocking high/critical dependency audit in CI
- automated root and Office test suites plus hardened Office quality gate

## Production identity state

The dedicated hosted Supabase project is `KRAVIA Office`, project ref `xjtazosozxmudkbxqhjl`, Mumbai (`ap-south-1`). Identity-admission and role tables, restrictive client/RLS boundaries and `public.office_custom_access_token_hook` are deployed. The asymmetric signing key is active, the custom token hook is enabled, public signup is disabled, and the first approved identity has been admitted with the `OWNER` role. Hook output has been verified for assigned and unassigned identities.

The remaining first-user identity acceptance action is TOTP enrollment/verification through the deployed `/office/login` flow and confirmation that the session reaches `aal2`.

## FastAPI runtime

Canonical ASGI application:

```text
backend.app:app
```

Local backend development from repository root:

```bash
cd office
python -m pip install -r backend/requirements.txt
alembic upgrade head
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

The browser-facing production deployment should not expose the old static Office UI as a second canonical application. The root Next.js path workspaces call the FastAPI runtime through the same-origin BFF.

API docs are available only in non-production mode at `/api/docs` on the FastAPI runtime.

## Root path-workspace deployment variables

```text
OFFICE_SUPABASE_URL=https://xjtazosozxmudkbxqhjl.supabase.co
OFFICE_SUPABASE_PUBLISHABLE_KEY=<active modern publishable key>
OFFICE_API_ORIGIN=https://<canonical FastAPI runtime origin>
```

The FastAPI runtime must use the matching production OIDC issuer/JWKS/audience, `OIDC_ROLE_CLAIM=office_roles` and `OIDC_REQUIRED_AAL=aal2`.

## Run checks

Root repository:

```bash
npm ci
npm audit --audit-level=high
npm run lint
npm run typecheck
npm test
npm run build
```

Office backend:

```bash
cd office
python -m pytest backend/tests -q
python scripts/export_openapi.py --check
python scripts/quality_gate.py
```

Normal `main` CI executes both groups plus secret scanning and a clean Alembic upgrade.

## Drive evidence reconciliation

The KRAVIA Office Drive taxonomy reviewed during this audit contains the expected logical areas for Company Master, Governance, Compliance, Finance & Accounting, GST & Tax, Banking & Payments, Customers & Contracts, Vendors & Procurement, and People & HR.

The application reports those areas as available/empty/missing using metadata only. It also flags obvious taxonomy issues—for example ownership/shareholding material filed under customer contracts—without automatically moving or copying private documents.

Evidence presence is not treated as legal approval. Verified ownership/company/tax values must still be explicitly bootstrapped from authoritative reviewed records.

## Production activation sequence

1. Deploy root Next.js with the dedicated Office Supabase URL/publishable key.
2. Deploy the canonical FastAPI runtime and set `OFFICE_API_ORIGIN`; configure the matching OIDC/JWKS/AAL2 environment on FastAPI.
3. Sign in through `/office/login`, enroll/verify the first TOTP factor and prove the session reaches `aal2`.
4. Provision/verify managed production PostgreSQL controls, restricted networking, backups/PITR, restore drill and secret manager.
5. Load/lock verified Company Master and ownership data from reviewed authoritative evidence; do not infer it from historical drafts.
6. Obtain CA approval for GSTIN/tax catalog, SAC mappings, invoice series, accounting mappings and period-close operating procedure.
7. Obtain CS/legal review for governance, ownership/register handling, retention and controlled funding/mandate language.
8. Configure private production object storage plus malware scanning.
9. Configure the read-only Google Drive service identity/root folder and correct evidence filing issues in Drive.
10. Configure Razorpay/RazorpayX/payment-provider credentials only after provider eligibility and intended funding/payout flows are approved; configure signed webhook secret/callbacks.
11. Configure approved bank/accounting ingestion and reconciliation integrations.
12. Configure eSign/DSC provider where required.
13. Provision production queue/background workers for outbox/scheduled controls.
14. Configure shared edge/WAF rate limiting for multi-replica deployment plus observability, alerts, incident routing, SLOs and audit retention.
15. Perform staging browser/accessibility/security testing, backup restore drill and authoritative inspection-pack dry run across `/office` and `/finance` role matrices.
16. After the path workspaces are accepted, redirect/retire the historical Office subdomain; do not remove it earlier.
17. Enable live finance execution only after every applicable production gate has evidence.

## Production rule

Never turn a configuration/evidence gap into fabricated success. If a bank feed, GST status, payment provider, FastAPI runtime, cap table or statutory record is not connected and verified, Office must say so explicitly and remain fail-closed where the action is high-risk.

## Legal/accounting boundary

The software implements controls and workflows; it does not replace statutory judgment by the company's CA, CS, auditor or legal counsel. Tax/accounting/governance/ownership configuration that affects statutory or payment output must be approved and evidenced before production lock.
