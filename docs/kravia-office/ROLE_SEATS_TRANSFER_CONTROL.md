# KRAVIA Office — Role Portfolio, Independent Seats, and Controlled Transfers

**Status:** Implementation branch, NOT a completed production handover.
**Design rule:** Identity, position, statutory title, scope of authority, department ownership and employee compensation are distinct.

## Existing live employee snapshot (14 November 2026, IST)

The verified production identity directory has three active KRAVIA Office identities:

| Current employee | Legacy primary job | Legacy login roles | Confirmed current access profiles |
|---|---|---|---|
| Founder | OWNER_FOUNDER · EXECUTIVE · ACTIVE | OWNER | Owner protection via existing governance |
| COO | COO · OPERATIONS · ACTIVE | ADMIN, CS, LEGAL, OPERATIONS | No active profile row in the snapshot |
| CEO/CFO directory holder | HR_MANAGER · PEOPLE · PLANNED | DIRECTOR, FINANCE, HR, MEMBER, PRODUCT_ADMIN | HR_MANAGER active, scheduled 14 November 2026 IST |

This is a source snapshot, not a certificate of legal appointments. It contains **no automatic role-seat assignment**.
No department ownership, handover request, functional position, role package or role-package application was recorded in the snapshot.

## Current proposed assignment / transfer ledger

1. Founder — protected, nontransferable corporate Founder/Owner identity. Remains governed by existing controls.
2. CTO — establish a separate vacant ENGINEERING seat, then nominate the current Founder as initial CTO holder through formal recipient acceptance and independent review.
3. Full Stack Developer — create a separate ENGINEERING seat using the new reusable FULL_STACK_DEVELOPER position entry in this versioned migration. The catalogue entry does not change any person's signed appointment or payroll.
4. COO — register an OPERATIONS seat and reconcile the existing active COO job with the recipient-accepted seat. If department leadership is intended, separately transfer OPERATIONS ownership.
5. CEO — review executive appointment evidence before creating/activating the executive seat for the employee recorded as CEO/CFO.
6. CFO — register FINANCE executive seat, configure explicitly scoped and reviewed grants. Complete formal FINANCE ownership transfer if intended; the existing FINANCE login role is not enough.
7. HR Manager — verify the planned primary job separately from the already effective HR_MANAGER access profile. Use PEOPLE ownership only when independently approved.
8. Product Administrator — scoped PRODUCT seat only if the existing Product Admin role corresponds to an active operational responsibility.
9. Company Secretary / Legal — independent credential/appointment evidence required; do not infer these offices from broad login roles.

## Role seat lifecycle

**VACANT → PROPOSED → ACCEPTED → REVIEWED → ACTIVE HOLDER**

A holder handover transitions:
**ACTIVE HOLDER → PROPOSED → ACCEPTED → VERIFIED EVIDENCE → COMPLETED**.

Only the recorded current holder or authorized Owner may propose an occupied-seat transfer.
For vacant seats, the protected Owner may propose an initial appointment.
The recipient accepts in their own verified Office AAL2 session.
An independent active Owner, ADMIN or DIRECTOR, who is neither the outgoing nor incoming holder, must verify checklist evidence and finalize.
The database transaction ends the former assignment, establishes the current assignment, and records the former holder and append-only audit event.

The required evidence items include open-work responsibility, access review, department ownership where configured, sensitive provider cutover where applicable, and corporate appointment evidence for executive seats.

**An invited user or directory title never receives a seat or permissions automatically.**

## Least privilege and transfer policy

- Grants belong to seats, not permanent users. A grant is a permission code plus exact resource scope.
- A high-risk grant remains PENDING until reviewed by an independent authorized reviewer.
- Exclusive non-read grants are revoked from the outgoing holder when a seat transfers, even if the outgoing holder has the legacy OWNER role or an older access profile.
- If the outgoing person still holds a separate active Developer seat with its own equivalent, independently authorized resource scope, that Developer right remains valid.
- Former holders may retain authorized read-only company oversight; this must not expose private HR, ethics, security secrets or payment credentials.
- Roles do not by themselves transfer GitHub, cloud, database, signing, finance, payroll or statutory provider entitlements. These require separate approved provider reconciliations and evidence.
- A role seat requiring department leadership cannot finalize until the canonical Department ownership handover has been separately accepted.
- The Company Secretary (CS) is the statutory Company Secretary role, not Customer Support.

## Existing and proposed interfaces

- **Existing:** /office/my-role, /office/role-packages, /office/department-ownership, /office/requests, /office/approvals.
- **New:** /office/my-portfolio (Office), /finance/my-portfolio (Finance), /office/my-portfolio/[seatId], /finance/my-portfolio/[seatId].
- **New guarded API:** GET /api/office-role-seats and same-origin POST actions CREATE, GRANT, REVIEW_GRANT, PROPOSE, ACCEPT, VERIFY_ITEM, FINALIZE, CANCEL.

This is additive and retains existing job, IAM, department ownership, payroll and document systems.

## Required production release order

1. Apply and review the new role-seat migration in **isolated PostgreSQL** first; verify grant privileges, function security, FK constraints, transaction rollback and tests.
2. Review existing FastAPI and Next.js action handlers. They must consult the canonical permission check for former-holder DENY and secure seat grants.
3. Merge matching backend/UI code only after green CI and deployment authorization.
4. In a controlled production migration, apply schema **before** deploying code that calls the role-seat verdict RPC. Deploying code before schema will intentionally fail closed.
5. Initially the new seat tables are empty; invite/identity/position/dept records are unchanged. Record and review each seat and grant explicitly through the authorized Office UI.
6. Rehearse CTO → successor using distinct test accounts and resource scopes; verify former CTO no longer has CTO-only write/approval rights but retains independently authorized Developer writes.
7. Rehearse CFO/Finance ownership handover with maker-checker, statutory and payroll boundaries.
8. Verify external GitHub, Railway, Vercel, cloud/IAM and signing permissions individually; record provider evidence without copying credentials.
9. Inspect audit events and denied direct API calls; test desktop/mobile and long-running sessions.
10. Obtain explicit production cutover approval **for each real employee role/department handover**. Do not infer authorization from this document.

## Known work still required before a release-ready universal authority system

- Full backend endpoint inventory: not every domain action is confirmed to use the central Office permission engine yet. Each must be audited to prevent bypass.
- Independent real provider account handover integrations and live reconciliation.
- Migrating existing operational tasks/approval assignments to role-seat ownership while preserving historical attribution.
- Detailed legal/board signatory evidence and separation of statutory appointments from operational position codes.
- Owner-only and department-owner governance policy for seat-grant configuration across all 20 functions.
- Full PostgreSQL integration tests in CI; source-level Vitest tests alone do not validate SQL transactions.
- Accessibility/browser testing with multiple independently authorized test identities.

Until these are verified, retain the existing production authority and do not finalize real-world handovers.
