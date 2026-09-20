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
- [x] **KRAVIA first-party Office identity authority** implemented in FastAPI/PostgreSQL; Supabase Auth is not used by the active login/register/invite/MFA flow
- [x] Argon2id password hashing; plaintext passwords are never stored
- [x] Short-lived KRAVIA access JWTs plus rotating refresh tokens stored only as SHA-256 hashes
- [x] TOTP MFA with encrypted-at-rest authenticator secret and mandatory production AAL2
- [x] Server-side RBAC roles: OWNER, DIRECTOR, ADMIN, MEMBER, FINANCE, CA, CS, LEGAL, HR, OPERATIONS, AUDITOR and PRODUCT_ADMIN
- [x] Existing `office_identity_users`, `office_user_roles`, department, permission-profile and audit ledgers remain the authorization/control-plane source of truth
- [x] Same-origin Next.js BFF with HttpOnly/SameSite=Strict cookie storage; access/refresh tokens are not returned to application JavaScript
- [x] One-time Founder bootstrap registration with locked Founder display identity, protected by a server-to-server bootstrap secret
- [x] Founder bootstrap maps to the protected OWNER authorization boundary and permanently closes after the first successful registration
- [x] Future registration is single-use/private-link only; links are issued by AAL2 OWNER/ADMIN authority and raw invite tokens are never stored
- [x] Failed-login lockout, auditable login/MFA/session events, session revocation and controlled MFA reset
- [x] Legacy Supabase Auth invite/recovery UI and callbacks removed from the active Office identity path
- [ ] Production first-party secrets configured on Railway/Vercel and accepted live — cutover gate
- [ ] First Founder registration + live TOTP/AAL2 acceptance — operator gate
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
- [x] Supabase Auth removed from the active Office identity path; its leaked-password setting is therefore not an Office-auth production gate
- [x] First-party identity tables are RLS-enabled and browser roles are revoked; the trusted service identity has only the directory read needed by server-side Access Administration
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
- [x] Dedicated Railway worker process/service deployed; external SLO telemetry/archive sink acceptance remains a production operations gate
- [ ] Final staging penetration/security/accessibility acceptance

## Verified automated validation

Latest fully green `main` quality run verified:

- [x] `npm ci` and blocking `npm audit --audit-level=high`: **0 vulnerabilities**
- [x] secret scan
- [x] ESLint
- [x] TypeScript typecheck
- [x] root Vitest suite: **394 tests passed across 84 files**
- [x] Next.js 16.3.5 production build, including `/office`, `/office/register`, `/finance`, first-party Office auth and Office runtime gateway routes
- [x] Python compilation
- [x] committed OpenAPI drift verification
- [x] clean Alembic migration chain through v10
- [x] Office backend suite: **77 tests passed**
- [x] first-party Argon2id credentials / hashed refresh sessions / HttpOnly cookies / one-time Founder bootstrap / private single-use invites / encrypted TOTP AAL2 / inactive-user / role-admission controls
- [x] path-workspace role boundaries, legacy redirects, same-origin mutation guard and fixed-origin runtime gateway regression tests
- [x] period-close, HTTP security, Drive taxonomy, finance/ownership/provider/idempotency, RBAC, governance, audit-chain and document controls
- [x] hardened Office quality gate: **PASS**

## Deployment state — verified 20 Sep 2026

GitHub combined status for baseline `main` commit `3cc0759e178cecabc76a685e11a65b44301c1173` reports both Railway services green:

- `kravia-office-api` deployment check: **SUCCESS**;
- `kravia-office-worker` deployment check: **SUCCESS**.

The dedicated worker is therefore no longer an unprovisioned Free-plan gate. It is deployed through Railway's native GitHub integration and should now be accepted operationally through heartbeat/failure-alert observation, durable outbox processing and external telemetry/archive evidence.

The Vercel check on the same baseline commit is **PENDING** at this verification point. A pending provider deployment is not production acceptance and is not evidence of a Next.js compile failure. Do not attach Office to an unrelated Vercel project merely to clear status; wait for the canonical `kravia1/kraviaprivatelimited` deployment result and read back its root/build/environment/domain configuration before production acceptance.

The canonical browser remains path-based at `kraviaprivatelimited.com/office` and `/finance`; Railway is the backend API/worker runtime, not a second public Office UI.

## External production gates intentionally not faked

- production first-party auth cutover: Railway signing secret + shared Founder bootstrap secret + `AUTH_MODE=first_party`
- first Founder registration and live TOTP/AAL2 verification
- confirm the canonical `kravia1/kraviaprivatelimited` Vercel deployment reaches a terminal green state, resolve any recurring quota/capacity gate, re-authenticate connector access to that scope, and read back root/build/environment/domain configuration
- apex `kraviaprivatelimited.com` domain attachment / DNS validation; optional `www` redirect
- set/verify frontend `OFFICE_API_ORIGIN` against the accepted Railway API origin once the canonical Vercel project is accessible
- decide and test the defense-in-depth RLS policy plan for the 52 legacy FastAPI tables; browser roles currently have zero CRUD and runtime transactions are constrained to `kravia_office_backend`
- verify restricted database networking, backups/PITR, restore drill and secret-management/rotation controls
- real verified Company Master/GST/ownership evidence and CA/CS/legal approvals
- live Razorpay/RazorpayX and bank/accounting authorizations
- production private object storage + malware scanner
- eSign/DSC where required
- Google Drive runtime service identity
- accept the deployed Railway worker with observed heartbeat/failure-alert/outbox evidence; then connect verified external SLO telemetry and audit archive sink and configure provider edge/WAF controls
- complete first-party identity cutover acceptance and final staging browser/accessibility/security assessment

## Release rule

**The committed Office software controls are development-complete for the audited scope when normal `main` quality gates are green. Do not describe the live service as production/statutory ready until each applicable external gate has evidence.**

KRAVIA Office must never report fake success, fake compliance, fake tax status, fake bank balances, fake ownership data or fake provider connectivity.


### 2026-09-19 Founder bootstrap production hotfix

- Fixed KRAVIA first-party Founder bootstrap to flush office_auth_users before dependent office_auth_roles, preventing PostgreSQL FK ordering failures during registration.
- Applied and versioned least-privilege kravia_office_backend access to the protected identity/role/invitation control plane with RLS kept enabled.
- Verified Railway API receives /api/v1/auth/register-founder through the same-origin Vercel BFF; the Railway backend remains the identity runtime.
- Removed the redundant GitHub worker deployment job because Railway's native GitHub integration already owns worker deployment; this avoids blocking Railway API check-suite deployment.

- CI follow-up: frontend dependency audit now evaluates package-lock.json directly to avoid transient npm installed-tree audit endpoint failures while preserving the high-severity vulnerability gate.

- CI resilience follow-up: npm advisory transport failures are now warned rather than treated as vulnerability findings; actual high-severity advisory results remain build-blocking.
