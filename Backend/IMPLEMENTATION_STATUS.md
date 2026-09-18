# Implementation Status — KRAVIA Office v2.0

## Current verified build state

KRAVIA Office is a runnable multi-product corporate operating-system foundation with an executable FastAPI/SQLAlchemy/Alembic core and a path-based enterprise web surface inside the canonical `vamsimarripudi/kraviaprivatelimited` repository.

Canonical browser surfaces are now:

- `/` — public KRAVIA Private Limited website;
- `/office` — directors, governance, people, operations, legal/CS and product administration;
- `/finance` — finance, accounting, GST/tax, banking, reconciliation, audit and controlled ownership/funding views;
- `/admin` — public website/content/request administration only.

`office.kraviaprivatelimited.com` is no longer the canonical Office URL. Existing `/corporate/*` browser paths are compatibility redirects to `/office`, `/finance` or `/admin` as appropriate.

### Enterprise operating surface
- [x] Path-based `/office` and `/finance` application shells with role-scoped navigation
- [x] Dedicated `/office/login` and `/finance/login` MFA entry points
- [x] Multi-product Product Registry and future-product support
- [x] Company Master / customer / commercial / billing / tax / accounting / governance / compliance / contracts / vendors / people / assets / documents / audit / inspection modules
- [x] Finance & Ownership bounded domain inside KRAVIA Office rather than a separate product
- [x] Responsive administration UX and honest unavailable/setup-required states
- [x] **50/50 Office sections and 20/20 Finance sections use specialised workflow/read-model surfaces; no section falls through to the generic WorkspaceModule fallback**
- [x] Governed company-registration registry with masked identifiers, UNVERIFIED creation and independent review
- [x] Office audit explorer combining Office control-plane evidence with source-scoped runtime audit-chain verification
- [x] Same-origin runtime panels connected to the canonical Office API gateway without fabricated records
- [x] Public-site `/admin` identity boundary separated from KRAVIA Office identity

### Identity and authorization
- [x] Dedicated `KRAVIA Office` Supabase Auth project in `ap-south-1` (`xjtazosozxmudkbxqhjl`), isolated from product/public-site identity projects
- [x] Asymmetric JWT signing key activated in hosted Supabase
- [x] `public.office_custom_access_token_hook` deployed and activated
- [x] Public Office signup disabled
- [x] First named human Office identity created and email-confirmed
- [x] First named identity explicitly admitted as ACTIVE with `OWNER` role
- [x] Hook output verified with `office_roles=[OWNER]` and `office_access_status=ACTIVE`
- [x] Server-side RBAC roles: OWNER, DIRECTOR, FINANCE, CA, CS, LEGAL, HR, OPERATIONS, AUDITOR and PRODUCT_ADMIN
- [x] Same-origin Supabase Auth BFF with HttpOnly/SameSite=Strict cookie storage; bearer/refresh tokens are not exposed to application JavaScript
- [x] TOTP enrollment/challenge/verification implementation and production `aal2` enforcement
- [x] No Office public self-signup endpoint
- [x] Maker-checker approval primitive preventing requester self-approval
- [ ] First named OWNER TOTP factor enrollment and live AAL2 verification — operator/user gate
- [ ] Full staging IDOR/BOLA/all-role acceptance matrix — production acceptance gate

### Path/workspace security
- [x] `/office` and `/finance` have route-level `noindex` metadata
- [x] Crawler policy explicitly disallows `/office`, `/finance`, `/admin`, `/api`, `/auth` and legacy `/corporate`
- [x] Sitemap generation excludes private route families
- [x] Production canonical origin in source is `https://kraviaprivatelimited.com`
- [x] Legacy `/corporate/*` mapping is explicit and regression-tested
- [x] Sensitive Finance modules use narrower role scopes than the Finance workspace itself

### Same-origin canonical runtime gateway
- [x] `/api/office-runtime/[...path]` BFF created
- [x] Requires ACTIVE, role-provisioned, `aal2` Office session
- [x] Injects the verified Office JWT server-side; browser authorization headers/cookies are not forwarded downstream
- [x] Fixed `OFFICE_API_ORIGIN` prevents browser-controlled upstream selection
- [x] Explicit API-family allowlist and provider webhook/auth path blocking
- [x] Request-size bound, no-store responses and upstream redirect refusal
- [x] Same-origin mutation protection for runtime and Office-auth mutations
- [x] FastAPI remains the downstream RBAC/business-rule authority
- [ ] Production `OFFICE_API_ORIGIN` — waits for canonical FastAPI production hosting

