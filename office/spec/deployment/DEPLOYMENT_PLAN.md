# KRAVIA Office deployment plan

Target: `office.kraviaprivatelimited.com`

## Source boundary

The canonical source is the `office/` subsystem inside `vamsimarripudi/kraviaprivatelimited`. Do not fork a second Office codebase merely for deployment; deploy this bounded subsystem from the company repository and preserve one source of truth.

## Recommended production topology

- **Application:** container/runtime serving `backend.app:app`; the Office web surface is mounted same-origin by the canonical FastAPI app.
- **Database:** managed PostgreSQL with encryption, restricted networking, automated backups and PITR.
- **Documents:** approved private object storage and/or read-only Google Drive evidence integration with server-side authorization; malware scanning for uploads.
- **Secrets:** AWS Parameter Store/Secrets Manager or approved equivalent. Provider credentials never enter the Office Integration Registry payloads.
- **Identity:** production OIDC/SSO tenant with MFA and KRAVIA role mapping.
- **Payments:** provider adapters (Razorpay/RazorpayX where approved), signed webhooks, disabled-by-default live execution.
- **Bank/accounting:** approved ingestion/adapters with reconciliation and least-privilege credentials.
- **Workers:** background/outbox/automation runtime for scheduled or asynchronous production tasks.
- **Edge/security:** TLS, WAF/shared rate limiting when horizontally scaled, CSP/security headers and private administration access controls.
- **Observability:** centralized logs, metrics, traces, alerting, incident routing and audit retention.

A static-only deployment is not the authoritative production architecture because it would omit the server-side RBAC, finance controls, period locks, audit, provider verification and evidence controls.

## Environments

Development → Test → Staging → Production

No production customer, shareholder, financial or private evidence data in development fixtures/source control.

## DNS/TLS

- target hostname: `office.kraviaprivatelimited.com`;
- HTTPS required in production;
- HSTS is emitted by the app in production and should also be enforced at the edge after validation;
- core Office pages must not be embeddable by arbitrary origins;
- iframe use is limited to sandboxed/allow-listed document/internal/provider surfaces.

## Deployment sequence

1. Provision production PostgreSQL, restricted network path, backups/PITR and secret manager.
2. Configure production OIDC/MFA/session policy and role mappings.
3. Deploy canonical `backend.app:app` to staging with live finance execution disabled.
4. Apply the full Alembic migration chain and run CI/Office quality gates.
5. Load verified Company Master/ownership/tax configuration from authoritative reviewed evidence.
6. Configure private storage + malware scanning and read-only Drive service authorization.
7. Configure payment/bank/accounting/eSign integrations in sandbox/test scope where applicable.
8. Verify signed webhooks, idempotency, reconciliation, period close/reopen and provider failure handling.
9. Obtain CA/CS/legal approvals for statutory, ownership and controlled funding/payment configuration.
10. Configure workers, monitoring, alerting, edge/WAF/shared rate limiting and audit retention.
11. Run staging browser/accessibility/security matrix, backup restore drill and inspection-pack dry run.
12. Map DNS/TLS only after all required production evidence gates are satisfied.
13. Enable live finance execution only through an explicit controlled configuration change after provider/bank/legal/accounting approval.
14. Perform first controlled live transaction/reconciliation and retain the evidence.

## Rollback principle

Application rollback must never silently reverse already-issued financial/legal records. Code can roll back to a prior tested release, but data corrections use controlled compensating records, explicit reconciliation, approved reopen workflows and provider-safe idempotency.
