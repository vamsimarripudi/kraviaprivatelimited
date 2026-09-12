# KRAVIA Office API — executable core

This backend is an executable transactional foundation for KRAVIA Office. It is intentionally narrow and correct rather than pretending every external system is connected.

## Implemented
- Legal entity + product registry seed
- Canonical customer master
- Atomic product-aware invoice numbering (<=16 chars)
- Amounts stored as integer paise
- Immutable invoice snapshots
- Intra-state CGST/SGST vs inter-state IGST calculation
- Invoice issuance
- Payment capture + receipt generation
- Idempotency records
- Append-only audit events
- Workflow run traces
- GST working summary
- Compliance register
- Inspection manifest
- SQLite local runtime; SQLAlchemy allows PostgreSQL production migration

## Run
```bash
cd /path/to/kravia-office-v1
python -m uvicorn backend.main:app --reload --port 8000
```

Swagger in development: `http://127.0.0.1:8000/api/docs`

## Critical production gate
This package deliberately does not fake production identity. A real OIDC/MFA/RBAC layer, PostgreSQL, secret manager, encrypted document storage, provider webhooks, bank feed, accounting/tax review and server-side authorization tests must be completed before production use.
