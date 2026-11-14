# KRAVIA Office · Attendance Excel Upload and Extraction

## User path
**KRAVIA Office → People (HR) → Upload & Extract Attendance · Excel reconciliation → Expand.**

This feature accepts the original private KRAVIA HR reconciliation workbook, including `Source Sessions` and `Aug 2026`, `Sep 2026`, `Oct 2026`, and `Nov 2026`. HR cannot use this endpoint as an unattended payroll or leave import.

## How to fill the workbook
1. Keep the source snapshots and date/employee columns unchanged. The `Source Sessions` sheet is evidence only, including exceptional and open sessions.
2. In each monthly sheet, enter **J** verified/payable *regular minutes* (maximum 360 for one normal weekday), **K** separately authorized paid leave minutes, **L** overtime *candidate minutes*, **M** a real signed/documentary source reference, and **N** the proposed reviewer decision.
3. Leave unknown dates blank, not "Absent"; missing records stay unresolved.
4. Do not enter fictitious timestamps. The workbook records daily total minutes only; HR must reconcile actual check-in/check-out evidence separately.
5. The workbook's `APPROVED` text does not authorize HR hours, overtime, salary, employment, statutory contributions or wage payments.

## In the Office
- **Select** the `.xlsx` file, maximum **2 MiB**. Raw content is parsed in memory; the original Excel file is **not** persisted to public storage.
- Choose **Extract & validate**. HR sees each edited row, its source, date, employee, proposed hours, source reference, and errors/warnings.
- Fix all errors in Excel and extract again. Open/unreasonable source records and weekend/OT candidates are highlighted for review.
- Choose **Stage for HR review** to save a private batch with its SHA-256 fingerprint and normalized proposed rows. Database constraints reject duplicates and future dates.
- A *different* authorized HR Manager/Director independently reviews each row with a source-based explanation. Neither the uploader nor the beneficiary can accept their own evidence.
- **Accepted** means "the paper/electronic source was inspected," not "salary payable." Paid-leave items require a separately approved HR leave record. Overtime requires its own effective policy and adjustment approval.

## Import record boundaries
The isolated `office_hr_attendance_import_batches`, `office_hr_attendance_import_rows` and `office_hr_attendance_import_events` tables store minimal metadata, candidate minutes, documentary references, actual reviewer identity and decisions. Data is private under RLS; `anon` and `authenticated` have no direct table or privileged-function access.

The importer **never inserts** canonical clock sessions, historical `office_worktime_review_cases`, approved leave, payroll attendance snapshots, compensation versions, payment batches, payslip issues or bank settlement evidence. This is essential because minute totals alone cannot prove actual worked time intervals or applicable salary entitlements.

When the user returns the completed sheet, an HR operator can validate and stage it. Actual payroll still requires independently reviewed attendance/leave evidence, effective signed compensation, independent Finance review, Owner decision and verified bank-payment evidence.

## Implementation
- Frontend: `components/office-hr-attendance-import.tsx`
- Extractor: `lib/office/hr-attendance-workbook.ts` (ZIP integrity, bounded XML parsing, no external entities/macros/formulas in editable fields)
- Auth/API: `app/api/office-hr-attendance-import/route.ts`
- Server review: `lib/office/hr-attendance-import-server.ts`
- Migration: `Database/supabase/migrations/202611140007_hr_attendance_workbook_import.sql`
- QA: `Frontend/tests/office-hr-attendance-workbook.test.ts`, isolated PostgreSQL smoke `Database/supabase/tests/hr-attendance-workbook-import-smoke.sql`.

No real employee records, board resolutions or payable hours are seeded.
