# KRAVIA repository and migration-history consolidation — 11 November 2026

This document records the audit trail for GitHub branch cleanup and the connected **KRAVIA Office** Supabase project's migration ledger. It is not a claim that stale feature branches have been deployed.

## Scope and controls

- Repository: `vamsimarripudi/kraviaprivatelimited`, protected target `main`.
- Supabase project: `xjtazosozxmudkbxqhjl` (KRAVIA Office).
- Retain all actual tables, functions, permission policies, rows, and payroll evidence.
- Do not force-push or reset historical branch refs; preserve abandoned, superseded, closed, and audit branches until separately approved for deletion.
- Do not manually alter Vercel deployment configuration.
- Merge only active, conflict-free feature PRs with passed CI; never replay superseded historical branch trees into main.

## Supabase duplicate migration records — pre-reconciliation

Read-only SQL against `supabase_migrations.schema_migrations` on 11 November 2026 confirmed **six records containing only three distinct, byte-for-byte identical SQL payloads**. The following MD5s are for auditing duplicate SQL, not authentication or credential handling.

| Functionality | Keep first applied version and name | Redundant later version and name | SQL byte count | SQL MD5 |
| --- | --- | --- | ---: | --- |
| Permanent department handover | `20261110190951` `kravia_permanent_department_handover_20261110` | `20261110191609` `permanent_department_ownership_202611100001` | 19646 | `024d8f782e453202640d776c27cb76e7` |
| Worktime/payroll evidence | `20261110191539` `kravia_worktime_salary_evidence_20261110` | `20261110191708` `worktime_salary_evidence_202611100002` | 27755 | `c2d7167b55bc660395ef2702fcbba230` |
| Flex Day credits | `20261110191543` `kravia_paid_flex_days_20261110` | `20261110191713` `flex_day_credits_202611100003` | 6803 | `1e1f30241ab7e46bd46d176ab21c7fcb` |

**Reconciliation method:** guarded transactional removal of only the three redundant **history entries**, after verifying each earlier/later pair has exactly the same stored `statements` array and checksum. Do not execute the SQL payloads again. All first-applied rows are retained. Compare migration manifests with repository file naming before using Supabase CLI `db push`; the SQL file names in the repository use a different version convention from the generated apply timestamps.

## Branch disposition policy

- `main` is authoritative. Feature branches from merged PRs are historical snapshots; GitHub may call them “diverged” because squash merges produce new SHAs, not because code is missing.
- Older PRs that were closed without merging are **not** safe to merge merely to reduce branch count. They may contain superseded auth, security, database or UI implementations.
- Document and verify truly new work before merging; do not overwrite current permissions with older implementations.
- Integrate new work from its reviewed PR and run frontend/backend/isolated Postgres checks; verify the live schema **before** dependent runtime code is released.

## Status notes

- PR #94 permanent department handover and PR #96 payroll/worktime were already merged to `main`, along with the corporate email contacts in PR #99.
- At the beginning of this audit, PR #101 (reusable role packages) was the sole outstanding open feature PR and its initial commit had passing CI. Its head may move during review; always validate the latest SHA before merging.
- Vercel: no manual changes as part of this consolidation.