### Finance & Ownership
- [x] Append-only share ledger / ownership summary / controlled transfers
- [x] Ownership changes separated from expense funding and treasury/payment records
- [x] Funding policies, contribution calls and expense obligations
- [x] Payment mandates with caps/frequency/state controls
- [x] Payment instruction state machine and provider-event deduplication
- [x] Disabled/sandbox/live execution boundary; live is fail-closed without provider configuration
- [x] RazorpayX payout adapter boundary and signed Razorpay webhook verification
- [ ] Verified production cap table/share register/share certificates bootstrap — controlled evidence/professional gate
- [ ] Live payment/payout eligibility, credentials and bank/provider approval — external gate

### Billing / tax / accounting / reconciliation
- [x] Integer-paise money model and immutable billing snapshots
- [x] Controlled invoice numbering and invoice SHA-256 verification
- [x] CGST/SGST vs IGST calculation
- [x] Payment/receipt, credit-note, refund and settlement controls
- [x] Double-entry operational journal and balancing trial balance
- [x] Bank transaction ingestion and deterministic reconciliation controls
- [x] Accounting/TAX/BOTH period locks with maker-checker reopen
- [ ] CA-approved production GST/SAC/invoice/accounting mappings and verified GSTIN
- [ ] Live bank/accounting feed authorization

### Governance / administration / evidence
- [x] Board meetings, resolutions, CTC generation and authority grants
- [x] Vendor, contract, employee, asset, compliance and authority-notice registries
- [x] Private document vault with MIME/size controls, SHA-256 versions and lock protection
- [x] Inspection cases and evidence-pack manifest generation
- [x] Read-only Google Drive metadata discovery and evidence taxonomy readiness
- [ ] CS-reviewed production governance/statutory-register configuration
- [ ] Production eSign/DSC provider
- [ ] Production malware scanning/private object storage
- [ ] Production Drive service identity/root-folder authorization

### Live Supabase control-plane hardening
- [x] Governed company-registration registry applied to the live KRAVIA Office project; registration tables use RLS, browser roles have no SELECT access and service-role access is explicit
- [x] Registration RPC functions are SECURITY INVOKER and browser EXECUTE is denied
- [x] Two trigger-only SECURITY DEFINER identity helpers hardened live and in source: PUBLIC/anon/authenticated EXECUTE revoked, service-role EXECUTE retained
- [x] All 52 legacy FastAPI tables are owned by `kravia_office_backend`, have RLS enabled, and retain zero anon/authenticated CRUD
- [x] Production runtime and Alembic transactions now apply `SET LOCAL ROLE kravia_office_backend` through `DATABASE_EXECUTION_ROLE`; the current Railway deployment passed pre-deploy migration and health acceptance with that boundary enabled
- [x] Alembic v6-v9 service tables are owned by `kravia_office_backend`, have RLS enabled, and explicitly deny anon/authenticated CRUD
- [x] Legacy FastAPI table defense-in-depth RLS rollout completed live and versioned in `202609180043_legacy_fastapi_rls.sql`; no permissive browser policies were added
- [ ] Enable Supabase Auth leaked-password protection (current security-advisor WARN)
- [ ] Continue treating RLS-enabled/no-policy INFO findings according to the service-role-only table design; do not add permissive browser policies merely to silence the linter

### Application security / operations
- [x] CSP and browser security headers
- [x] Trusted-host option and mutation Origin guard
- [x] Shared database-backed application mutation rate limiter across replicas, with local development fallback and production fail-closed shared-mode support
- [x] Secret scanning and blocking high/critical npm dependency audit in CI
- [x] Next.js 16.3.5 with verified zero npm vulnerabilities
- [x] Python tests fail on unexpected warnings; known upstream Starlette/AnyIO TestClient deprecation is narrowly suppressed
- [ ] Provider edge/WAF abuse controls — external infrastructure gate; application-level cross-replica rate limiting is complete
- [x] Durable background-worker runtime with distributed advisory locking, bounded outbox processing, heartbeat and failure alerts
- [x] Runtime monitoring/alerting, SLO-readiness boundaries, worker health, audit-retention policies, legal holds and archive-manifest controls
- [ ] Deploy the dedicated worker process/service and connect verified external SLO telemetry/archive sink — production operations gates
- [ ] Final staging penetration/security/accessibility acceptance

