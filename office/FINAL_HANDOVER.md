# KRAVIA Office v2.0 — Final Development Handover

## Purpose

`office.kraviaprivatelimited.com` is designed as the company operating system for KRAVIA PRIVATE LIMITED and all present/future KRAVIA products. It is not a VidyaLuma-only admin panel and not a document folder with a dashboard on top.

## Architecture principle

Products create business. KRAVIA Office provides the canonical corporate/commercial layer:

`Product event → customer/commercial context → billing/tax → payment → accounting → reconciliation → evidence → governance/compliance/audit`.

Every important record should be able to answer: who owns it, what its status is, what changed, who changed it, what evidence supports it, and what happens next.

## Included executable capabilities

- FastAPI API with SQLAlchemy persistence
- PostgreSQL-ready configuration and Alembic migrations
- OIDC/JWT production-auth architecture and production auth gate
- role-based access controls
- maker-checker approval control
- company/product/customer masters
- commercial plans and subscriptions
- invoices, GST calculations, payments, receipts, credit notes and refunds
- double-entry operational journal and trial balance
- bank-account registry, bank transaction ingestion and payment matching
- settlements registry
- governance meetings, resolutions, CTC generation and authority grants
- compliance obligations and authority notices
- vendors, contracts, people and assets
- versioned/locked document vault with SHA-256 integrity
- inspection cases and hash-based inspection manifests
- integration registry that rejects raw secrets
- transactional outbox/domain-event model
- workflow-run registry and formal workflow specifications
- source-backed enterprise web foundation
- controlled evidence-pack generator
- quality gate and automated test suite

## Production rule

Never turn a configuration gap into a fabricated success state. If a bank feed, GST filing, provider integration, identity system or statutory record is not connected/verified, Office must say so explicitly.

## Start development API

```bash
cd kravia-office-v2-final
python -m pip install -r backend/requirements.txt
alembic upgrade head
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

API docs are available in non-production mode at `/api/docs`.

## Run tests

```bash
python -m pytest -q
python scripts/quality_gate.py
```

## Docker development

```bash
export POSTGRES_PASSWORD='set-a-local-development-secret'
export OFFICE_BOOTSTRAP_KEY='use-a-real-dev-key'
docker compose up --build
```

## Production activation sequence

1. Provision dedicated KRAVIA Office source repository and CI/CD.
2. Provision managed PostgreSQL with encryption, PITR, backups and restricted network access.
3. Configure corporate OIDC identity provider, MFA and KRAVIA roles.
4. Configure approved secrets manager; never place provider secrets in Office registry JSON.
5. Lock verified Company Master from authoritative incorporation/tax/bank evidence.
6. Obtain CA approval for tax catalog, GSTIN, SAC mappings, invoice series and accounting mappings.
7. Obtain CS review of governance workflows/templates and statutory-record procedures.
8. Configure private document/object storage and malware scanning.
9. Configure Google Workspace/Drive application OAuth/service authorization.
10. Configure Razorpay/payment providers with webhook signature verification and replay controls.
11. Configure approved bank statement/feed ingestion and settlement reconciliation.
12. Provision queue/background workers for the outbox and scheduled controls.
13. Configure observability, alerts, incident routing, SLOs and audit-log retention.
14. Perform staging security testing, restore drill and inspection dry run.
15. Map `office.kraviaprivatelimited.com` only after all production gates have evidence.

## Legal/accounting boundary

The software implements controls and workflows; it does not replace the statutory judgment of the company's CA, CS, auditor or legal counsel. Tax/accounting/governance configuration that affects statutory output must be approved and evidenced before production lock.
