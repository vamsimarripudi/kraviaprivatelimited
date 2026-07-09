# KRAVIA Company OS Governance Readiness Report

Date: July 9, 2026

## Phase 15 Summary

Phase 15 extends KRAVIA Company OS with privacy, evidence, approval, access review, risk, and governance controls. The implementation preserves the existing UI style and does not rewrite completed business modules.

## Data Privacy Readiness

Implemented:

- Data classification labels:
  - `PUBLIC`
  - `INTERNAL`
  - `CONFIDENTIAL`
  - `RESTRICTED`
- Sensitive document marking.
- Access visibility notes per record.
- Retention rule notes per record.
- Data export request placeholder timestamp.
- Data deletion request placeholder timestamp.
- Audit logging for privacy record creation, update, export request, deletion request, and archive.

Backend:

- `com.kravia.companyos.privacy`
- `GET /api/privacy/records`
- `POST /api/privacy/records`
- `PUT /api/privacy/records/{id}`
- `PATCH /api/privacy/records/{id}/export-request`
- `PATCH /api/privacy/records/{id}/deletion-request`
- `DELETE /api/privacy/records/{id}`

Frontend:

- `/privacy-center`

Readiness: Foundation ready, pending backend runtime verification.

## Legal Evidence Readiness

Implemented:

- Evidence pack records.
- Legal evidence timeline from real audit logs and document version records.
- Evidence pack generation from stored record counts.
- Export placeholders for PDF, ZIP, and Excel.
- Audit logging for evidence pack generation and archive.

Backend:

- `com.kravia.companyos.evidence`
- `GET /api/evidence/packs`
- `POST /api/evidence/packs/generate`
- `GET /api/evidence/timeline`
- `DELETE /api/evidence/packs/{id}`

Frontend:

- `/evidence-packs`

Readiness: Foundation ready. Actual PDF, ZIP, and Excel export generation remains future work.

## Approval Workflow Readiness

Implemented:

- Approval requests.
- Approval status.
- Approver.
- Approval notes.
- Approval date.
- Rejection reason.
- Linked module and linked record ID.
- Audit logging for approval create, update, decision, and archive.

Approval statuses:

- `DRAFT`
- `PENDING_APPROVAL`
- `APPROVED`
- `REJECTED`
- `CANCELLED`

Backend:

- `com.kravia.companyos.approval`
- `GET /api/approvals`
- `POST /api/approvals`
- `PUT /api/approvals/{id}`
- `PATCH /api/approvals/{id}/decision`
- `DELETE /api/approvals/{id}`

Frontend:

- `/approvals`

Readiness: Operational approval foundation ready. Future work should connect approval creation directly from module detail pages.

## Access Review Readiness

Implemented:

- User access list.
- Role visibility.
- Last login visibility from stored user records.
- Inactive user detection.
- Permission review status.
- Quarterly access review record.
- Audit logging for access review updates.

Backend:

- `com.kravia.companyos.governance`
- `GET /api/governance/access-review`
- `PATCH /api/governance/access-review/{userId}`

Frontend:

- `/governance`

Readiness: Foundation ready. Viewer access to user-level access review is restricted by backend permissions.

## Risk Register Readiness

Implemented:

- Risk title.
- Category.
- Description.
- Severity.
- Likelihood.
- Owner.
- Mitigation plan.
- Status.
- Review date.
- Related records.
- Audit logging for risk create, update, and archive.

Risk categories:

- `LEGAL`
- `FINANCIAL`
- `COMPLIANCE`
- `SECURITY`
- `PRODUCT`
- `OPERATIONAL`
- `REPUTATION`
- `OTHER`

Backend:

- `com.kravia.companyos.risk`
- `GET /api/risks`
- `POST /api/risks`
- `PUT /api/risks/{id}`
- `DELETE /api/risks/{id}`

Frontend:

- `/risk-register`

Readiness: Foundation ready, pending backend runtime verification.

## Compliance Evidence Readiness

Implemented evidence packs for:

- Board meetings.
- Compliance filings.
- Financial records.
- Document vault.
- User access.
- Audit logs.

The current evidence pack stores metadata and source summary from stored records only. It does not generate fake documents.

Readiness: Metadata pack foundation ready. Export generation is intentionally marked as placeholder.

## Governance Dashboard Readiness

Implemented:

- Pending approvals.
- High-risk items.
- Restricted records.
- Sensitive documents.
- Inactive users.
- Generated evidence packs.
- Open risks.
- Access review status.
- Compliance evidence status.
- Recent governance activity from audit logs.

Backend:

- `GET /api/governance/dashboard`

Frontend:

- `/governance`

Readiness: Foundation ready. All dashboard metrics come from stored records.

## Permission Model

Founder:

- Full governance access.
- Can archive privacy, approval, risk, and evidence records.
- Can record deletion request placeholders.

Director:

- Operational governance access.
- Can create and update privacy, approval, risk, and evidence records.
- Can perform access review updates.

Viewer:

- Restricted read-only governance access.
- Cannot create, update, archive, or request deletion.
- Cannot access sensitive user access review details.

## Remaining Governance Gaps

High priority:

- Run backend verification in Java 21 and Maven environment.
- Add backend permission tests for Founder, Director, and Viewer.
- Add integration tests for governance APIs.
- Connect approvals directly to module detail pages.
- Add rejection UI with explicit rejection reason entry.

Medium priority:

- Add full PDF, ZIP, and Excel evidence export generation.
- Add immutable hash chain or signature layer for legal-grade audit hardening.
- Add record-level privacy badges to existing module detail pages.
- Add relationship navigation from approval, risk, privacy, and evidence records to linked modules.
- Add advanced access review workflow with reminders.

Low priority:

- Add governance report export.
- Add governance-specific dashboard filters.
- Add evidence pack retention policies.
- Add privacy policy templates and retention presets.

## Final Assessment

Phase 15 establishes a practical governance foundation suitable for internal company records, auditor review preparation, director accountability, legal traceability, and future due diligence preparation.

Production readiness still depends on backend Java 21/Maven verification and permission test coverage.
