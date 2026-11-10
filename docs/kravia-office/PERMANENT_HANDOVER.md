# KRAVIA Office — permanent department ownership

**Implementation:** `feature/kravia-permanent-department-handover-20261110` / PR #94  
**Rollout status:** Code proposed; migration not applied. No active department owners are assigned by the migration. No production transfer has been performed.

## Business contract

- KRAVIA has 20 active department codes; their catalogue remains unchanged.
- Founder retains company-level role administration and read visibility, including departments handed over.
- A department's current owner controls its normal business writes. When ownership is transferred and the recipient accepts, the former owner permanently loses business write and approval authority in that department, even if they hold the `OWNER` role, a company-wide access profile, or a later `ALLOW` override.
- Recipient must accept in their own AAL2 Office session. The proposing owner cannot accept on their behalf. A pending proposal changes no permission.
- The department's current owner can hand over to a future team head. A former owner can only regain authority through a new current-owner-proposed, recipient-accepted transfer. No automatic expiry.
- Role delegation is separate from an ownership transfer. A business title, directorship, or role does not override a recorded former-owner denial.
- Existing independent financial, payroll and security approvals remain in force. A department owner cannot automatically approve their own pay change or create a bank transfer.

## Current technical scope

- PostgreSQL `office_department_ownership` is the canonical owner record, `office_department_former_owners` is the former-owner denial history, and `office_department_transfer_requests` stores recipient decisions. `office_department_transfer_events` is an append-oriented trail.
- `office_department_permission_verdict` is evaluated before `OWNER` privilege shortcuts by both `office_effective_permission` and the Next.js server permission engine. The authenticated FastAPI boundary enforces the same rule on mapped write routes and finance approval decisions.
- The Founder UI receives a filtered capability snapshot. Transferred Finance write controls are disabled, but Finance read views remain accessible. All secured handlers must still perform server-side checks; a disabled button is not an authorization control.
- The Office Department ownership page permits proposals, recipient acceptance and cancellation. It lists only the signed-in person's relevant departments and transfer requests, except that Founder sees the organisation.
- Existing user sessions and all 20 department entries are preserved. The migration never auto-transfers Finance to a named employee.
- Mapping is based on existing atomic permission codes. The current permission catalogue has no dedicated Marketing module and some cross-module actions require follow-up mapping and endpoint review; do not claim all 20 department APIs are completely transferred yet.

## Activation sequence (not run)

1. Obtain independent review and passing frontend/backend CI. Review active backend write endpoints, eSign and payroll exceptions.
2. Apply the versioned PostgreSQL migration in a non-production database before deploying the matching API/UI. Verify RLS and service-role-only RPC grants.
3. Seed separate test identities for a Founder and recipient; do **not** use production employee identities for tests. Confirm pending transfer has no effect, then simulate acceptance.
4. Assert Finance `GET` still succeeds for former owner, but all Finance `POST/PUT/PATCH/DELETE`, bank payout approvals and even direct Railway requests return 403. Test explicit allow-profile attempt, old sessions, concurrent transfers, receipt/statement downloads and other mapped departments.
5. Test current owner's writes, future handovers, cancellation, director maker/checker and transaction-log integrity. Confirm no privilege inversion.
6. Only with separate production release approval, apply migration before frontend/backend release and complete smoke checks. Onboard Satish/Jaya with verified identity, then propose transfers in authenticated Office; each recipient accepts.

## Known limitations / no-go conditions

- GitHub's normal quality-gates workflow had not reported completion when this PR was opened. Treat repository code as **unverified** until CI, SQL migration rehearsal and a browser/API E2E pass are recorded.
- Director/Founder read-only visibility does not imply visibility into personally restricted ethics, health or confidential employee records; those still use independent privacy safeguards.
- The 30-hour workweek, 3× weekend OT, night shifts, Flex Days, automatic bank credit, salary slip issuance, and historical payroll are distinct later phases. They are **not** delivered by PR #94.
- Production database payroll and office staff remain unchanged; no live records should be created or transferred automatically.

## Rollback and recovery

If deployed code and migration diverge, fail closed rather than restoring the old universal OWNER write shortcut. Do not delete former-owner or transfer-event history. Disable new transfer initiation first, retain read-only access, fix application/routine alignment, and use controlled, independently authorised corrections to ownership.
