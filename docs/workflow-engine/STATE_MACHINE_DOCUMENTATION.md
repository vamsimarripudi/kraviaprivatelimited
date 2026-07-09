# KRAVIA Company OS - Workflow State Machine

## Workflow States

- `DRAFT`
- `ASSIGNED`
- `RUNNING`
- `IN_REVIEW`
- `PENDING_APPROVAL`
- `APPROVED`
- `REJECTED`
- `PAUSED`
- `ESCALATED`
- `FAILED`
- `CANCELLED`
- `COMPLETED`
- `ARCHIVED`

## Execution Commands

- `START`
- `PAUSE`
- `RESUME`
- `CANCEL`
- `COMPLETE`
- `RESTART`
- `FAIL`
- `ESCALATE`

## Audit Trail

Every execution command writes:

- Workflow history record
- Audit log entry
- Workflow notification record

## Recoverability

Paused, failed, and escalated workflows can be resumed or restarted by authorized users.

Archived workflows cannot be changed.
