# KRAVIA Office Security Baseline

KRAVIA Office is no longer a static v1 mock foundation. The canonical runtime is the authenticated/server-side `backend.app:app` application. This file summarizes implemented software controls; `spec/security/PRODUCTION_GATES.md` defines the evidence still required before internet-facing production use.

## Implemented software controls

- server-side RBAC and privileged route guards;
- maker-checker workflow preventing requester self-approval;
- OIDC/JWT production-auth architecture with fail-closed startup configuration;
- CSP, X-Frame-Options/frame-ancestors, nosniff, referrer and permissions policies;
- browser Origin guard for mutations and optional trusted-host allowlist;
- baseline per-process mutation rate limiting with 429/Retry-After;
- provider webhook signature verification and event deduplication;
- payment/command idempotency and duplicate-reference protection;
- accounting/tax period locks and approved reopen workflow;
- private document versioning, MIME/size validation, SHA-256 integrity and lock protection;
- append-only/tamper-evident audit chain;
- integration registry rejection of raw secrets;
- read-only Google Drive metadata boundary;
- CI secret scan and blocking high/critical npm dependency audit;
- reproducible OpenAPI contract/drift checks.

## Required production controls/evidence

- real SSO/OIDC tenant, MFA, recovery and session-revocation policy;
- full all-role/IDOR/BOLA authorization acceptance;
- production PostgreSQL encryption/TLS/restricted networking;
- approved secret manager and rotation process;
- private object storage + malware scanner;
- shared edge/WAF rate limiting for horizontally scaled deployment;
- monitoring/alerting for privilege changes, refunds/payouts, provider failures, audit failures and close/reopen events;
- periodic access review;
- backups/PITR and successful restore drill;
- staging CSRF/XSS/injection/file-upload security testing;
- production provider/bank/Drive/eSign credentials with least privilege;
- verified legal/tax/ownership evidence and CA/CS/legal sign-offs where applicable.

## Sensitive-data minimization

Source control intentionally omits personal PAN numbers, personal addresses, personal phone numbers, bank credentials, DSC PINs, API secrets, provider tokens, private Drive document bytes and production shareholder identity records. Production data must be supplied through approved private runtime/evidence channels.

Never collect or store bank passwords, OTPs or UPI PINs in KRAVIA Office.

## Deployment posture

A green CI build validates the committed software controls. It does not prove the production environment is authorized, compliant or professionally approved. Missing external security/evidence prerequisites remain explicit setup-required states and must not be converted into fake success.
