# Implementation Status — KRAVIA Office v2.0

## Current verified build state

KRAVIA Office is a runnable multi-product corporate operating-system foundation with an executable FastAPI/SQLAlchemy/Alembic core and enterprise web surface inside the canonical `vamsimarripudi/kraviaprivatelimited` repository. It is deliberately production-gated where real credentials, statutory evidence, professional approvals or deployment infrastructure are required.

### Enterprise operating surface
- [x] Enterprise application shell with company-first navigation
- [x] Multi-product Product Registry and future-product support
- [x] Company Master / customer / commercial / billing / tax / accounting / governance / compliance / contracts / vendors / people / assets / documents / audit / inspection modules
- [x] Finance & Ownership bounded domain inside Office rather than a separate product
- [x] Command palette/global search foundation
- [x] Responsive administration UX
- [x] Sandboxed iframe/PDF document preview pattern
- [x] Honest unavailable/setup-required states instead of fabricated metrics

### Identity and authorization
- [x] Dedicated `KRAVIA Office` Supabase Auth project provisioned in `ap-south-1` (`xjtazosozxmudkbxqhjl`), isolated from product projects
- [x] Server-side RBAC roles: OWNER, DIRECTOR, FINANCE, CA, CS, LEGAL, HR, OPERATIONS, AUDITOR and PRODUCT_ADMIN
- [x] Explicit identity-admission and role tables deployed with deny-by-default RLS/client privileges
- [x] Custom Access Token Hook function deployed; fail-closed output verified for unassigned identities
- [x] Production OIDC/JWT architecture with issuer/audience/JWKS verification
- [x] Production startup hard-block if OIDC issuer/audience/JWKS are not configured
- [x] Same-origin Supabase Auth BFF with HttpOnly/SameSite cookie storage; bearer/refresh tokens are not exposed to application JavaScript
- [x] TOTP enrollment/challenge/verification flow and production `aal2` enforcement
- [x] No Office public self-signup endpoint
- [x] Role-guarded governance, finance, HR, document and banking mutations
- [x] Maker-checker approval primitive preventing requester self-approval
- [ ] Supabase dashboard activation: asymmetric signing key + Custom Access Token Hook + public-signup restriction — hosted Auth configuration gate
- [ ] First human Office identity creation, explicit role assignment and TOTP enrollment — operator/user gate
- [ ] Full staging IDOR/BOLA/all-role acceptance matrix — production acceptance gate

### Finance & Ownership
- [x] Share ledger / ownership summary / transfer-request model
- [x] Ownership changes separated from expense funding and treasury/payment records
- [x] Funding policies and contribution calls
- [x] Expense obligations and allocation records
- [x] Payment mandates with caps/frequency/state controls
- [x] Payment instruction state machine and provider-event deduplication
- [x] Sandbox/disabled/live execution gate; live is fail-closed without provider configuration
- [x] RazorpayX payout adapter boundary and signed Razorpay webhook verification
- [x] Finance dashboard web surface and finance API test coverage
- [ ] Verified production cap table/share register/share certificates/shareholder agreement bootstrap — controlled evidence/professional gate
- [ ] Live payment/payout eligibility, credentials and bank/provider approval — external gate

### Billing / tax / payments
- [x] Integer-paise money model
- [x] Controlled invoice numbering with <=16-character guard
- [x] Immutable invoice billing snapshot
- [x] Intra-state CGST/SGST vs inter-state IGST calculation
- [x] Discount and overpayment validation
- [x] Invoice SHA-256 verification
- [x] Safe public invoice-verification endpoint
- [x] Payment posting and receipt issuance
- [x] Payment idempotency and duplicate external-reference protection
- [x] Credit-note engine linked to original invoice
- [x] Credit-note controlled numbering and hash
- [x] Refund engine linked to source payment and optional credit note
- [x] Refund ceiling control
- [x] Settlement registry with gross/fee/tax/net validation
- [ ] CA-approved production GST catalog, SAC mappings and verified GSTIN — professional/evidence gate

### Accounting / reconciliation
- [x] Chart of accounts foundation
- [x] Double-entry operational journal
- [x] Invoice, payment, credit-note and refund postings
- [x] Trial balance with balancing verification
- [x] Bank-account registry storing masked account references only
- [x] Bank-transaction import model
- [x] Auto-match of compatible bank credits to customer payments
- [x] Reconciliation exception state when deterministic match is unavailable
- [x] Accounting/TAX/BOTH period-lock model
- [x] Central journal enforcement preventing postings into closed periods
- [x] Maker-checker controlled period reopen with audit/domain events
- [ ] Approved statutory accounting policy/chart mapping and final accounting-system integration — CA/company policy gate
- [ ] Live bank feed — bank/provider authorization gate

### Governance
- [x] Board Meeting registry
- [x] Resolution registry with SHA-256 locked content hash
- [x] CTC PDF generation
- [x] Authority Grant derived from approved resolution authority scope
- [x] Governance audit trail and domain events
- [ ] CS-reviewed production governance templates / statutory-register operating configuration — professional gate
- [ ] Production eSign/DSC provider — external credential/provider gate

