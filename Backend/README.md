# KRAVIA Office — Corporate Operating System

Canonical browser paths: `https://kraviaprivatelimited.com/office` and `https://kraviaprivatelimited.com/finance`

KRAVIA Office is the company operating layer for **KRAVIA PRIVATE LIMITED** and current/future KRAVIA products. The canonical implementation lives in this repository under `Frontend/`, `Backend/` and `Database/`. It is company-first, product-aware, evidence-first, auditable and deliberately fail-closed for high-risk production actions whose external credentials/evidence are not configured.

## Canonical runtime

The production-oriented Office runtime is the FastAPI application exported by `backend.app:app`.

It combines:

- authenticated/RBAC API and SQLAlchemy data model;
- Alembic migrations;
- Finance & Ownership bounded domain;
- accounting/tax period-close controls;
- read-only Google Drive evidence readiness;
- CSP/security headers, Origin guard and baseline mutation rate limiting;
- API-only Railway runtime; the canonical browser UI is the root Next.js application under `Frontend/`.

The older root static files remain in the repository for compatibility/history, but they are not the authoritative production runtime.

## Implemented domains

- Company Master and Product Registry
- Customer Master and Commercial plans/subscriptions
- Billing, GST/tax, invoices, receipts, credit notes and refunds
- Payments, settlements, bank transaction ingestion and reconciliation
- Accounting journal/trial balance and controlled accounting/tax period locks
- Finance & Ownership: share ledger, transfer requests, funding policies, expenses, contribution calls, mandates and payment instructions
- Governance: meetings, resolutions, CTC and authority grants
- Compliance/notices, contracts, vendors, people and assets
- Private document vault, versions, hashes, locks and audited downloads
- Inspection cases/manifests/evidence packs
- Integration registry, outbox/domain events and workflow runs
- Read-only Drive evidence metadata/readiness
- Audit chain and security controls

See `IMPLEMENTATION_STATUS.md`, `TEST_REPORT.md`, `FINANCE_OWNERSHIP.md`, `DRIVE_INTEGRATION.md` and `spec/security/PRODUCTION_GATES.md` for verified scope and external gates.

## Controlled-data / no-fake-data rule

Do not commit or invent:

- legal/shareholder identity records, cap table/share register or share certificates;
- bank account secrets or payment credentials;
- unverified cash/revenue/bank balances;
- GST filing/compliance success;
- provider connectivity/success states;
- CA/CS/legal approvals;
- private Drive document contents.

Missing/unverified source data must remain an explicit setup-required/unverified state. Production ownership data must be loaded only from reviewed authoritative evidence.

## Local development

From the repository root:

```bash
cd Backend
python -m pip install -r backend/requirements.txt
alembic upgrade head
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

The backend root exposes only operational status. Non-production API documentation is available at `http://127.0.0.1:8000/api/docs`; the browser workspaces run from the root Next.js application.

Use a local ignored environment file or exported variables based on `backend/.env.example`. Bootstrap authentication is development-only.

## Verification

Office checks:

```bash
cd Backend
python -m pytest backend/tests -q
python scripts/export_openapi.py --check
python scripts/quality_gate.py
```

Repository CI additionally runs:

- blocking high/critical npm dependency audit;
- secret scan;
- ESLint and TypeScript typecheck;
- root Vitest suite;
- Next.js production build;
- clean Office Alembic migration;
- Office backend tests and quality gate.

The current audited baseline is documented in `TEST_REPORT.md`.

## Docker development

```bash
cd Backend
export POSTGRES_PASSWORD='set-a-local-development-secret'
export OFFICE_BOOTSTRAP_KEY='use-a-real-dev-key'
docker compose up --build
```

## Background worker

Run automation/outbox processing as a separate process or Railway service:

```bash
cd Backend
python -m backend.worker
```

For a deploy/CI smoke iteration:

```bash
python -m backend.worker --once --batch-size 25
```

The worker uses a PostgreSQL transaction advisory lock so concurrent replicas do not execute the same tick. It records a durable heartbeat, raises sanitized runtime alerts on failure, bounds outbox batches, and leaves unsupported events in `WAITING_HANDLER` so the operations dashboard can flag missing handlers. The worker does not execute bank/payment providers.

For Railway, use root directory `Backend`, `Dockerfile.worker`, the same production `DATABASE_URL` as the API, and no public domain. A continuously running worker uses its configured interval and batch size. A lower-idle-cost cron deployment may run `python -m backend.worker --once --interval 300 --batch-size 100` on `*/5 * * * *`; the worker persists the effective cadence in its heartbeat so operations readiness uses the correct stale threshold instead of assuming a 60-second loop.

## Evidence integration

Google Drive integration is metadata-only/read-only. It can report whether expected Office evidence areas are available, empty or missing and can flag obvious filing errors. It does not download private content or move files.

Configure runtime-only values such as `GOOGLE_DRIVE_ROOT_FOLDER_ID` and a read-only service-account secret outside source control.

## Finance execution

`FINANCE_EXECUTION_MODE` is fail-closed:

- `disabled` — no provider execution;
- `sandbox` — deterministic/test provider behavior;
- `live` — allowed only after provider eligibility, credentials, bank/payment flow approval and applicable legal/accounting review.

Ownership is independent from expense funding and payment history. Contributions/payments never change the cap table automatically.

## Production activation

Production still requires real identity/MFA, PostgreSQL/backups, secret management, verified Company Master/ownership/tax evidence, CA/CS/legal review, provider/bank credentials, private storage + malware scanning, Drive service authorization, shared edge/WAF controls for multi-replica deployment, monitoring/SLOs, restore drills, security acceptance and DNS/TLS activation.

A green software build does not fabricate those external facts. See `FINAL_HANDOVER.md` for the activation sequence.
