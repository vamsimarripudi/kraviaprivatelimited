# Production security gates

KRAVIA Office must not be promoted to production until all mandatory gates are evidenced.

## Identity
- OIDC/SSO or equivalent first-party identity integrated.
- MFA enforced for privileged roles.
- Server-side RBAC/ABAC with deny-by-default authorization.
- Session expiry, revocation, device/risk controls defined.
- Recovery process tested.

## Secrets
- No secrets in source, localStorage, client bundles, logs or documents.
- AWS Parameter Store/Secrets Manager or approved equivalent.
- Key rotation process documented.

## Financial controls
- Maker-checker enforced for high-risk actions.
- Idempotency and webhook signature verification tested.
- Invoice numbering concurrency test passed.
- Issued-document immutability test passed.
- Refund/source-payment linkage enforced.
- Period locks enforced.

## Data
- Production PostgreSQL with encryption at rest and TLS.
- Backup retention configured.
- Restore test successful.
- Row/tenant/product authorization tests passed.
- Sensitive export logging enabled.

## Documents
- Private object storage/Drive authorization scoped.
- Signed documents content-hashed.
- Public verification endpoint reveals no confidential content.
- Malware/type validation for uploads.

## Audit
- Server-side append-only audit pipeline.
- Normal administrators cannot delete audit records.
- Time synchronization monitored.
- Critical audit failure blocks or alerts high-risk operations.

## Application security
- SAST/dependency/secret scan passed.
- IDOR/BOLA tests passed.
- CSRF/XSS/injection/file-upload tests passed.
- Rate limits and abuse controls configured.
- Security headers and CSP configured.

## Integrations
- Razorpay/payment webhook signatures validated.
- Gmail/Drive OAuth scopes minimized.
- Bank/accounting integrations read/write scoped by need.
- Integration failure queues monitored.

## Legal/compliance
- Current legal entity data verified.
- Current GST status/effective details verified.
- CA approves tax configuration and invoice series.
- CS approves governance/minute/register handling.
- Retention/legal hold policy approved.
