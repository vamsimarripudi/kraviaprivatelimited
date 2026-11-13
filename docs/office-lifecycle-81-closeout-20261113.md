# KRAVIA Office lifecycle mail — 81-route closeout ledger (2026-11-13)

## Current source evidence (not production activation)
- `main`: 59/81 source-ready as of commit `86806c876c5483c18e68c51749e8b2fa7297e60e` (migration 030).
- Draft PR #145: 74/81 in isolated, synthetic PostgreSQL rehearsals (migrations 031–034).
- Authentication transactional ownership: `AUTH-01/02/03/05/06/08` are not deliverable by the generic lifecycle dispatcher; existing credential flows and the separate opt-in invitation notice path must not duplicate sends.
- Candidate notices: nine `HIRE-` sources have a separate consent-verified, address-bound private outbox and worker; default delivery flags OFF.
- Draft PR #148: forward migrations 035–039 add private two-person former-employee contact evidence and source proofs for `EXIT-02/04/05/06/07/08`. Evidence alone **does not** mark these codes ready, enqueue mail, or authorize a provider request.
- `ONB-04`: a real signatory-access path and scoped, expiring signing link are still unimplemented.

## Exact 7 outstanding policy routes

| Code | Required source proof | Required recipient/delivery control | State |
| --- | --- | --- | --- |
| ONB-04 | Approved appointment document, genuinely issued signing request, valid signing session/URL, actual signatory | Authenticated or independently verified signatory, bounded link lifetime, no token disclosure | BLOCKED |
| EXIT-02 | Approved exit request, verified departure acknowledgement and last working date | Independent, current, unexpired former-employee contact consent | SOURCE EVIDENCE IN #148; DELIVERY BLOCKED |
| EXIT-04 | Immutable access-revoked event plus identity/session revocation proof | Independent former-employee consent; never use revoked corporate mailbox | SOURCE EVIDENCE IN #148; DELIVERY BLOCKED |
| EXIT-05 | Real offboarding settlement case and locked payroll result | Verified, current alternate address and private external worker | SOURCE EVIDENCE IN #148; DELIVERY BLOCKED |
| EXIT-06 | Independently approved settlement with bank-verified credits equal to full net amount | Verified, current alternate address and private external worker | SOURCE EVIDENCE IN #148; DELIVERY BLOCKED |
| EXIT-07 | Approved, signed and delivered relieving/experience document bound to real employee exit | Consent-bound secure document access; no unprotected attachment/link | SOURCE EVIDENCE IN #148; DELIVERY BLOCKED |
| EXIT-08 | Independent final completion after asset, access, payroll, and signed-document reconciliation | Current consent, private worker and source claim revalidation | SOURCE EVIDENCE IN #148; DELIVERY BLOCKED |

## Non-negotiable implementation and release checks

1. Combine forward-only migrations in exact recorded order; never rewrite applied migrations 022–030, and never replay old sends. Verify actual production schema before any migration.
2. For every remaining event, validate immutable source event, active approval authority, current recipient, consent scope/version, and idempotency **at claim time**, not just when a record is created.
3. Offboarded employees must never be emailed through disabled KRAVIA corporate accounts; do not infer personal addresses. A separately authorized delivery worker must treat provider-unknown outcomes as terminal until manual reconciliation.
4. Use synthetic data for fresh-install and legacy-forward PostgreSQL 17 tests, plus frontend/backend security and browser tests. Keep cross-branch overlaps and migration history conflict-free.
5. The seven-route source-gap assertions in `Database/supabase/tests/lifecycle-mail-smoke.sql` are intentionally fail-closed. Change them only once real evidence and independent delivery security tests for each event have passed.
6. All notification policies and worker flags remain OFF until explicit Owner activation, with no emails sent by schema migrations or CI.
7. **No interim Vercel production deploy.** Finalize code, green checks, secure migrations, conflict-free main integration, actual Vercel team access and build quota, then perform the one authorized production deploy.

This ledger records source readiness, not successful production delivery. A count of 81/81 must never be reported from documentation alone.
