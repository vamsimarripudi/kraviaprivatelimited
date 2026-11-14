# KRAVIA Office — HR, Worktime, Salary and Overtime Source Audit
**Audit snapshot:** 14 November 2026 (IST)  
**Source:** `vamsimarripudi/kraviaprivatelimited`, feature branch `feature/hr-hours-auto-payroll-audit-20261114`  
**Scope:** code, API, DB migrations, UI and isolated CI; no production database, live employee records, real bank payments, or Vercel deployment was modified during this audit.

## Operating rule
KRAVIA's internal workforce standard is flexible worktime, six net hours per normal Monday–Friday workday, 30 net hours per full working week. Clock-in, clock-out and unpaid breaks are evidence of work. Authentication sessions are not payroll time. The **approved monthly gross remuneration is the contractual entitlement**; absence, statutory leave, paid holidays and adjustments must be independently classified, and missing evidence cannot by itself prove unpaid leave or misconduct.

## Verified source map
| Area | Existing or new source | Operational outcome |
| --- | --- | --- |
| Role and access | `Frontend/lib/office/workspaces.ts`, `Frontend/lib/office/permission-engine.ts`, HR effective-access migration | Owner/admin boundaries and effective HR authority; no self-approval |
| Time recording | `Frontend/lib/office/flexible-worktime.ts`, `office_attendance_sessions`, `office_attendance_breaks` | Real clocked sessions with unpaid breaks, flexible starts |
| Work evidence | `Frontend/app/api/office-worktime/route.ts`, `worktime-payroll-server.ts`, `202611140003_hr_hours_payroll_revision_guards.sql` | Recorded shifts queued for independent review, historical corrections and auditable pending edits |
| Regular pay calculation | `Frontend/lib/office/attendance-salary-preview.ts` | Computes scheduled regular hours, approved regular hours, unresolved hours and provisional gross |
| Payroll preparation | `Frontend/app/api/office-payroll/route.ts`, `payroll-server.ts` | Reviewable attendance snapshots, compensation versions, adjustments and payroll calculation |
| Overtime | `Frontend/lib/office/worktime-payroll-policy.ts` | Independent policy, reviewed weekday/weekend/night premiums and draft-only adjustment import |
| Payment | `office_salary_payment_batches`, `office_salary_settlement_evidence` | Salary batches are instructions, not bank transactions; payment status requires verified settlement |
| HR surrounding modules | `office-recruitment`, `office-people-development`, `office-workforce-lifecycle`, `workforce-administration-panel` | Recruitment, performance, workforce transition and scoped access exist as independent modules |

## Defects addressed on this feature branch
1. **Missing live hours-to-payroll pathway:** added approved-hours preview and controlled auto-fill of a monthly payroll attendance snapshot. The preview separates potential overtime from base salary and never automatically classifies missing hours as unpaid.
2. **Uneditable HR corrections:** added edit of the original submitter's *pending* historical evidence, with the original values retained in the event history. Approved historical records remain immutable; correction requires a subsequent independently reviewed entry.
3. **Unreviewed completed clocked sessions:** added a queue action for completed attendance sessions. Queueing is not approval. An independent eligible reviewer must approve the evidence.
4. **HR_MANAGER policy mismatch:** server-side review permission now recognizes the effective-dated HR_MANAGER role for attendance but preserves director-only authority over work-premium policy approvals.
5. **Stale payroll calculations:** an audit trigger supersedes a calculated draft if its attendance or approved/draft adjustment changes. Approved and submitted periods cannot be directly rewritten.
6. **Duplicate overtime imports:** an existing differing premium blocks re-import, and a database partial unique index enforces at most one active draft/approved premium of each type per employee and period, including concurrent attempts.
7. **Wrong month evidence from overnight work:** worktime reads now use IST month boundaries and one preceding day for overnight overlaps without pulling unrelated future-month claims.
8. **Manual payroll corrections lacking evidence:** HR edit forms prefill existing hours; server validates payable hours and paid leave, requires documentary references, update reason and an optimistic timestamp check.