### Corporate administration
- [x] Vendor Registry
- [x] Contract Registry
- [x] Employee Registry
- [x] Asset Registry
- [x] Compliance Registry
- [x] Government/authority Notice Case registry
- [x] Integration Registry that rejects raw secrets and stores secret references only
- [x] Command Center derived from canonical database records, with no fabricated bank/cash numbers

### Document / evidence control
- [x] Private document vault
- [x] MIME allowlist + upload-size limit
- [x] SHA-256 per stored version
- [x] Version records and lock/immutability workflow
- [x] Locked-document replacement protection
- [x] Download audit record
- [x] Controlled inspection-pack generator and read-only evidence-pack ZIP tooling
- [x] Inspection Case / scope model and hash-based manifest
- [x] Read-only Google Drive metadata adapter
- [x] Drive evidence readiness by controlled Office taxonomy (`AVAILABLE` / `EMPTY` / `MISSING_FOLDER`)
- [x] Metadata warning for obvious ownership evidence filed under customer contracts
- [ ] Controlled corporate documents in source control — intentionally prohibited
- [ ] Malware scanning service — production infrastructure gate

### Application security / HTTP controls
- [x] CSP and browser security headers
- [x] Trusted-host option
- [x] Browser Origin guard for mutation calls
- [x] Baseline per-process mutation rate limiter with 429/Retry-After behavior
- [x] Production OIDC AAL2 gate with cookie-to-verified-bearer bridge
- [x] Secret scanning in CI
- [x] Blocking high/critical npm dependency audit in CI
- [x] Next.js patched to 16.3.5; verified CI install reports zero npm vulnerabilities
- [x] Python test suite configured to fail on unexpected warnings; only the specifically identified upstream Starlette/AnyIO deprecation is suppressed
- [ ] Shared edge/WAF rate limiting for horizontally scaled production — deployment gate
- [ ] Final staging penetration/security acceptance — production gate

### Event/workflow architecture
- [x] Transactional event outbox model
- [x] Finance, billing, governance, notice, inspection, bank and contract domain events
- [x] Workflow run registry
- [x] Formal workflow JSON specifications for payment, vendor invoice, GST close, governance authority and inspection packs
- [ ] Production queue/broker/background-worker infrastructure — deployment gate

### API contract / source integration
- [x] Committed OpenAPI contract
- [x] Reproducible OpenAPI exporter sourced from canonical `backend.app`
- [x] Identity/MFA endpoints represented in the committed OpenAPI contract and checked for drift in CI
- [x] Read-only Google Drive evidence discovery/readiness boundary
- [ ] Production Drive service identity/root-folder authorization — external configuration
- [ ] Authoritative Company Master/governance/finance evidence population — operator-controlled private data activity

## Verified automated validation

The current identity-enabled `main` quality run verified:

- [x] blocking `npm audit --audit-level=high`: **0 vulnerabilities**
- [x] secret scan
- [x] ESLint
- [x] TypeScript typecheck
- [x] root Vitest suite: **58 tests passed across 17 files**
- [x] Next.js 16.3.5 production build
- [x] Python compilation
- [x] committed OpenAPI contract drift check including identity/MFA endpoints
- [x] clean Alembic migration chain through **v5 accounting/tax period close controls**
- [x] Office backend suite: **36 tests passed**
- [x] identity token non-disclosure / HttpOnly cookies / TOTP AAL2 / inactive-user / role-admission tests
- [x] period-close accounting and tax posting/reopen cases
- [x] CSP/origin/rate-limit security cases
- [x] Drive taxonomy/readiness cases
- [x] finance/ownership/provider/idempotency cases
- [x] RBAC, governance, audit-chain, document and migration controls
- [x] hardened Office quality gate: **PASS**

## External production gates intentionally not faked

The software build cannot legitimately manufacture these prerequisites:

- hosted Supabase Auth activation of asymmetric signing key/custom JWT hook and the first human MFA enrollment
- production managed PostgreSQL, restricted network controls and secret manager
- real verified KRAVIA Company Master/GST/ownership evidence and professional approvals
- live Razorpay/RazorpayX credentials, account eligibility and webhook secret
- live bank/accounting feed authorization
- production private object storage and malware scanner
- eSign/DSC provider credentials where required
- Google Drive service identity/folder authorization for runtime evidence discovery
- production queue/worker runtime
- shared edge/WAF rate limiting for multi-replica deployment
- monitoring/alerting/SLO/audit-retention stack
- backup/PITR configuration and restore drill
- final staging browser/accessibility/security assessment and CA/CS/legal sign-offs
- production DNS/TLS/environment-secret activation

## Release rule

**The committed Office software controls are development-complete for the audited scope only when the normal `main` quality workflow is green. Do not describe the live service as statutory/production-ready until every external production gate above has real evidence.**

KRAVIA Office must never report fake success, fake compliance, fake tax status, fake bank balances, fake ownership data or fake provider connectivity.
