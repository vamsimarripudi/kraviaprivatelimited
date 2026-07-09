# KRAVIA Company OS Future Improvements List

Date: July 9, 2026

## Immediate Improvements

1. Implement the Settings module or remove it from launch scope.
2. Run full backend verification with Java 21 and Maven.
3. Add integration tests for authentication, permissions, document access, and audit logging.
4. Run end-to-end tests for Founder, Director, and Viewer workflows.
5. Execute Docker compose production test with PostgreSQL.

## Security Improvements

- Add refresh-token revocation on logout if not already verified.
- Move rate limiting to Redis or another shared store before horizontal scaling.
- Add dependency scanning in CI.
- Add security headers at the frontend hosting layer.
- Add internal-only access rules for health endpoints if required.
- Add tamper-resistant audit log retention.

## Data and Storage Improvements

- Add S3-compatible private document storage.
- Add signed document access URLs with short expiry.
- Add automated PostgreSQL backups.
- Add restore drills and documented recovery time targets.
- Add archival retention policies for documents and audit logs.

## Quality Improvements

- Add Playwright or Cypress end-to-end coverage.
- Add frontend unit tests for route guards, forms, and core components.
- Add visual regression tests for enterprise UI consistency.
- Add accessibility checks using axe or equivalent tooling.
- Add contract tests for all APIs.

## Product Improvements

- Implement true PDF and Excel export for reports.
- Add advanced global search ranking and highlighting.
- Add notification delivery channels such as email.
- Add configurable settings for company, security, storage, and notification preferences.
- Add private LLM provider integration for Executive AI Assistant when policy allows.

## Operations Improvements

- Add centralized log aggregation.
- Add metrics dashboards.
- Add alerting for failed logins, backup failures, storage errors, and database health failures.
- Add release checklist automation in CI/CD.
- Add environment-specific deployment runbooks.
