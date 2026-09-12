# KRAVIA Office — Enterprise Foundation v1

Target domain: `office.kraviaprivatelimited.com`

KRAVIA Office is the company operating layer for **KRAVIA PRIVATE LIMITED** and every current/future product. It is company-first, product-aware, evidence-first, and automation-oriented.

## What is implemented in this runnable foundation

- Ultra-modern enterprise administration shell with 24 functional modules/routes.
- Company Master architecture seeded with controlled configuration placeholders. Actual evidence and sensitive particulars are intentionally excluded from Git.
- Product Registry for VidyaLuma, Vaanmeet and VFormix, with a working “Add Product” flow.
- Canonical Customer Master with real local record creation and GSTIN format validation.
- Central Billing Engine demonstration:
  - immutable invoice snapshot
  - product-aware invoice numbering
  - intra-state CGST/SGST vs inter-state IGST calculation
  - discount, due date, SAC and taxable-value fields
  - printable invoice rendering in a sandboxed iframe
- Payment capture demonstration:
  - source invoice linkage
  - partial/full payment handling
  - receivables update
  - receipt issuance
  - printable receipt rendering
- GST Sales Register derived from issued invoice snapshots.
- Reports derived only from real records created inside the foundation.
- Document Vault architecture for authorized private documents and generated invoices/receipts.
- Governance workflow and source-link registry.
- Authority Register requiring a linked source document.
- Corporate communication-ingestion architecture; evidence is not stored in source control.
- Vendor Registry requiring authorized evidence before a provider is marked verified.
- Compliance Register with explicit verification gaps.
- Bank Registry with masked-account support and explicit “no live bank feed” state.
- Automation Registry and workflow run traces created by actual local invoice/payment events.
- Inspection Room with scope-limited document selection, manifest preview and JSON export.
- Local append-only audit trail (demonstration only; production needs server-side tamper resistance).
- Enterprise command palette (`Ctrl/Cmd + K`).
- Responsive interface and sandboxed iframe document previews.

## Controlled-data and no-fake-data rule

This build intentionally does **not** invent:

- cash balance
- bank transactions
- revenue before an invoice exists
- customer counts before customers are created
- GST filing status
- active Razorpay API connectivity
- AWS cost values
- CA/CS filing confirmations
- production authentication

Missing source data is rendered as an honest unavailable/review state.

Before a private local run, provide `KRAVIA_CIN` and `KRAVIA_REGISTERED_OFFICE` through a local, ignored environment file or an approved secret/configuration service. The runtime blocks production startup when that controlled master configuration is absent. Do not commit evidence packs, personal records, bank records, certificates or mail snapshots.

## Run locally

The project has no package/dependency requirement.

```bash
python -m http.server 8123
```

Then open `http://localhost:8123`.

## Vercel

The folder is static and includes `vercel.json`. It can be deployed as a static project after production authentication/access controls are implemented. Do **not** expose this local-foundation build publicly with sensitive real data.

## Production architecture direction

This v1 is a functional front-end/business-logic foundation. Production should move authoritative data and workflow execution into authenticated server-side services:

- Identity + MFA + RBAC/ABAC
- Company Master service
- Product/Customer/Commercial services
- Billing/Tax/Payment orchestration
- Accounting adapter/ledger
- Event bus + workflow engine
- Server-side immutable audit
- Document/version/signature service
- Gmail/Drive provider integrations using production OAuth/service credentials
- Razorpay and bank integrations
- GST filing/reconciliation workflow with human review
- encrypted secrets via approved secret manager
- backups, observability and disaster recovery

## KRAVIA operating standard reflected in this build

- no fake metrics
- no fake payment success
- no dashboard duplication
- one source of truth
- strong auditability and ownership
- enterprise visual discipline
- explicit empty/error/setup-required states
- products share corporate infrastructure rather than duplicating it
