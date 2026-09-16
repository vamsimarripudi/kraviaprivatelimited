# KRAVIA Office v2.0 — Audited Development Handover

## Purpose

`office.kraviaprivatelimited.com` is the intended company operating system for KRAVIA PRIVATE LIMITED and present/future KRAVIA products. The canonical source remains the `office/` bounded subsystem inside `vamsimarripudi/kraviaprivatelimited`; a separate Office repository is not required.

## Architecture principle

Products create business. KRAVIA Office provides the canonical corporate/commercial control layer:

`Product event → customer/commercial context → billing/tax → payment → accounting → reconciliation → evidence → governance/compliance/audit`.

Ownership/legal equity, shareholder/director funding, customer revenue and vendor/company payouts are separate domains. A payment/contribution must never mutate ownership automatically.

Every material record should be able to answer: who owns it, what its status is, what changed, who changed it, what evidence supports it, what approval controls apply, and what happens next.

## Included executable capabilities

- FastAPI API with SQLAlchemy persistence and Alembic migrations through v5
- PostgreSQL-ready configuration
- dedicated Supabase Auth tenant for KRAVIA Office in `ap-south-1`
- production OIDC/JWT verification with custom Office role claims and mandatory `aal2` MFA gate
- same-origin Auth BFF using HttpOnly/SameSite cookies; bearer/refresh tokens are not exposed to application JavaScript
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

## Verified automated state

The identity-enabled `main` build has verified:

- `npm ci`: 0 vulnerabilities
- blocking high/critical dependency audit: 0 vulnerabilities
- root application: 58 Vitest tests across 17 files
- ESLint, TypeScript typecheck, secret scan and Next.js 16.3.5 production build
- Python compile
- clean Alembic upgrade through v5
- committed OpenAPI drift check including Auth/MFA endpoints
- Office backend: 36 pytest tests
- identity token non-disclosure, HttpOnly cookie, MFA/AAL2, inactive-user and role-admission controls
- Office quality gate: PASS

Pytest is configured to fail on unexpected warnings. The known upstream Starlette/AnyIO TestClient deprecation is narrowly suppressed until the upstream dependency removes it.

See `TEST_REPORT.md` for scope and the distinction between automated software verification and external production acceptance.

## Production identity state

A dedicated Supabase project named `KRAVIA Office` is provisioned under project ref `xjtazosozxmudkbxqhjl` in Mumbai (`ap-south-1`). Identity-admission and role tables, restrictive RLS/client access, and `public.office_custom_access_token_hook` are deployed. Direct hook execution has been verified to produce no roles for an unassigned identity.

Hosted Auth settings that require Supabase Dashboard control remain external: migrate/activate an asymmetric JWT signing key, enable the Custom Access Token Hook, restrict public signup, create/invite the first human account, assign its explicit Office role, and enroll/verify TOTP. Those actions are documented in `IDENTITY_MFA.md`.

## Drive evidence reconciliation

The KRAVIA Office Drive taxonomy reviewed during this audit contains the expected logical areas for Company Master, Governance, Compliance, Finance & Accounting, GST & Tax, Banking & Payments, Customers & Contracts, Vendors & Procurement, and People & HR.

The application reports those areas as available/empty/missing using metadata only. It also flags obvious taxonomy issues—for example ownership/shareholding material filed under customer contracts—without automatically moving or copying private documents.

Evidence presence is not treated as legal approval. Verified ownership/company/tax values must still be explicitly bootstrapped from authoritative reviewed records.

## Start the canonical development Office

From the repository root:

```bash
cd office
python -m pip install -r backend/requirements.txt
alembic upgrade head
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

Use `backend.app:app`, not `backend.main:app`; the canonical app attaches identity/MFA, Finance & Ownership, period controls, Drive readiness, HTTP security middleware and the same-origin web surface.

API docs are available in non-production mode at `/api/docs`.

## Run Office checks

```bash
cd office
python -m pytest backend/tests -q
python scripts/export_openapi.py --check
python scripts/quality_gate.py
```

The root repository normal CI additionally runs npm dependency audit, secret scan, lint, typecheck, root tests and the Next.js build.

## Docker development

```bash
cd office
export POSTGRES_PASSWORD='set-a-local-development-secret'
export OFFICE_BOOTSTRAP_KEY='use-a-real-dev-key'
docker compose up --build
```

## Production activation sequence

1. Finish the hosted Supabase Auth activation described in `IDENTITY_MFA.md`: asymmetric signing key, custom token hook, signup policy, first human identity/role and TOTP enrollment.
2. Provision the production PostgreSQL environment, restricted networking, backups/PITR and secret manager.
3. Load/lock verified Company Master and ownership data from reviewed authoritative evidence; do not infer it from historical drafts.
4. Obtain CA approval for GSTIN/tax catalog, SAC mappings, invoice series, accounting mappings and period-close operating procedure.
5. Obtain CS/legal review for governance, ownership/register handling, retention and controlled funding/mandate language.
6. Configure private production object storage plus malware scanning.
7. Configure the read-only Google Drive service identity/root folder and correct any evidence filing issues in Drive.
8. Configure Razorpay/RazorpayX/payment-provider credentials only after provider eligibility and the intended funding/payout flow are approved; configure signed webhook secret/callbacks.
9. Configure approved bank/accounting ingestion and reconciliation integrations.
10. Configure eSign/DSC provider where required.
11. Provision production queue/background workers for outbox/scheduled controls.
12. Configure shared edge/WAF rate limiting for multi-replica deployment plus observability, alerts, incident routing, SLOs and audit retention.
13. Perform staging browser/accessibility/security testing, backup restore drill and authoritative inspection-pack dry run.
14. Map production DNS/TLS and enable live finance execution only after every applicable production gate has evidence.

## Production rule

Never turn a configuration/evidence gap into fabricated success. If a bank feed, GST status, payment provider, identity system, cap table or statutory record is not connected and verified, Office must say so explicitly and remain fail-closed where the action is high-risk.

## Legal/accounting boundary

The software implements controls and workflows; it does not replace statutory judgment by the company's CA, CS, auditor or legal counsel. Tax/accounting/governance/ownership configuration that affects statutory or payment output must be approved and evidenced before production lock.
