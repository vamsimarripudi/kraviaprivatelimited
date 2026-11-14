# KRAVIA Office 5.0 — verified Supabase migration reconciliation

**Feature branch only. Production schema untouched by this reconciliation.**

## Read-only verification against KRAVIA Office Supabase (14 Nov 2026)

Project reference: xjtazosozxmudkbxqhjl, PostgreSQL 17. Using a read-only query
against supabase_migrations.schema_migrations, we compared md5(statements[1])
for seven applied migrations with the byte-for-byte GitHub SQL source. **All seven
hashes matched.** The discrepancy was the repository's earlier 12-digit
migration version prefixes, not the SQL content.

| Production-applied version | Repository filename (normalized) | Verified source MD5 |
| --- | --- | --- |
| 20261114102312 | 20261114102312_office_department_handover_access_sync_20261114.sql | 01d8635ea28d1d707befbd140c570eb4 |
| 20261114110233 | 20261114110233_office_document_email_otp_approval_20261114.sql | 1025386c49756ce43fe3ceeea39deb0e |
| 20261114120547 | 20261114120547_hr_hours_payroll_revision_guards_20261114.sql | 268eae6c6bc9097fd92d446841856214 |
| 20261114120559 | 20261114120559_hr_payroll_independent_review_20261114.sql | 5c18e7d9722337c4d09247eaf6c82f58 |
| 20261114120612 | 20261114120612_hr_leave_evidence_20261114.sql | 7db886381bf5628816b7c01c0d3b8a3b |
| 20261114120622 | 20261114120622_hr_payroll_maker_checker_20261114.sql | 0d9c7692a9a09d44f03a426cdfa72c02 |
| 20261114140609 | 20261114140609_hr_attendance_workbook_import_20261114.sql | 0000843e1c378f912e46cbc82daebea0 |

**Do not reapply these seven migrations.** They are already recorded in the
production migration history. Normalized repository filenames intentionally
preserve every source byte, including original internal comment references.

## New Office 5.0 additions: 17 unapplied migrations

The original feature-only 12-digit versions 202611140007–202611140023
are normalized, in the same relative order, to **14-digit versions
20261114150001–20261114150017**, all after the last already-applied
production version 20261114140609. New SQL remains branch-only; no
production mutation or migration history repair was performed.

New additions cover private chat, groups, Vault access and requests,
threads/search, department channels, IT escalations, secure attachments,
unread snapshots, pins, reactions, scope triggers, preferences, private
real-time and typing, sealed Vault locker, and encrypted chunked ingestion.

## Remaining migration release gates

- Recheck the actual migration list immediately before release for new
  concurrent migrations beyond 20261114120622 and reconcile any overlap.
- On a detached approved clone of the full current Office schema, apply
  the 17 new SQL files in order and test dependencies, RLS, atomic claims,
  private storage/scanner/quarantine, grants, rollback and restore.
  Isolated stub-based SQL suites passing is not equivalent to this.
- Keep the current production keyring, private storage bucket, identity
  and device configuration unchanged until release approval.
- Never run migrations against production as part of CI; do not use
  migration repair or suppress a drift without live source verification.
- Vercel is explicitly outside the current execution scope.

The automated test Frontend/tests/office5-migration-history.test.ts locks
the six live-source hashes, checks the 17 forward-only migrations, and
checks referenced paths in relevant GitHub Actions workflows.