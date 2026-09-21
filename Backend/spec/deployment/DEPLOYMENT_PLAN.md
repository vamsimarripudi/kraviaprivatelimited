# KRAVIA Office — production deployment plan

## Canonical topology

KRAVIA Office is part of the canonical `vamsimarripudi/kraviaprivatelimited` repository. Do not create a second Office codebase or a second public application.

Canonical browser surfaces:

- `https://www.kraviaprivatelimited.com/` — public company website;
- `https://www.kraviaprivatelimited.com/office` — internal Office workspace;
- `https://www.kraviaprivatelimited.com/finance` — Finance/CA/Auditor workspace;
- `https://www.kraviaprivatelimited.com/admin` — public-site administration, with its separate identity boundary.

The legacy `office.kraviaprivatelimited.com` model is retired. If that hostname remains in DNS, redirect it to the canonical path deployment after acceptance.

### Runtime responsibilities

**Vercel / Next.js**
- public company website;
- private `/office` and `/finance` UI;
- same-origin Office auth BFF;
- fixed-origin `/api/office-runtime/[...path]` gateway;
- HttpOnly/SameSite=Strict access and refresh cookies;
- no direct browser access to PostgreSQL business tables or provider secrets.

**Railway / FastAPI**
- canonical `backend.app:app` API runtime;
- KRAVIA first-party passwords, sessions, TOTP MFA, private invitations, recovery and Founder break-glass;
- finance, accounting, GST, governance, evidence and provider adapters;
- pre-deploy Alembic migration;
- separate durable background-worker service.

**Supabase**
- managed PostgreSQL/control plane in `ap-south-1`;
- private Storage buckets;
- signed `kravia-storage-broker` Edge Function;
- RLS/browser-role denial for Office service-only tables;
- Supabase Auth is not the active Office identity provider.

**Private file security**
- inbound files enter `office-quarantine`;
- content type, extension, size and SHA-256 are verified;
- worker streams queued files through private ClamAV;
- clean objects are promoted to purpose-specific private buckets;
- infected files never become downloadable business evidence.

## Environments

Development → Test → Staging → Production.

Never put production customer, employee, shareholder, financial, tax or private evidence into development fixtures or source control.

## Production deployment variables

### Vercel
- `NEXT_PUBLIC_SITE_URL=https://www.kraviaprivatelimited.com`
- `OFFICE_API_ORIGIN=<accepted Railway API HTTPS origin>`
- `OFFICE_SUPABASE_URL=<KRAVIA Office Supabase URL>`
- `OFFICE_SUPABASE_SECRET_KEY=<trusted server-only control-plane key>`
- `OFFICE_AUTH_BOOTSTRAP_SECRET=<same bootstrap value used by Railway only while required by bootstrap controls>`
- `KRAVIA_AUTHENTICATOR_ANDROID_URL=<approved KRAVIA-signed Android distribution URL>`
- `KRAVIA_AUTHENTICATOR_IOS_URL=<approved TestFlight/App Store distribution URL>`

Do not populate Authenticator distribution URLs with CI release-smoke artifacts. The public install buttons are enabled only after a persistent KRAVIA-controlled signing identity is used.

### Railway API
- `APP_ENV=production`
- `AUTH_MODE=first_party`
- `OFFICE_REQUIRED_AAL=aal2`
- strong `OFFICE_AUTH_SIGNING_SECRET`
- strong `OFFICE_AUTH_BOOTSTRAP_SECRET`
- separate strong `OFFICE_AUTH_BREAK_GLASS_SECRET`
- production database URL and `DATABASE_EXECUTION_ROLE=kravia_office_backend`
- approved host/origin and shared database-rate-limit settings.

### Railway worker
Use the same database/control-plane and file-security configuration as the API where applicable. The worker processes the durable outbox, automation cadence, heartbeat and private-file scan queue under distributed locking.

## Internal software acceptance

Before any external provider is enabled, the repository must pass:

1. `npm ci`;
2. blocking dependency audit and secret scan;
3. ESLint;
4. TypeScript typecheck;
5. full Vitest suite;
6. Next.js production build;
7. Python compile;
8. committed OpenAPI drift check;
9. clean Alembic upgrade through current head;
10. full backend pytest suite;
11. hardened Office quality gate;
12. API-container liveness smoke;
13. worker-container one-shot smoke.

No external credential is required to pass these software gates. Provider-dependent actions remain fail-closed when credentials are absent.

## Identity activation

The code-owned identity system includes:
- one-time protected Founder bootstrap;
- Argon2id passwords;
- short-lived signed access JWTs;
- rotating hashed refresh sessions;
- TOTP AAL2;
- single-use private onboarding links;
- actual first-party session inventory and revocation;
- trusted-device binding and first-party device events;
- AAL2 current-password change;
- administrator-issued single-use recovery links;
- separate Founder break-glass recovery that revokes sessions and resets MFA.

Production operators must configure the identity secrets and retain the break-glass secret offline. Ordinary administrators cannot recover OWNER/DIRECTOR/ADMIN identities beyond their delegated authority.

## Database, backup and recovery

- migrations run before API deployment;
- application transactions use the least-privilege `kravia_office_backend` execution role;
- browser roles receive no direct CRUD on protected Office tables;
- encrypted backup workflow and isolated restore-drill workflow remain version-controlled;
- backup encryption key, PITR retention, provider networking and restore execution are deployment evidence, not values committed to Git.

## External activation — last phase only

After the software branch is accepted, configure external dependencies one by one:

1. canonical Vercel team/project environment and production domain read-back;
2. Railway production secrets and any staged infrastructure change;
3. ClamAV production service;
4. IRIS IRP sandbox/production credentials;
5. IRIS VAS purchase-data credentials and consent;
6. Fynamics/FYN Gateway GSP credentials and taxpayer authorization;
7. Razorpay/RazorpayX eligibility and live credentials;
8. bank/accounting feeds;
9. Google Drive service identity/root-folder authorization;
10. eSign/DSC provider;
11. verified external SLO telemetry/audit archive sink;
12. provider edge/WAF controls.

Each provider remains disabled/fail-closed until its acceptance test is complete.

## Professional/statutory activation — last phase only

Load and approve authoritative Company Master, GST, ownership, banking and governance evidence. Obtain applicable CA, CS, auditor and legal approvals. The software never converts missing professional evidence into a compliance claim.

## Rollback rule

Application code may roll back to a prior tested release. Already-issued financial, tax, ownership or governance records must never be silently reversed. Corrections use controlled compensating records, explicit reconciliation, approved reopen workflows and provider-safe idempotency.