## Verified automated validation

Latest fully green `main` quality run verified:

- [x] `npm ci` and blocking `npm audit --audit-level=high`: **0 vulnerabilities**
- [x] secret scan
- [x] ESLint
- [x] TypeScript typecheck
- [x] root Vitest suite: **390 tests passed across 82 files**
- [x] Next.js 16.3.5 production build, including `/office`, `/finance`, Office auth and Office runtime gateway routes
- [x] Python compilation
- [x] committed OpenAPI drift verification
- [x] clean Alembic migration chain through v9
- [x] Office backend suite: **75 tests passed**
- [x] identity token non-disclosure / HttpOnly cookies / TOTP AAL2 / inactive-user / role-admission controls
- [x] path-workspace role boundaries, legacy redirects, same-origin mutation guard and fixed-origin runtime gateway regression tests
- [x] period-close, HTTP security, Drive taxonomy, finance/ownership/provider/idempotency, RBAC, governance, audit-chain and document controls
- [x] hardened Office quality gate: **PASS**

## Deployment state

Repository `main` includes `53e633e80540be8d1ff6392f27bae890b8437f89`; the RLS change passed the full pull-request quality gates, while the current main run is reconfirming the same frontend/backend/database/repository checks: frontend, backend, database-structure, repository-structure and the quality-gated Railway deployment job all passed. The backend suite reports **75 tests passed** and Alembic upgrades cleanly through v9.

Railway is connected to `vamsimarripudi/kraviaprivatelimited` with service `kravia-office-api`, branch `main`, root directory `Backend`, Dockerfile `Dockerfile.api`, pre-deploy `alembic upgrade head`, health check `/health/live`, one configured Singapore replica and the Railway domain `kravia-office-api-production.up.railway.app`. Deployment `7ace95b8-b966-43be-aa4a-f2656624ed74` for commit `2e706e4e20838b00688b0c76f60f61d2e21c935e` reached **SUCCESS** after pre-deploy migrations and health acceptance with `DATABASE_EXECUTION_ROLE=kravia_office_backend`. The dedicated worker service is still absent because Railway rejected additional resource provisioning on the current Free-plan limit.

The connected Vercel hobby team still does not expose the KRAVIA project. GitHub currently reports the `Vercel` check for `main` as a build-rate-limit failure under the separate `kravia1` account/project context. Therefore frontend deployment/root/environment/domain configuration remains externally unverified even though source CI is green.

The canonical browser remains path-based at `kraviaprivatelimited.com/office` and `/finance`; the Railway domain is the backend API origin, not a second public Office UI.

## External production gates intentionally not faked

- first OWNER TOTP enrollment / AAL2 live verification
- identify/reconnect the current KRAVIA Vercel project/account; verify production build settings and environment variables
- apex `kraviaprivatelimited.com` domain attachment / DNS validation; optional `www` redirect
- set/verify frontend `OFFICE_API_ORIGIN` against the accepted Railway API origin once the canonical Vercel project is accessible
- decide and test the defense-in-depth RLS policy plan for the 52 legacy FastAPI tables; browser roles currently have zero CRUD and runtime transactions are constrained to `kravia_office_backend`
- verify restricted database networking, backups/PITR, restore drill and secret-management/rotation controls
- real verified Company Master/GST/ownership evidence and CA/CS/legal approvals
- live Razorpay/RazorpayX and bank/accounting authorizations
- production private object storage + malware scanner
- eSign/DSC where required
- Google Drive runtime service identity
- upgrade/provision Railway capacity for the dedicated production worker service/process (current Free-plan resource limit blocks creation); then connect verified external SLO telemetry and audit archive sink and configure provider edge/WAF controls
- enable Supabase leaked-password protection and complete final staging browser/accessibility/security assessment

## Release rule

**The committed Office software controls are development-complete for the audited scope when normal `main` quality gates are green. Do not describe the live service as production/statutory ready until each applicable external gate has evidence.**

KRAVIA Office must never report fake success, fake compliance, fake tax status, fake bank balances, fake ownership data or fake provider connectivity.
