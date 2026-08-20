# Support Operations

## Purpose

Support Operations is Kravia's controlled intake and case-management system for public product support, Trust/DPDP requests, accessibility feedback, and responsible security reporting. It assists staff; it does not make legal determinations, automatically close statutory requests, or publish information.

## Public channels

| Channel | Endpoint | Queue | Purpose | Access |
| --- | --- | --- | --- | --- |
| Support | `/api/support/cases` | `GENERAL` | Product, account, billing and other support | Corporate Admin, Director, System Admin |
| Trust / DPDP | `/api/support/trust` | `TRUST_DPDPA` | Privacy, DPDP, accessibility and grievance requests | Privacy Reviewer, Legal Reviewer, Corporate Admin, Director, System Admin |
| Security reporting | `/api/support/trust` | `SECURITY_REPORTING` | Initial responsible security reports | Security Reviewer, Corporate Admin, Director, System Admin |
| Case tracking | `/api/support/track` | Customer-safe view only | Customer-visible progress | Requester reference plus one-time tracking code |

## Data handling

- Each request stores a purpose, queue, source, request kind, audit event and optional retention-review date.
- Tracking codes are shown once and only their SHA-256 digest is stored.
- General, Trust/DPDP and security queues are isolated through Supabase RLS. UI visibility is not relied on as authorization.
- Public tracking returns only the subject, status and explicitly customer-visible updates.
- Public intake is rate limited using a retained pseudonymous request fingerprint. No public browser receives the Supabase secret.
- Retention periods and closure rules remain subject to Legal/Privacy owner approval; no legal retention period is invented in code.

## Deployment

Apply migrations in order through the Supabase Dashboard SQL Editor:

1. `202608200001_support_operations.sql`
2. `202608200002_trust_dpdp_support.sql`

Then deploy the application and run these smoke tests:

1. Create a General support case and retain its tracking code.
2. Create a Trust/DPDP request and confirm it appears only for a Privacy or Legal reviewer.
3. Create a security concern and confirm it appears only for a Security reviewer.
4. Confirm anonymous direct table access is denied.
5. Confirm public tracking cannot reveal internal updates or another requester's data.

Do not apply the migrations until the target Supabase project and backup/recovery path are confirmed.