# KRAVIA Office v2.0 — Verified Test Report

## Automated result on `main`

Latest fully green quality run:

- Root application: **84 Vitest files / 394 tests passed**.
- Office backend: **77 pytest tests passed**.
- Office quality gate: **PASS**.
- `npm ci`: **0 vulnerabilities**.
- Blocking `npm audit --audit-level=high`: **0 vulnerabilities**.
- ESLint, TypeScript typecheck, secret scan and Next.js 16.3.5 production build: **PASS**.
- Python compile, OpenAPI drift verification and clean Alembic migration chain through v10: **PASS**.

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
- KRAVIA first-party Argon2id password authentication with no plaintext credential storage;
- one-time, server-secret-protected Founder bootstrap that permanently closes after first success;
- single-use expiring private registration links with only token hashes persisted;
- rotating refresh credentials persisted only as hashes and browser tokens retained in HttpOnly/SameSite=Strict cookies;
- encrypted-at-rest TOTP enrollment and verification promoting sessions to `aal2`;
- protected production APIs rejecting `aal1`;
- inactive/suspended Office identities being rejected;
- first-party identity/MFA/invite routes present in the committed OpenAPI contract.

## Identity and PostgreSQL control-plane validation

The release candidate removes **Supabase Auth** from the active KRAVIA Office identity path. Supabase/PostgreSQL remains the hosted database/control plane.

Verified in source/CI:

- KRAVIA FastAPI owns password verification, session issuance/refresh, MFA, Founder bootstrap and invitation registration;
- Argon2id hashes passwords; refresh tokens are stored only as SHA-256 hashes;
- TOTP secrets are encrypted at rest and Office business access remains AAL2-gated;
- the one-time Founder bootstrap requires a separate trusted BFF bootstrap secret and closes permanently after successful use;
- private invitation links are single-use/expiring and only their token hashes persist;
- existing `office_identity_users`, `office_user_roles`, departments, permission profiles and access-audit records remain authoritative authorization/control-plane data;
- first-party auth tables are RLS-enabled with anon/authenticated table access revoked;
- browser application code does not use Supabase Auth clients or administrative Auth APIs;
- the old hosted Supabase Auth project may remain temporarily as rollback history until production cutover acceptance, but it is not part of the target Office login/register/MFA architecture.

The previously reported Supabase Auth leaked-password warning is no longer an Office identity production gate after this cutover.

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
- v9 background-worker cadence metadata;
- v10 KRAVIA first-party Office identity, sessions, roles, invitations and auth-event persistence.

Legacy Supabase Auth/RBAC provisioning remains versioned separately in `spec/identity/SUPABASE_IDENTITY.sql` for rollback/reference only because it targets the hosted Supabase `auth` schema; it is not part of the active Office identity production gate.

## Deployment validation

The production code path is validated independently from provider deployment state.

- GitHub Actions baseline: frontend, backend, database-structure and repository-structure quality gates are the source acceptance boundary.
- Next.js production build baseline: **PASS**, including private Office/Finance route families and their specialised sections.
- Railway on baseline `main` commit `3cc0759e178cecabc76a685e11a65b44301c1173`: `kravia-office-api` deployment check **SUCCESS**.
- Railway worker on the same baseline commit: `kravia-office-worker` deployment check **SUCCESS**. This supersedes the earlier Free-plan provisioning note; operational acceptance still requires observed heartbeat/failure-alert/outbox evidence.
- Vercel on the same baseline commit: **PENDING** at the verification point. This is not production acceptance and is not evidence of a current Next.js compile defect. Canonical `kravia1/kraviaprivatelimited` terminal deployment status and environment/domain read-back remain pending.

A green source/CI build proves committed software controls. It does not fabricate live-provider acceptance.

## Not claimed as complete without production evidence

Automated tests do not fabricate production acceptance for:

- production first-party auth secrets and `AUTH_MODE=first_party` cutover;
- first Founder bootstrap registration and live TOTP/AAL2 session;
- terminal green acceptance of the canonical Vercel deployment, resolution of any recurring quota/capacity gate, `kravia1` scope re-authentication, project environment/domain read-back and end-to-end browser acceptance;
- accepted frontend `OFFICE_API_ORIGIN` and end-to-end browser→BFF→Railway verification;
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
- acceptance of the deployed worker through observed heartbeat/failure-alert/outbox evidence;
- verified external SLO telemetry and audit archive sink;
- authoritative Drive evidence completeness and inspection-pack dry run.

Those are deployment/provider/professional acceptance gates, not missing unit-test placeholders.