## Correctness contract
`scheduled_regular_hours = number_of_normal_Monday_to_Friday_days × approved_daily_hours` is a **review target**, not a statutory constant for every worker. `verified_regular_hours` is capped at six hours per normal working day after deducting verified unpaid breaks. `provisional_base_gross = approved_monthly_gross × reviewed_payable_units ÷ period_basis_units` is not final payroll. Approved paid leave belongs in payable units. Genuine unpaid leave, absence and holiday treatment must have reviewed source records. No deductions or net-pay withholding may be inferred solely from a missing check-in. Final payroll includes separately governed statutory amounts and approved adjustments.

The existing worktime policy template proposes a weekday overtime premium of 2× and weekend premium of 3× ordinary reference hourly pay, with an optional night premium, but **none is activated without legally suitable approved written policy and independent review**. The reference monthly hours used for overtime may differ from the actual number of scheduled weekdays; confirm wage basis and applicable law before enabling employee-specific policies. Re-importing changed OT evidence is intentionally blocked until a governed adjustment/reconciliation is completed.

## Remaining gaps and deployment gates
| Priority | Remaining item | Required action |
| --- | --- | --- |
| P0 — release gate | Production schema and permissions not yet verified against this feature migration | Run migration in disposable clone, review existing duplicate OT rows before unique-index creation, approve rollout |
| P0 — payroll data | No employee remuneration, time or bank confirmation is seeded | Import only signed/approved compensation versions and actual independently reviewed evidence |
| P0 — actual payout | Bank transfer execution and reference reconciliation are separate from salary batch preparation | Finance maker-checker approvals, payment-channel integration and verified bank receipts |
| P1 | Paid holidays, leave balances, statutory absences and partial-month hires require manual reviewed snapshots | Add a governed calendar/leave ingestion process and evidence-backed overrides before accepting auto-payroll as end-to-end |
| P1 | Stale or corrected *approved* overtime cannot be reimported automatically | Use an independently approved reversal/off-cycle correction workflow with no history rewrite |
| P1 | Salary components and deductions (PF, ESI, TDS, tax and benefits) remain policy/rule dependent | CA-verified effective-dated rule configuration and validation |
| P1 | HR Manager/Director access in production not tested with a real session | Live permission checks for Manohar, HR reviewer, employee, department head, Finance reviewer and Owner |
| P1 | Browser/mobile and employee-data UI flows not smoke-tested against actual deployment | Execute mobile, desktop, session refresh and screen reader checks after authorized non-preview staging/production path |
| P2 | Cross-module lifecycle reconciliation with recruitment, signed appointments, payroll start, leave, offboarding and final settlement | Link source references and automation only after HR/Finance sign-off |
| P2 | Batch correction/resubmission UX and advanced review filters | Add safe versioned bulk tools, never in-place edits to locked results |

## Compensation authorization
KRAVIA's signed appointment documents currently record Founder & CTO ₹50,000/month, CEO/CFO ₹40,000/month and COO ₹40,000/month. The user's planned additional Full Stack Developer amount is ₹70,000/month, giving ₹1,20,000/month for Founder/CTO + Developer **only after a separate approved compensation annexure**. Do not infer additional CEO, CFO, COO or Company Secretary salary from a title or staffing-model estimate. Store multiple roles as distinct earning components under one employee/employment payroll identity unless a qualified adviser explicitly approves a different classification.

## Acceptance checks
- All 6-hour, 8-hour, split-day, weekend and overnight scenarios are independently reviewed, consistent across IST boundaries and free of duplicate earning minutes.
- Missing check-in stays unresolved until verified leave, holiday, absence or historical evidence is supplied.
- HR can add/edit pending source-backed claims; another independent reviewer can decide; employee cannot self-approve.
- HR can update a draft attendance snapshot with a reason; updated calculation supersedes the prior preview; previously locked payslips and bank-confirmed settlements are not rewritten.
- Re-import with new overtime evidence cannot create a duplicate active premium. All imported adjustments require separate payroll review.
- No unapproved salary compensation or statutory rule becomes active; candidate OT is not payment.
- Prepared batches and generated slips do not mark wages PAID; only verified bank-settlement evidence does.
- Frontend TypeScript/lint/targeted Vitest and disposable PostgreSQL 17 regression jobs pass. Live runtime and production data migration remain separate gates.

**Release decision:** code-only branch; do not merge `main`, dispatch Vercel preview, activate production schema or execute payroll without explicit authorization.
