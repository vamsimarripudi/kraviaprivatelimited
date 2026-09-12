# Architecture — KRAVIA Office

## System boundary

KRAVIA Office is the corporate control plane above all products.

```text
Products / Channels
  VidyaLuma | Vaanmeet | VFormix | Future Products
                     ↓
            Commercial Platform
  Catalog | Pricing | Orders | Subscriptions | Entitlements
                     ↓
               Billing Engine
      Tax | Invoice | Payment | Refund | Credit
                     ↓
             Financial Controls
       Ledger | Settlement | Bank | Reconciliation
                     ↓
           Corporate Administration
Governance | Compliance | Contracts | Vendors | People | Assets
                     ↓
           Evidence & Assurance
Documents | Audit | Inspection | Reports | Security
```

## Domain boundaries

1. Company Master
2. Product Registry
3. Customer Master
4. Commercial
5. Billing
6. Payments
7. Tax
8. Accounting
9. Banking/Reconciliation
10. Governance
11. Compliance
12. Contracts
13. Vendors/Procurement
14. People/HR
15. Assets
16. Communications
17. Documents
18. Privacy/Security
19. Audit/Inspection
20. Reporting
21. Integration Registry
22. Workflow/Automation

## Critical invariants

- Issued financial documents are immutable.
- Historical documents render from historical snapshots.
- Every high-risk action has an actor, source, time, status, reason and audit event.
- Products cannot directly own corporate books/tax truth.
- Duplicate provider events must not duplicate financial side effects.
- A CTC cannot grant authority beyond its source resolution.
- A document existing does not mean a compliance obligation is completed.
- Tax/legal conclusions are versioned and professionally reviewed.
- No production success state without source verification.

## Production workflow reliability

Recommended implementation patterns:

- transactional outbox for domain events
- inbox/idempotency table for external/provider events
- saga/workflow orchestration for long-running processes
- maker-checker for high-risk actions
- period locks for accounting/tax
- immutable object versions for documents
- signed/hashed document records
- append-only audit event store
- explicit reconciliation jobs
- dead-letter queue and replay tooling

## Iframe policy

Use iframes for:

- controlled PDF previews
- approved isolated internal tools
- compatible BI views
- selected provider surfaces only where embedding is contractually/technically supported

Do not iframe:

- the core app itself
- government portals that disallow framing
- payment flows that require top-level origin/security context unless provider documentation explicitly supports it
- arbitrary external URLs

All iframe sources must be allow-listed and sandboxed.
