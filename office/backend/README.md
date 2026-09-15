# KRAVIA Office API — canonical executable core

This backend is the transactional/server-side foundation for KRAVIA Office. It implements corporate controls without pretending external identity, bank, payment, Drive, tax or legal approvals are connected when they are not.

## Canonical application

Run `backend.app:app`. `backend.main:app` contains the legacy/core API but does not attach all bounded domains and HTTP controls.

The canonical application adds:

- Finance & Ownership router/model boundary;
- accounting/tax period-close controls;
- read-only Google Drive evidence readiness;
- CSP/security headers, trusted-host/origin controls and baseline mutation rate limiting;
- same-origin Office web UI.

## Implemented core controls

- Legal entity + product registry foundation
- Canonical customer/commercial records
- Atomic controlled invoice/document numbering
- Integer-paise money model and immutable invoice snapshots
- GST calculation, invoice issuance, payment/receipt, credit note/refund and settlements
- Double-entry journal/trial balance and accounting/tax period locks
- Bank transaction/reconciliation foundation
- Finance & Ownership share ledger, funding, expense calls, mandates and payment instructions
- Disabled/sandbox/live provider execution boundary with idempotency and signed provider-event handling
- Governance, compliance, vendor, contract, employee and asset records
- Private document versions, SHA-256 integrity, locks and audited downloads
- Append-only/tamper-evident audit events and domain-event/outbox records
- Inspection controls and Drive evidence readiness
- OIDC/JWT production architecture and server-side RBAC/maker-checker controls

## Run

From the repository root:

```bash
cd office
python -m pip install -r backend/requirements.txt
alembic upgrade head
python -m uvicorn backend.app:app --reload --port 8000
```

Development API docs: `http://127.0.0.1:8000/api/docs`.

## Verify

```bash
cd office
python -m pytest backend/tests -q
python scripts/export_openapi.py --check
python scripts/quality_gate.py
```

## Production boundary

A green backend build does not manufacture production identity/MFA, verified Company Master/ownership/tax evidence, CA/CS/legal approvals, live provider/bank credentials, Drive service authorization, production PostgreSQL/backups, malware scanning, shared edge abuse controls or monitoring. Those remain explicit production gates in `../spec/security/PRODUCTION_GATES.md`.
