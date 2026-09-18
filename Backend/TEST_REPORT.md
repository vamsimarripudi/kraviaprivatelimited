# KRAVIA Office v2.0 — Verified Test Report

## Automated result on `main`

Latest fully green quality run:

- Root application: **82 Vitest files / 390 tests passed**.
- Office backend: **70 pytest tests passed**.
- Office quality gate: **PASS**.
- `npm ci`: **0 vulnerabilities**.
- Blocking `npm audit --audit-level=high`: **0 vulnerabilities**.
- ESLint, TypeScript typecheck, secret scan and Next.js 16.3.5 production build: **PASS**.
- Python compile, OpenAPI drift verification and clean Alembic migration chain through v8: **PASS**.

The production Next build explicitly contains `/office`, `/office/login`, `/office/[section]`, `/finance`, `/finance/login`, `/finance/[section]`, `/admin/login`, Office auth APIs and runtime gateways. Route audit additionally confirms **50/50 Office sections and 20/20 Finance sections have specialised surfaces with zero generic section fallbacks**.

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

The 75-test backend suite verifies, among other controls:

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
- audit-chain and ledger-event integrity, retention policies, legal holds and deterministic archive manifests;
- Finance & Ownership ledger/funding/mandate/payment-provider controls;
- disabled/sandbox finance execution, idempotency and signed provider-event handling;
- durable background worker locking/heartbeat/failure alerts and backend observability/SLO-readiness boundaries;
- controlled company bootstrap/source-control boundary;
- read-only Google Drive metadata integration and evidence-taxonomy readiness;
- accounting/tax period close and maker-checker reopen;
- CSP/security headers, cross-origin mutation guard, shared database-backed cross-replica mutation rate limiting and production fail-closed shared-mode configuration;
- identity token non-disclosure and HttpOnly/SameSite cookie bridge;
- TOTP verification promoting sessions to `aal2`;
- protected production APIs rejecting `aal1`;
- inactive/suspended Office identities being rejected;
- identity/MFA routes present in the committed OpenAPI contract.

## Supabase identity/control-plane validation

The dedicated `KRAVIA Office` Supabase project (`xjtazosozxmudkbxqhjl`, `ap-south-1`) has the following verified live state:

- explicit Office identity-admission and role tables;
- asymmetric JWT signing and the Office Custom Access Token Hook;
- public Office signup disabled;
- governed company-registration registry applied live;
- registration tables have RLS enabled, anon/authenticated SELECT denied and service-role SELECT enabled;
- registration lifecycle functions are SECURITY INVOKER, browser EXECUTE denied and service-role EXECUTE enabled;
- `office_identity_create_person()` and `office_sync_employment_identity()` no longer expose SECURITY DEFINER EXECUTE to PUBLIC/anon/authenticated; service-role execution remains explicit;
- all 52 legacy FastAPI tables currently lacking RLS were checked with effective `has_table_privilege`: anon/authenticated have no SELECT/INSERT/UPDATE/DELETE on any of them;
- the dedicated `kravia_office_backend` role has effective CRUD on all 52 legacy FastAPI tables;
- production runtime and Alembic transactions are constrained with `SET LOCAL ROLE kravia_office_backend`;
- the five Alembic v6-v9 service tables are owned by the backend role, RLS-enabled, and deny anon/authenticated CRUD.

Current Supabase security-advisor residuals are not reported as solved:

- **WARN:** leaked-password protection is disabled in Supabase Auth;
- **INFO:** many service-role-only Office tables have RLS enabled with no browser policies by design;
- **hardening backlog:** 52 legacy FastAPI tables remain RLS-disabled, but anon/authenticated have zero effective CRUD and production execution is constrained to the dedicated backend role; any RLS rollout remains a staged defense-in-depth change.

The remaining human identity acceptance step is first OWNER TOTP enrollment and verification of the resulting `aal2` session through `/office/login`.

## Migration validation

The clean CI database upgrades through:

- initial KRAVIA Office schema;
- v2 commercial/finance controls;
- v3 tamper-evident audit chain;
- v4 Finance & Ownership / controlled treasury;
- v5 accounting and tax period-close controls;
- v6 durable background-worker heartbeat;
- v7 audit-retention policies, legal holds and archive manifests;
- v8 shared application rate-limit windows;
- v9 background-worker cadence metadata.

Supabase Auth/RBAC provisioning remains separate in `spec/identity/SUPABASE_IDENTITY.sql` because it targets the hosted Supabase `auth` schema rather than the Office application database.

## Deployment validation

The production code path is validated independently from provider deployment state.

- GitHub Actions on current `main`: frontend, backend, database-structure and repository-structure gates **PASS**.
- Next.js production build: **PASS**, including the private Office/Finance route families and their specialised sections.
- Railway: `kravia-office-api` deployment `7ace95b8-b966-43be-aa4a-f2656624ed74` for backend commit `2e706e4e20838b00688b0c76f60f61d2e21c935e` reached **SUCCESS** after Alembic v9 pre-deploy and `/health/live` acceptance with `DATABASE_EXECUTION_ROLE=kravia_office_backend`.
- Railway worker: provisioning a separate `kravia-office-worker` service was rejected by the current Free-plan resource limit; no partial worker service remains.
- Vercel: the connected account still does not expose the KRAVIA project, while GitHub currently receives a build-rate-limit failure status from a separate `kravia1` project/account context. Production frontend settings remain **unverified** from this connection.

A green local/CI build proves source correctness, not live-provider acceptance.

## Not claimed as complete without production evidence

Automated tests do not fabricate production acceptance for:

- first human TOTP enrollment and live AAL2 session;
- current Vercel project/account linkage, build/environment/domain configuration and successful production deployment;
- accepted frontend `OFFICE_API_ORIGIN` and end-to-end browser→BFF→Railway verification;
- Supabase Auth leaked-password protection;
- staged defense-in-depth RLS enforcement for the 52 legacy FastAPI tables;
- full all-role IDOR/BOLA acceptance using production-like identities;
- production PostgreSQL concurrency/failover/backups/PITR restore;
- live Razorpay/RazorpayX/payment-provider eligibility and settlements;
- live bank/accounting feeds;
- CA-approved tax/accounting golden cases;
- CS/legal approval of governance/ownership/statutory workflows;
- eSign/DSC provider behavior;
- malware scanning/private object-storage integration;
- external staging CSRF/XSS/injection/file-upload penetration testing;
- provider edge/WAF abuse controls;
- deployment of the dedicated worker service/process;
- verified external SLO telemetry and audit archive sink;
- authoritative Drive evidence completeness and inspection-pack dry run.

Those are deployment/provider/professional acceptance gates, not missing unit-test placeholders.
