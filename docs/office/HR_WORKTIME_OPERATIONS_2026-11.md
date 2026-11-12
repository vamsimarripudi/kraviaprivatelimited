# KRAVIA Office — HR attendance & working-time operations
Effective operational tracking: **14 November 2026 (IST)**. 
Historical evidence intake opens at **1 August 2026 (IST)**; **no historical attendance, paid hours or overtime has been fabricated**.

## Employment and access
- The existing Office identity **Manohar** is currently **INVITED**. The already-catalogued `HR_MANAGER` profile has been staged on that identity, with a strict effective time of **14 November 2026, 00:00 IST**. The position record is **PLANNED**, effective that date.
- No privileged Office access is available until the user completes invitation acceptance, required MFA, device approval where enforced, and the effective-date condition. Profile assignments remain limited by existing Owner/IAM controls.
- Access scope: People/HR worktime review and approved employee records; this does **not** transfer People department ownership, appoint a second Owner or grant salary disbursement.
- If formal People department ownership is needed, an ACTIVE employee must separately accept the Owner-proposed handover in Office. Do not impersonate consent or bypass the department transfer workflow.
- Manohar has an existing DIRECTOR and HR role. A manager can submit a historical entry on behalf of another active employee, but cannot approve a claim they submitted or from which they benefit.

## Required attendance — no fixed shift
- **6 net hours** on each Monday–Friday working day and **30 net hours** for the full Monday–Friday week.
- Employees choose their own start/end times. A login is an authentication event, **not worktime**. The employee must explicitly use **Check in**, **Start/end break**, then **Check out** in the Office status/attendance menu. Unpaid breaks are deducted. Split sessions on the same day are supported by the underlying tracker.
- Overtime is **time beyond six net weekday hours** and separately tracked optional weekend time; these are **potential**, not approved pay or an automatic premium. The pre-existing independently-approved payroll policy and Board evidence process remains mandatory before earnings changes.
- **14 November is a Saturday.** Attendance can be recorded that day if work occurs; the first complete 30-hour target week is **16–20 November**. Weekends are not automatically required six-hour shifts.
- `/office/worktime` now displays current daily progress, weekly totals, month-by-month evidence, remaining hours, candidate overtime and the existing payslip ledger.

## HR historical restoration from 1 August
1. In Office > **Attendance & salary slips** select **Month** (August 2026 onward) and then the employee (e.g., Jaya).
2. Choose **Add / correct employee hours**. Enter *actual* original IST start/end timestamps and any unpaid break times.
3. Supply a traceable source reference (timesheet, signed record, task or meeting evidence) and explanatory note. Never enter six-hour defaults into undocumented past dates.
4. Submit for **independent** review by an authorised Director. The submitter and beneficiary cannot approve the same entry; approved historical work is included in the attendance target summary without adding overlapping clocked minutes twice.
5. Resolve missing days, approved leave, holidays, weekends or interruptions with supporting records; **absence must not be inferred just because there is no check-in**.
6. Do not import salaries, overtime or weekend premiums without a separately approved policy, controlled payroll calculation and review.

## Daily HR operating checklist
- Confirm authorised employees can check in and check out; employees should use the in-app attendance control at their actual work start and finish.
- Review missing/open sessions, breaks, incomplete days and any unusual overtime; collect evidence before approvals.
- Compare each Monday–Friday day's six-hour target and full completed weeks against 30 net hours; note genuine leave or approved holidays separately.
- When submitting corrections for Jaya or colleagues, keep times factual and preserve the independent review barrier.
- Never reset account passwords or send invitation emails as part of attendance automation.

**Deployment gates:** CI / disposable PostgreSQL rehearsal / audited permissions / protected production activation. No manual password email or test attendance records are sent by this implementation.
