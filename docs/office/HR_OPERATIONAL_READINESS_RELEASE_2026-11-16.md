# KRAVIA Office — HR Operations Completion & Controlled Release
**Prepared:** 16 November 2026 (IST)  
**Scope:** Operational People/HR; no payroll disbursement, fabricated attendance or irreversible access changes  
**Code branch:** feature/hr-operational-readiness-command-20261116

## Definition of finished
A green CI run verifies code behavior only. HR must not be labelled operationally COMPLETE unless original employment evidence, independently reviewed time records, approved payroll policies, Finance checks, actual employee acceptance, and live-role UX testing are confirmed. This dashboard is a **read-only evidence queue**, not a compliance certificate or substitute for the statutory employee register.

## What was implemented on this branch
1. Private, company-scope HR readiness endpoint at \`/api/office-hr-readiness\`. It requires AAL2, HR/executive role **and** an effective company-wide \`people.basic.read\` permission; sensitive component counts additionally require their own effective capabilities.
2. Aggregate-only reads through the existing server-side authorization layer; no raw bank values, PAN/Aadhaar, salary amounts, user identities, document signatures, attendance intervals or payment references are returned.
3. Real-time-on-refresh HR control center embedded ahead of the existing Employee Records modules. Blue/violet/amber/red design, responsive cards, dark-mode support, explicit loading/retry/denied states and permission-gated action links.
4. Server-generated P0/P1/P2 evidence actions for incomplete active employment dates, pending time review, overdue sessions, onboarding, bank verification, immutable IDs, historical worktime reconciliation, missing authorized compensation/rule/OT versions, devices and employee mail delivery.
5. Root-cause distinction: a currently open session is *not* overdue; a restricted payroll count is *not* zero; a planned job is *not* payroll-eligible; a draft company resolution is *not* an approval.
6. Existing HR Excel import and employee intake remain governed and unchanged. The new action links open their actual existing in-page evidence desks.
7. Tests to prevent unsafe completion claims and authorization regressions.

## Live evidence snapshot at review
The values below are a point-in-time observation, NOT test fixtures to seed into production:
- Employment: 2 ACTIVE, 1 PLANNED; both ACTIVE records are missing \`start_date\`.
- Attendance: 15 sessions, 13 CLOSED, 2 OPEN on 16 November 2026. Zero old OPEN sessions at the snapshot.
- Worktime: 7 PENDING review cases; first recorded workdate 12 November.
- Compensation and policy: no active compensation versions, no worktime policy versions, no approved payroll rule versions.
- Intake: one DRAFT; zero verified bank records; zero permanent employee reference IDs; no signed onboarding proofs recorded in the connected Office intake workflow.
- Payroll: no issued payslips, calculated payroll results, payment batches or bank settlement confirmations.
- Notifications: 81 source-ready lifecycle event policies, zero enabled; the employee-ID-issued mail policy is disabled/unapproved.
- Access: one effective HR_MANAGER access profile; one employee record remains PLANNED; no TRUSTED company-managed device entries in the governed registry.
These counts must be refreshed before any payroll release; a legacy login device approval is distinct from company-managed device trust.

## P0 — Must complete with authentic human evidence
| Gate | Custodian | Required action | Acceptance evidence |
| --- | --- | --- | --- |
| Existing salary authority | Directors / company secretary or qualified reviewer | Obtain the actually executed K-BR-2026-07, disclosures, participation, required corporate consents and employment terms | Properly signed Board minutes/resolution and accepted employment letters; original reference and signing dates |
| Proposed revisions | Eligible directors / CA / HR | Consider each proposed revision separately; resolve legal and personal eligibility | Newly adopted decision and valid effective date, never automatically before 1 Dec 2026 |
| Employment dates | HR + actual employee | Reconcile start dates from signed acceptance and joining evidence; keep PLANNED separate | Timestamped evidence and independently authorized record update |
| Worktime review | HR reviewer (not submitter/beneficiary) | Resolve 7 outstanding cases using check-in/out and original evidence | Reviewed case IDs, sources, true breaks, anomaly decisions and audit history |
| Payroll rules | CA / Finance / Owner | Verify applicable statutory wage base, tax, PF/ESI, PT, leave/holidays, contractual OT eligibility | Versioned authoritative source, effective dates and independent approvals |
| Compensation | HR maker + Finance checker + Owner | Enter the *actual approved* single consolidated salary per eligible employee | Version ID, approved gross/components and sign-offs, not amounts inferred from proposed PDFs |
| Bank verification | Employee + independent Finance reviewer | Securely verify employee-submitted bank details; never send bank identity by unencrypted email | Masked details and evidence reference + verified reviewer |
| Payout | Three distinct authorized people, bank, Finance | Prepare / review / approve / transfer / reconcile separately | Verified payment reference and receipt; a batch alone is not paid |

## P1 — HR operational adoption
1. Close every required private employee intake and accepted appointment signature; issue immutable IDs only after documented verification. Do not invent or copy signatures.
2. Reconcile physical August–October 2026 attendance pages with digital evidence. Preserve original page/serial, corrections, missing dates, paid holidays and leave; do not infer absence from missing login.
3. Activate approved \`EMPLOYEE_ID_ISSUED\` delivery policy through **Office → Settings → Owner controls** only after a provider-acknowledgement test. Enable lifecycle events individually and only after approved business need and transactional evidence.
4. Test with a real HR Manager, ordinary employee, HR restricted session, Finance reviewer, Owner and offboarded/revoked identity. High-risk reads must fail closed on untrusted devices; do not elevate via role labels.
5. Validate mobile HR dashboard, private intake, file scanning, saves, resubmission, error/retry, empty datasets, notification delivery, department handover, payroll locks and accessibility.

## P2 — Complete the HR operating cycle
- Pilot recruitment and interview/offer evidence with designated HR permissions; candidates must give lawful consent and personal data must remain private.
- Create and review current company policies and the appropriate leave/holiday calendar; verify state-specific applicability with a qualified adviser.
- Pilot employee skills, training assignment, performance appraisal, confidential grievances, disciplinary due process and documented offboarding/final settlement using approved test identities and no live compensation.
- Adopt a monthly compliance/controls review: HR exceptions, payroll recalculation hashes, audit retention, device access, security incident access, proof of salary bank credit and document retention.

## Owner/HR/Finance acceptance checks
- [ ] HR Manager can see HR navigation and Employee Records with effective role/capability and correct device state. PLANNED job is never silently converted into ACTIVE.
- [ ] Non-HR/revoked user receives 403 from \`/api/office-hr-readiness\`; no salary/user details leak.
- [ ] HR sees real pending worktime count, not fictional approvals; today's open check-ins are not classified as overdue.
- [ ] HR can submit factual pending evidence; separate reviewer decides; no self-approval.
- [ ] HR intake requires actual employee submission, HR review and Finance evidence before ID issue.
- [ ] OT cannot be imported without approved, effective employee-specific worktime policy and reviewed work sessions.
- [ ] Approved salary is sourced from valid governing employment terms, not proposed increments.
- [ ] Payroll preparation, Finance review and Owner final decision are distinct human identities and every result is locked against after-the-fact silent mutation.
- [ ] Payslip is issued only for approved locked payroll, and paid status only from independently verified bank evidence.
- [ ] Required employee mail events are enabled only with Owner authority, real provider confirmation and safe delivery retry state.
- [ ] Browser/mobile smoke tested on actual production commit and associated database schema; Vercel project-team access is confirmed by an authorized user.
- [ ] CA/legal reviewer signs off statutory applicability and wage bases before first real disbursement.

## Controlled activation
**Allowed without new approvals:** Code-level validation, read-only evidence counts, existing restricted UI navigation, isolated test setup, non-production code review.

**Not authorized by this implementation:** Change employee start dates, approve someone else's timesheet, sign board resolutions, change salaries or statutory rules, activate all emails, enroll a device as company-owned, set earnings to paid, execute a transfer, backdate service, or deploy unreviewed code. These require their own real actors, documents and applicable approval.

**Do not declare HR fully finished** until the operational checklist is completed and verified. The code may be ready while actual employment and payroll remain blocked.

## Related sources
- \`docs/office/HR_HOURS_PAYROLL_GAP_AUDIT_2026-11-14.md\`
- \`docs/office/HR_WORKTIME_OPERATIONS_2026-11.md\`
- \`docs/office/HR_ATTENDANCE_WORKBOOK_UPLOAD.md\`
- \`docs/kravia-office/PRIVATE_EMPLOYEE_INTAKE.md\`
- \`Frontend/lib/office/permission-engine.ts\`
- \`Database/supabase/migrations/20261114120622_hr_payroll_maker_checker_20261114.sql\`
