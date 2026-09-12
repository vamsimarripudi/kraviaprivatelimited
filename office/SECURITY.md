# Security Baseline

The v1 package is a local/static functional foundation. It is **not** an internet-ready authenticated production deployment.

## Production requirements

- MFA for privileged roles
- server-side authorization on every request/query
- deny by default
- least privilege
- role + product + legal-entity scope
- secure session cookies
- CSRF protection where applicable
- rate limiting
- provider webhook signature verification
- idempotency/replay protection
- secure file validation and malware scanning
- encryption in transit/at rest
- secret manager; no secrets in source code/database fields
- append-only/tamper-resistant audit logs
- maker-checker for payment/refund/bank/master-data changes
- alerting for unusual refunds, bank changes, access elevation and failed integrations
- periodic access reviews
- backups and restore tests

## Sensitive-data minimization

The v1 source intentionally omits personal PAN numbers, personal addresses, personal phone numbers, bank credentials, DSC PINs and API secrets.
