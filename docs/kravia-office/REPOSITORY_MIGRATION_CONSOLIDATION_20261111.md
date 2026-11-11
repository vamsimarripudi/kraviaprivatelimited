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

## Complete branch inventory (audit snapshot)

At audit time: **94 refs including `main`**; `main` SHA: `ae13067e2f35d209a2bf52d20019794b1b579689`. Non-`main` classifications: 72 previously merged PR heads, 4 historical branches with post-merge commits, 12 closed unmerged PR branches, 1 active PR branch, 4 with no PR (including this audit branch).

A historical branch is not an outstanding feature solely because its Git commit ancestry diverges after a squash merge.

| Branch | PR | Classification | Disposition |
| --- | --- | --- | --- |
| `authenticator/android-apk-artifact-20260921` | #71 | Previously merged | No replay; recorded in main via PR merge/squash |
| `authenticator/kravia-authenticator-v1-20260921` | #70 | Previously merged | No replay; recorded in main via PR merge/squash |
| `authenticator/kravia-mobile-20260921` | #73 | Closed without merge | Intentionally retain; don't introduce unreviewed historical implementation |
| `authenticator/kravia-mobile-final-20260921` | #74 | Closed without merge | Intentionally retain; don't introduce unreviewed historical implementation |
| `authenticator/production-hardening-20260921` | #72 | Previously merged | No replay; recorded in main via PR merge/squash |
| `authenticator/production-signing-20260921` | #80 | Previously merged | No replay; recorded in main via PR merge/squash |
| `chore/kravia-consolidation-audit-20261111` | — | No PR / audit | Current consolidation audit |
| `ci/railway-deploy-fail-closed-20260919` | #32 | Previously merged | No replay; recorded in main via PR merge/squash |
| `ci/railway-worker-source-deploy-20260919` | #54 | Previously merged | No replay; recorded in main via PR merge/squash |
| `ci/remove-railway-api-deploy-deadlock-20260919` | #55 | Previously merged | No replay; recorded in main via PR merge/squash |
| `ci/worker-deploy-scope-timeout-20260919` | #56 | Previously merged | No replay; recorded in main via PR merge/squash |
| `content/jaya-coo-profile-20261110` | #97 | Previously merged | No replay; recorded in main via PR merge/squash |
| `content/vidyaluma-evidence-20261110` | #95 | Previously merged | No replay; recorded in main via PR merge/squash |
| `database/service-table-hardening-20260918` | #28 | Previously merged | No replay; recorded in main via PR merge/squash |
| `docs/kravia-workspace-alias-registry-20261110` | #99 | Previously merged | No replay; recorded in main via PR merge/squash |
| `docs/office-release-reality-20260918` | #13 | Previously merged | No replay; recorded in main via PR merge/squash |
| `docs/product-company-evidence-20261110` | #93 | Previously merged | No replay; recorded in main via PR merge/squash |
| `feat/corporate-social-links-20261104` | #81 | Previously merged | No replay; recorded in main via PR merge/squash |
| `feat/landing-refresh-20261104` | #84 | Previously merged | No replay; recorded in main via PR merge/squash |
| `feat/leadership-team-20261023` | #78 | Previously merged | No replay; recorded in main via PR merge/squash |
| `feat/search-ai-discovery-20261104` | #85 | Previously merged | No replay; recorded in main via PR merge/squash |
| `feature/diwali-2026-24h` | #87 | Historical post-merge commits | Review post-merge delta, never force old tree into main |
| `feature/diwali-2026-uhd-production` | #91 | Previously merged | No replay; recorded in main via PR merge/squash |
| `feature/kravia-permanent-department-handover-20261110` | #94 | Previously merged | No replay; recorded in main via PR merge/squash |
| `feature/kravia-reusable-workforce-assignments-20261111` | #101 | Active review | Merge only after latest CI and production migration review |
| `feature/kravia-worktime-payroll-payslips-20261110` | #96 | Previously merged | No replay; recorded in main via PR merge/squash |
| `feature/public-access-resources` | #83 | Closed without merge | Intentionally retain; don't introduce unreviewed historical implementation |
| `fix/diwali-2026-official-logo-contrast` | #90 | Previously merged | No replay; recorded in main via PR merge/squash |
| `fix/office-audit-control-plane-20260918` | #12 | Previously merged | No replay; recorded in main via PR merge/squash |
| `fix/office-login-diagnostics-20260919` | #33 | Previously merged | No replay; recorded in main via PR merge/squash |
| `fix/public-page-spacing-team-contacts-20261110` | #98 | Previously merged | No replay; recorded in main via PR merge/squash |
| `hotfix/auth-v10-provider-fk-check-20260919` | #51 | Previously merged | No replay; recorded in main via PR merge/squash |
| `hotfix/founder-register-control-plane-20260919` | #57 | Previously merged | No replay; recorded in main via PR merge/squash |
| `integration/kravia-office-workforce-20261111` | #100 | Closed without merge | Intentionally retain; don't introduce unreviewed historical implementation |
| `kravia-ai-discoverability` | #75 | Previously merged | No replay; recorded in main via PR merge/squash |
| `office/accounting-period-close-20260918` | #4 | Previously merged | No replay; recorded in main via PR merge/squash |
| `office/audit-resume-20260920` | #67 | Closed without merge | Intentionally retain; don't introduce unreviewed historical implementation |
| `office/audit-retention-20260918` | #20 | Previously merged | No replay; recorded in main via PR merge/squash |
| `office/background-worker-20260918` | #18 | Previously merged | No replay; recorded in main via PR merge/squash |
| `office/banking-reconciliation-20260918` | #5 | Previously merged | No replay; recorded in main via PR merge/squash |
| `office/database-execution-role-20260918` | #27 | Previously merged | No replay; recorded in main via PR merge/squash |
| `office/design-hardening-20260920` | #60 | Previously merged | No replay; recorded in main via PR merge/squash |
| `office/expenses-funding-20260918` | #7 | Previously merged | No replay; recorded in main via PR merge/squash |
| `office/experience-4-0` | #86 | Previously merged | No replay; recorded in main via PR merge/squash |
| `office/fastapi-boundary-regression-20260918` | #26 | Previously merged | No replay; recorded in main via PR merge/squash |
| `office/finance-command-center-20260918` | #16 | Previously merged | No replay; recorded in main via PR merge/squash |
| `office/financial-assurance-20260918` | #9 | Previously merged | No replay; recorded in main via PR merge/squash |
| `office/first-party-auth-20260919` | #34 | Previously merged | No replay; recorded in main via PR merge/squash |
| `office/gst-fynamics-filing-20260920` | #66 | Historical post-merge commits | Review post-merge delta, never force old tree into main |
| `office/gst-iris-core-20260920` | #63 | Previously merged | No replay; recorded in main via PR merge/squash |
| `office/gst-purchase-reconciliation-20260920` | #64 | Previously merged | No replay; recorded in main via PR merge/squash |
| `office/gst-rate-master-20260920` | #61 | Previously merged | No replay; recorded in main via PR merge/squash |
| `office/gst-tax-workspace-20260918` | #3 | Previously merged | No replay; recorded in main via PR merge/squash |
| `office/gst-ui-cleanup-20260920` | #65 | Previously merged | No replay; recorded in main via PR merge/squash |
| `office/internal-completion-20260921` | #69 | Previously merged | No replay; recorded in main via PR merge/squash |
| `office/legacy-fastapi-rls-20260918` | #29 | Previously merged | No replay; recorded in main via PR merge/squash |
| `office/operations-observability-20260918` | #17 | Previously merged | No replay; recorded in main via PR merge/squash |
| `office/ownership-control-20260918` | #8 | Historical post-merge commits | Review post-merge delta, never force old tree into main |
| `office/payments-treasury-20260918` | #6 | Previously merged | No replay; recorded in main via PR merge/squash |
| `office/product-tax-profiles-20260920` | #62 | Previously merged | No replay; recorded in main via PR merge/squash |
| `office/railway-ci-deploy-20260918` | #23 | Previously merged | No replay; recorded in main via PR merge/squash |
| `office/readiness-reconcile-20260918` | #30 | Previously merged | No replay; recorded in main via PR merge/squash |
| `office/registry-audit-20260918` | #10 | Previously merged | No replay; recorded in main via PR merge/squash |
| `office/shared-rate-limit-20260918` | #21 | Previously merged | No replay; recorded in main via PR merge/squash |
| `office/worker-cadence-20260918` | #19 | Closed without merge | Intentionally retain; don't introduce unreviewed historical implementation |
| `office/worker-cadence-v9-20260918` | #24 | Previously merged | No replay; recorded in main via PR merge/squash |
| `ops/backup-restore-drill-20260919` | #43 | Previously merged | No replay; recorded in main via PR merge/squash |
| `ops/database-restore-drill-20260919` | #39 | Previously merged | No replay; recorded in main via PR merge/squash |
| `ops/encrypted-db-backup-20260919` | #35 | Previously merged | No replay; recorded in main via PR merge/squash |
| `ops/fix-github-worker-order-20260919` | #37 | Previously merged | No replay; recorded in main via PR merge/squash |
| `ops/fix-restore-drill-column-skew-20260919` | #44 | Previously merged | No replay; recorded in main via PR merge/squash |
| `ops/fix-restore-drill-gpg-20260919` | #40 | Previously merged | No replay; recorded in main via PR merge/squash |
| `ops/fix-restore-drill-privileges-20260919` | #41 | Previously merged | No replay; recorded in main via PR merge/squash |
| `ops/fix-restore-drill-provider-skew-20260919` | #42 | Previously merged | No replay; recorded in main via PR merge/squash |
| `ops/github-worker-fallback-20260919` | #36 | Previously merged | No replay; recorded in main via PR merge/squash |
| `ops/live-office-probe-20260919` | — | No PR / audit | No automatic merge; check for obsolete or already-superseded work |
| `ops/rerun-restore-drill-20260919` | #46 | Previously merged | No replay; recorded in main via PR merge/squash |
| `ops/restore-drill-20260919` | — | No PR / audit | No automatic merge; check for obsolete or already-superseded work |
| `ops/restore-drill-provider-data-20260919` | #45 | Closed without merge | Intentionally retain; don't introduce unreviewed historical implementation |
| `ops/retire-github-worker-schedule-20260919` | #38 | Previously merged | No replay; recorded in main via PR merge/squash |
| `perf/office-ultrafast-20260919` | #58 | Historical post-merge commits | Review post-merge delta, never force old tree into main |
| `product/recruitflow-public-profile-20260919` | #31 | Previously merged | No replay; recorded in main via PR merge/squash |
| `release/diwali-2026-uhd-validated` | #92 | Closed without merge | Intentionally retain; don't introduce unreviewed historical implementation |
| `security/canonical-file-router-20260919` | #48 | Previously merged | No replay; recorded in main via PR merge/squash |
| `security/legacy-runtime-boundary-20260918` | #14 | Closed without merge | Intentionally retain; don't introduce unreviewed historical implementation |
| `security/modern-supabase-secret-key-20260919` | #49 | Closed without merge | Intentionally retain; don't introduce unreviewed historical implementation |
| `security/private-file-quarantine-20260919` | #47 | Previously merged | No replay; recorded in main via PR merge/squash |
| `security/storage-broker-cutover-20260919` | #52 | Previously merged | No replay; recorded in main via PR merge/squash |
| `security/storage-broker-final-20260919` | #53 | Closed without merge | Intentionally retain; don't introduce unreviewed historical implementation |
| `security/supabase-secret-key-20260919` | #50 | Closed without merge | Intentionally retain; don't introduce unreviewed historical implementation |
| `security/supabase-trigger-execute-hardening-20260918` | #11 | Previously merged | No replay; recorded in main via PR merge/squash |
| `site/nicerole-brand-rename-20260921` | #68 | Previously merged | No replay; recorded in main via PR merge/squash |
| `tmp-office-security-ui` | — | No PR / audit | No automatic merge; check for obsolete or already-superseded work |

## Migration-history reconciliation outcome

On 11 November 2026, the three later duplicate migration **history rows** (`20261110191609`, `20261110191708`, `20261110191713`) were removed within a checked transaction. The original versions (`20261110190951`, `20261110191539`, `20261110191543`) remain, with the SQL hashes shown above; a follow-up `list_migrations` confirmed the entries. No schema changes or application-data deletion occurred during this ledger cleanup.
