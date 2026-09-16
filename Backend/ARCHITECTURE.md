# Architecture — KRAVIA Office

## System boundary

KRAVIA Office is the internal corporate control plane above all KRAVIA products. It remains a bounded subsystem inside the company repository; Finance & Ownership is a bounded domain within Office, not a second Office application.

```text
Products / Channels
  VidyaLuma | VaanMeet | VFormix | Future Products
                     ↓
            Commercial Platform
  Catalog | Pricing | Orders | Subscriptions | Entitlements
                     ↓
               Billing Engine
      Tax | Invoice | Payment | Refund | Credit
                     ↓
          Finance & Ownership Controls
 Ownership | Funding | Expense Calls | Mandates | Treasury
                     ↓
             Financial Controls
 Ledger | Period Close | Settlement | Bank | Reconciliation
                     ↓
           Corporate Administration
Governance | Compliance | Contracts | Vendors | People | Assets
                     ↓
           Evidence & Assurance
Documents | Drive Readiness | Audit | Inspection | Security
```

## Canonical runtime

`backend.app:app` is the authoritative Office ASGI runtime. It attaches the legacy/core Office API plus Finance & Ownership, accounting/tax period controls, read-only Drive evidence readiness, HTTP security middleware and the same-origin `web/` surface.

The source tree intentionally keeps domain modules separate instead of placing all new behavior into `backend/main.py`:

- `backend/finance_ownership.py` + `finance_models.py` — ownership/funding/treasury bounded domain;
- `backend/period_controls.py` — accounting/tax close controls;
- `backend/drive_integration.py` — read-only evidence metadata/readiness;
- `backend/security_controls.py` — HTTP headers, Origin/host checks and baseline rate limiting;
- `backend/services.py` — shared posting/event/audit services and central journal-period enforcement.

## Domain boundaries

1. Company Master
2. Product Registry
3. Customer Master
4. Commercial
5. Billing
6. Customer Payments / Revenue
7. Tax
8. Accounting / Period Close
9. Banking / Reconciliation
10. Legal Ownership / Share Ledger
11. Shareholder/Director Funding Policies and Contribution Calls
12. Company/Vendor Treasury and Payout Instructions
13. Governance
14. Compliance
15. Contracts
16. Vendors / Procurement
17. People / HR
18. Assets
19. Communications
20. Documents / Evidence
21. Privacy / Security
22. Audit / Inspection
23. Reporting
24. Integration Registry
25. Workflow / Automation

## Critical invariants

- Legal ownership, shareholder/director expense funding, customer revenue and vendor/company payouts are separate data/accounting domains.
- Ownership is changed only by an approved legal ownership transaction; contributions/payments never change ownership automatically.
- Issued financial documents are immutable; corrections use linked controlled reversals/credit/refund flows.
- Historical documents render from historical snapshots.
- Every high-risk action has an actor, source, time, status, reason and audit event.
- Products cannot directly own corporate books/tax truth.
- Duplicate provider events must not duplicate financial side effects.
- Active `ACCOUNTING`, `TAX` or `BOTH` locks prevent affected postings into closed periods.
- Reopening a closed period requires an approved maker-checker request.
- A CTC cannot grant authority beyond its source resolution.
- A document existing does not mean a compliance obligation or legal fact is approved.
- Drive evidence is metadata-discovered/readiness-classified; private bytes and credentials do not enter source control.
- Tax/legal/ownership conclusions are versioned and professionally reviewed.
- No production success state without source/provider verification.

## Workflow reliability

Implemented/recommended patterns:

- transactional outbox for domain events;
- provider-event deduplication/idempotency;
- maker-checker for high-risk actions;
- accounting/tax period locks;
- immutable/versioned documents and SHA-256 evidence;
- append-only/tamper-evident audit chain;
- explicit reconciliation and exception states;
- fail-closed finance execution modes;
- bounded OpenAPI contract generated from the canonical app and checked in CI.

Production deployment still needs the external queue/worker runtime, shared edge/WAF abuse controls, monitoring/alerting and backup/restore infrastructure described in the production gates.

## Iframe policy

Use iframes only for controlled PDF previews, approved isolated internal tools, compatible BI views, or provider surfaces whose documentation explicitly supports embedding.

Do not iframe the core app, government portals that disallow framing, arbitrary external URLs, or payment flows requiring top-level origin/security context unless the provider explicitly supports it.

All iframe sources must be allow-listed and sandboxed.
