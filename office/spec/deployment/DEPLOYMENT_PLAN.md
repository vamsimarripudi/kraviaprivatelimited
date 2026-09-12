# KRAVIA Office deployment plan

Target: `office.kraviaprivatelimited.com`

## Recommended production topology
- Frontend: Vercel or equivalent CDN/app hosting.
- API: dedicated runtime with private environment configuration; Vercel Functions are acceptable for stateless APIs if database/network/security requirements are met.
- Database: managed PostgreSQL, encrypted, automated backups, PITR where supported.
- Documents: private Google Drive integration and/or S3-compatible object storage with server-side authorization.
- Secrets: AWS Parameter Store/Secrets Manager or approved secret manager.
- Email: Google Workspace/Gmail OAuth for controlled ingestion; outbound transactional provider as approved.
- Payments: provider adapters (Razorpay first), signed webhooks.
- Observability: centralized logs, metrics, traces and alerting.

## Environments
Development -> Test -> Staging -> Production

No production customer/financial data in development.

## DNS/TLS
- `office.kraviaprivatelimited.com`
- HSTS after production validation.
- CSP, frame-ancestors and X-Frame-Options strategy appropriate to controlled iframe use.
- Core Office pages must not be embeddable by arbitrary origins.
- Iframes used only for sandboxed PDF/internal approved views and compatible third-party surfaces.

## Deployment sequence
1. Provision production identity.
2. Provision PostgreSQL + migrations.
3. Provision secret manager.
4. Deploy API staging.
5. Deploy frontend staging.
6. Connect Drive/Gmail minimum scopes.
7. Connect Razorpay sandbox/webhooks.
8. Run security + financial test matrices.
9. CA tax/invoice configuration sign-off.
10. CS governance configuration sign-off.
11. Backup + restore test.
12. Production deploy.
13. DNS cutover.
14. Post-deploy smoke test.
15. First controlled live transaction + reconciliation.
