# KRAVIA Office v2.0 — Verified Test Report

## Automated result on `main`

Latest fully green quality run:

- Root application: **18 Vitest files / 64 tests passed**.
- Office backend: **36 pytest tests passed**.
- Office quality gate: **PASS**.
- `npm ci`: **0 vulnerabilities**.
- Blocking `npm audit --audit-level=high`: **0 vulnerabilities**.
- ESLint, TypeScript typecheck, secret scan and Next.js 16.3.5 production build: **PASS**.
- Python compile, OpenAPI drift verification and clean Alembic migration chain through v5: **PASS**.

The production Next build explicitly contains `/office`, `/office/login`, `/office/[section]`, `/finance`, `/finance/login`, `/finance/[section]`, `/admin/login`, `/api/office-auth/*` and `/api/office-runtime/[...path]`.

Pytest treats unexpected warnings as errors. The known upstream Starlette/AnyIO TestClient deprecation remains narrowly suppressed because it originates in the dependency rather than KRAVIA code.

## Root/path-workspace coverage

The root suite now verifies the existing public application plus the new internal-workspace boundaries. The path-workspace regression suite specifically verifies:

1. Office roles and Finance roles are independently scoped;
2. sensitive finance modules can be narrower than general Finance access;
3. legacy `/corporate/*` routes map to `/office`, `/finance` or `/admin` without coupling website-admin identity to Office identity;
4. Office access/refresh tokens remain server-managed HttpOnly/SameSite=Strict cookies and are not disclosed by the sign-in API;
5. Office-auth and runtime mutation endpoints reject cross-origin browser requests;
6. the canonical runtime gateway uses a fixed server-controlled origin, blocks provider webhook/auth paths, does not follow upstream redirects and requires the verified Office session.

Crawler/sitemap tests additionally verify that `/office` and `/finance` are private route families and that production uses the apex company canonical origin `https://kraviaprivatelimited.com`.

## Office backend coverage

The 36-test backend suite verifies, among other controls:

- customer → invoice → payment → receipt → GST working summary;
- same-state CGST/SGST and inter-state IGST;
- controlled invoice numbering and immutable billing snapshots;
- invoice/payment idempotency, overpayment and duplicate external-reference rejection;
- safe public invoice verification and PDF rendering;
- double-entry journal/trial-balance balancing;
- Board Meeting → Resolution → CTC → Authority Grant;
- vendor / contract / employee / asset / private Document Vault flows;
- server-side role guards and maker-checker self-approval prevention;
- commercial Plan → Subscription;
- credit-note and refund accounting;
- bank-account/transaction import and deterministic payment reconciliation;
- Command Center derived metrics;
- Notice Case and Inspection Case/manifest generation;
- secret-bearing integration configuration rejection;
- audit-chain and ledger-event integrity;
- Finance & Ownership ledger/funding/mandate/payment-provider controls;
- disabled/sandbox finance execution, idempotency and signed provider-event handling;
- controlled company bootstrap/source-control boundary;
- read-only Google Drive metadata integration and evidence-taxonomy readiness;
- accounting/tax period close and maker-checker reopen;
- CSP/security headers, cross-origin mutation guard and rate limiter;
- identity token non-disclosure and HttpOnly/SameSite cookie bridge;
- TOTP verification promoting sessions to `aal2`;
- protected production APIs rejecting `aal1`;
- inactive/suspended Office identities being rejected;
- identity/MFA routes present in the committed OpenAPI contract.

## Supabase identity control validation

The dedicated `KRAVIA Office` Supabase project (`xjtazosozxmudkbxqhjl`, `ap-south-1`) has the following verified state:

- explicit Office identity-admission table;
- explicit Office role table;
- restrictive deny-by-default RLS/client policies;
- Custom Access Token Hook function generating `office_roles` and `office_access_status`;
- asymmetric JWT signing key activated;
- Custom Access Token Hook activated;
- public Office signup disabled;
- named OWNER identity created, email-confirmed, ACTIVE and explicitly role-assigned;
- live hook output verified for the named OWNER identity;
- Supabase security advisor previously returned no findings after the explicit policies were applied.

The remaining human acceptance step for identity is enrollment and verification of the first OWNER TOTP factor and confirmation of the resulting `aal2` session through `/office/login`.

## Migration validation

The clean CI database upgrades through:

- initial KRAVIA Office schema;
- v2 commercial/finance controls;
- v3 tamper-evident audit chain;
- v4 Finance & Ownership / controlled treasury;
- v5 accounting and tax period-close controls.

Supabase Auth/RBAC provisioning remains separate in `spec/identity/SUPABASE_IDENTITY.sql` because it targets the hosted Supabase `auth` schema rather than the Office application database.

## Deployment validation

Source-controlled Vercel framework configuration is now explicit through root `vercel.json` with `framework: "nextjs"`.

The connected Vercel project was then proven to have a separate project-level Root Directory mismatch: once the framework override was read, Vercel attempted a Next.js build but reported that it could not find the repository-root `package.json`/Next.js dependency from the configured Root Directory. This is a deployment-project setting, not a source-build failure.

The local/CI Next production build is authoritative evidence that the route tree compiles. Live Vercel path validation must be repeated after the project Root Directory is set to the repository root and required production environment variables/domains are configured.

## Not claimed as complete without production evidence

Automated tests do not fabricate production acceptance for:

- first human TOTP enrollment and live AAL2 session;
- Vercel Root Directory/environment/domain configuration;
- production FastAPI runtime hosting and `OFFICE_API_ORIGIN`;
- full all-role IDOR/BOLA acceptance using production-like identities;
- production PostgreSQL concurrency/failover/backups/PITR restore;
- live Razorpay/RazorpayX/payment-provider eligibility and settlements;
- live bank/accounting feeds;
- CA-approved tax/accounting golden cases;
- CS/legal approval of governance/ownership/statutory workflows;
- eSign/DSC provider behavior;
- malware scanning/private object-storage integration;
- external staging CSRF/XSS/injection/file-upload penetration testing;
- shared edge/WAF abuse controls;
- production monitoring/alerting/SLOs;
- authoritative Drive evidence completeness and inspection-pack dry run.

Those are deployment/provider/professional acceptance gates, not missing unit-test placeholders.
