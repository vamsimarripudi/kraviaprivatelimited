# KRAVIA Office v2.0 — Verified Test Report

## Automated result on `main`

Latest verified full quality run:

- Root application: **17 Vitest files / 58 tests passed**.
- Office backend: **28 pytest tests passed**.
- Office quality gate: **PASS**.
- `npm ci`: **0 vulnerabilities**.
- Blocking `npm audit --audit-level=high`: **0 vulnerabilities**.
- ESLint, TypeScript typecheck, secret scan and Next.js 16.3.5 production build: **PASS**.
- Python compile and clean Alembic migration chain through v5: **PASS**.

One upstream Starlette TestClient/AnyIO deprecation warning is emitted by the Python test dependency; it is not a KRAVIA control/test failure.

## Office backend coverage

The suite verifies, among other controls:

1. customer → invoice → payment → receipt → GST working summary;
2. same-state CGST/SGST and inter-state IGST;
3. invoice number length and controlled sequencing;
4. invoice/payment idempotency, overpayment rejection and duplicate external-reference protection;
5. safe public invoice verification and PDF rendering;
6. double-entry journal/trial-balance balancing;
7. Board Meeting → Resolution → CTC → Authority Grant;
8. Vendor / Contract / Employee / Asset / private Document Vault flows;
9. server-side role guards and maker-checker self-approval prevention;
10. commercial Plan → Subscription;
11. Credit Note → tax/revenue reversal accounting;
12. Payment Refund → customer-credit/bank accounting;
13. bank-account/transaction import and deterministic payment auto-match;
14. Command Center derived metrics;
15. Notice Case and Inspection Case/manifest generation;
16. secret-bearing integration configuration rejection;
17. audit-chain and ledger-event integrity;
18. Finance & Ownership ledger/funding/mandate/payment-provider controls;
19. disabled/sandbox finance execution behavior, idempotency and signed provider event handling;
20. controlled company bootstrap/source-control boundary;
21. read-only Google Drive metadata integration and evidence-taxonomy readiness;
22. accounting period close blocking backdated postings;
23. tax period close blocking new tax documents;
24. independent maker-checker period reopen;
25. CSP/security headers, cross-origin mutation guard and rate limiter.

## Migration validation

The clean CI database upgrades successfully through:

- initial KRAVIA Office schema;
- v2 commercial/finance controls;
- v3 tamper-evident audit chain;
- v4 Finance & Ownership / controlled treasury;
- v5 accounting and tax period-close controls.

The v5 migration creates controlled period-lock records and lookup indexes. Runtime posting tests confirm locks are enforced by the central journal service rather than only by the UI.

## Static/runtime validation

- JavaScript syntax checks for the legacy/core Office scripts and canonical web scripts.
- Python backend compilation.
- FastAPI endpoint execution through TestClient.
- PDF render checks verify `%PDF` output.
- SHA-256 evidence generation.
- Office security header/origin/rate-limit middleware tests.
- Google Drive integration remains metadata-only/read-only in automated tests.
- Quality gate requires the Finance & Ownership, period-close, HTTP-security, Drive-readiness and migration controls to exist and pass.

## Root application security validation

The prior CI configuration allowed `npm audit` findings to be diagnostic-only. That was corrected. Dependencies were patched, including Next.js to 16.3.5, and normal CI now fails on high/critical npm vulnerabilities. The verified run reports zero npm vulnerabilities.

## Not claimed as complete without production evidence

The automated suite does not fabricate production acceptance for:

- real OIDC/MFA/identity recovery and the full all-role IDOR/BOLA matrix;
- production PostgreSQL concurrency/failover/backups/PITR restore;
- live Razorpay/RazorpayX/payment-provider eligibility, signed live events and settlements;
- live bank/accounting feeds;
- CA-approved tax/accounting golden cases;
- CS/legal approval of governance/ownership/statutory workflows;
- eSign/DSC provider behavior;
- malware scanning/private object-storage provider integration;
- external staging CSRF/XSS/injection/file-upload penetration testing;
- shared edge/WAF abuse controls for a multi-replica deployment;
- production monitoring/alerting/SLOs;
- authoritative Drive evidence completeness and inspection-pack dry run.

Those are deployment/provider/professional acceptance gates, not missing unit-test placeholders.
