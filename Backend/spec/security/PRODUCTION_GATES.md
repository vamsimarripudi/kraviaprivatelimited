# Production security gates

KRAVIA Office must not be promoted to production until all mandatory gates are evidenced. This document distinguishes controls already implemented and tested in code from deployment/provider/professional evidence that cannot be fabricated in source control.

## Implemented and continuously tested controls

- KRAVIA first-party Office identity authority in FastAPI/PostgreSQL; active Office login, registration, invitation and MFA flows do not use Supabase Auth.
- Argon2id password hashing, short-lived signed access JWTs and rotating refresh tokens stored only as SHA-256 hashes.
- Same-origin identity BFF using HttpOnly/SameSite=Strict cookies; bearer/refresh tokens are not exposed to Office JavaScript.
- Encrypted-at-rest TOTP MFA plus production `aal2` enforcement on protected Office APIs.
- Explicit Office identity/role records with deny-by-default browser access, one-time Founder bootstrap and private single-use invitations.
- No public Office self-signup endpoint after Founder bootstrap closes.
- Server-side RBAC with deny-by-default privileged mutation routes.
- Maker-checker approval primitive preventing requester self-approval.
- Finance/payment idempotency and Razorpay webhook-signature verification logic.
- Invoice/controlled-document sequencing and issued-document immutability controls.
- Accounting/tax period locks with approved maker-checker reopen workflow.
- Append-only/tamper-evident audit chain with audit writes in the same transaction as controlled mutations.
- Private document versioning, SHA-256 integrity, MIME allowlist and upload-size limits.
- Application CSP/security headers, trusted-host option and browser Origin guard.
- Shared database-backed mutation rate limiter across application replicas, with development fallback and production fail-closed shared mode.
- Secret scan and blocking `npm audit --audit-level=high` in CI.
- Reproducible committed OpenAPI contract with CI drift detection.
- Read-only Google Drive evidence metadata boundary and evidence-taxonomy readiness reporting.

These controls are necessary but do not by themselves prove the deployed production environment is compliant or operationally approved.

## Identity — production activation / evidence required

The first-party identity implementation exists in code and database migrations. Production promotion still requires operator evidence for these deployment controls:

- configure a strong `OFFICE_AUTH_SIGNING_SECRET` in the FastAPI production secret store;
- configure the same strong `OFFICE_AUTH_BOOTSTRAP_SECRET` in the trusted FastAPI and Next.js server environments, never in browser-visible variables;
- set and verify `AUTH_MODE=first_party` and `OFFICE_REQUIRED_AAL=aal2` on the accepted production deployment;
- complete the one-time Founder registration, TOTP enrollment and live AAL2 sign-in acceptance, then verify Founder bootstrap is permanently closed;
- issue, consume once and retire a test private invitation for a non-owner role;
- verify session revocation, controlled MFA reset/recovery and inactive-user denial;
- pass the full staging all-role authorization/IDOR/BOLA matrix.

Supabase Auth is not the active Office identity authority. Supabase Auth signing-key, leaked-password, hook and public-signup settings are therefore not Office production identity acceptance gates.

## Secrets / infrastructure — production evidence required

- No secrets in source, localStorage, client bundles, logs or documents.
- AWS Parameter Store/Secrets Manager or approved equivalent configured.
- Key rotation process documented and exercised.
- Production PostgreSQL uses encryption at rest and TLS with restricted network access.
- Backup/PITR retention configured and a restore drill completed successfully.
- Time synchronization and critical audit failure alerting monitored.

## Financial controls — production evidence required

The application-side maker-checker, idempotency, webhook verification, refund linkage, journal balancing and period locks are implemented. Production promotion additionally requires:

- CA-approved GSTIN, tax catalog, SAC mappings, invoice series and accounting policy/mapping.
- Provider/bank sandbox acceptance with signed-webhook replay cases.
- Live payment/payout/provider eligibility and credentials.
- Bank/accounting integration scopes and reconciliation procedure approved.
- Close/reopen operating procedure approved and tested by Finance/CA.

## Documents / evidence — production evidence required

- Private production object storage/Drive authorization scoped to minimum privilege.
- Malware scanner integrated for uploaded files before production use.
- Retention/legal-hold policy approved.
- Authoritative Company Master, governance, ownership, tax, finance, banking, vendor and HR evidence loaded/linked only after review.
- Public verification surfaces confirmed not to reveal confidential content.

## Application security — production acceptance required

CI currently enforces secret scanning, dependency audit, lint, type checking, application tests, migrations, Office tests, OpenAPI drift checking and Office quality gates. Pytest fails on unexpected warnings, with only the specifically identified upstream Starlette/AnyIO TestClient deprecation suppressed. Before production promotion also complete:

- external/staging IDOR/BOLA tests;
- CSRF/XSS/injection/file-upload security tests;
- browser/device/accessibility review;
- provider edge/WAF abuse controls as defense in depth; application mutation limiting is already shared across replicas;
- monitoring, alerting, incident routing and SLO configuration.

## Integrations — production evidence required

- Razorpay/payment webhook signatures validated with live/sandbox provider configuration.
- Google Drive/Workspace scopes minimized and service identity approved.
- Bank/accounting integrations read/write scoped by need.
- Integration failure queues/outbox workers monitored.
- eSign/DSC provider configured where legally required.

## Legal / professional review — production evidence required

- Current legal entity and registered-office data verified from authoritative evidence.
- Current GST status/effective details verified.
- Current cap table/share register/share certificates/shareholder agreement reconciled and approved before production ownership bootstrap.
- CA approves tax/accounting configuration.
- CS approves governance/minute/register/ownership handling.
- Legal/management approves retention, privacy and controlled funding/mandate language where applicable.

## Release rule

A green CI build proves the committed software controls pass their automated gates. It does **not** convert missing production identity activation, provider credentials, unverified legal evidence or professional sign-off into production readiness. Office must surface such conditions as setup-required/unverified states rather than fabricated success.
