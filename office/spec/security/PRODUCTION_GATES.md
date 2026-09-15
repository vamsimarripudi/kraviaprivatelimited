# Production security gates

KRAVIA Office must not be promoted to production until all mandatory gates are evidenced. This document distinguishes controls already implemented and tested in code from deployment/provider/professional evidence that cannot be fabricated in source control.

## Implemented and continuously tested controls

- Server-side RBAC with deny-by-default privileged mutation routes.
- Maker-checker approval primitive preventing requester self-approval.
- Finance/payment idempotency and Razorpay webhook-signature verification logic.
- Invoice/controlled-document sequencing and issued-document immutability controls.
- Accounting/tax period locks with approved maker-checker reopen workflow.
- Append-only/tamper-evident audit chain with audit writes in the same transaction as controlled mutations.
- Private document versioning, SHA-256 integrity, MIME allowlist and upload-size limits.
- Application CSP/security headers, trusted-host option and browser Origin guard.
- Baseline per-process mutation rate limiter with 429/retry semantics.
- Secret scan and blocking `npm audit --audit-level=high` in CI.
- Reproducible committed OpenAPI contract with CI drift detection.
- Read-only Google Drive evidence metadata boundary and evidence-taxonomy readiness reporting.

These controls are necessary but do not by themselves prove the deployed production environment is compliant or operationally approved.

## Identity — production evidence required

- OIDC/SSO or equivalent first-party identity integrated with the real KRAVIA tenant.
- MFA enforced for privileged roles.
- Session expiry, revocation and device/risk controls defined and tested.
- Recovery process tested.
- Full production all-role authorization/IDOR/BOLA acceptance matrix passed.

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

CI currently enforces secret scanning, dependency audit, lint, type checking, application tests, migrations, Office tests and Office quality gates. Before production promotion also complete:

- external/staging IDOR/BOLA tests;
- CSRF/XSS/injection/file-upload security tests;
- browser/device/accessibility review;
- shared edge/WAF rate limiting when Office runs more than one application process/replica;
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

A green CI build proves the committed software controls pass their automated gates. It does **not** convert missing provider credentials, unverified legal evidence or professional sign-off into production readiness. Office must surface such conditions as setup-required/unverified states rather than fabricated success.
