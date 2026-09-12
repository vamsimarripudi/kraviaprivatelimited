# Implementation Status — KRAVIA Office v2.0

## Final build state in this handover

KRAVIA Office is now a **runnable multi-product corporate operating-system foundation with an executable API/database core**, not a static dashboard mockup. It is deliberately production-gated where real credentials, statutory evidence, professional approvals or external infrastructure are required.

### Enterprise operating surface
- [x] Enterprise application shell with company-first navigation
- [x] Multi-product Product Registry (VidyaLuma, Vaanmeet, VFormix + future products)
- [x] Company Master / customer / commercial / billing / tax / accounting / governance / compliance / contracts / vendors / people / assets / documents / audit / inspection modules
- [x] Command palette/global search foundation
- [x] Responsive administration UX
- [x] Sandboxed iframe/PDF document preview pattern
- [x] Honest unavailable/setup-required states instead of fabricated metrics

### Identity and authorization
- [x] Server-side RBAC with OWNER, DIRECTOR, FINANCE, CA, CS, LEGAL, HR, OPERATIONS, AUDITOR and PRODUCT_ADMIN roles
- [x] Development bootstrap authentication
- [x] Production OIDC/JWT architecture
- [x] Production startup hard-block if OIDC issuer/audience/JWKS are not configured
- [x] Role-guarded governance, finance, HR, document and banking endpoints
- [x] Maker-checker approval primitive preventing requester self-approval
- [ ] Real production IdP tenant + MFA policy — external configuration required

### Commercial platform
- [x] Product catalog foundation
- [x] Versionable commercial plan records
- [x] Subscription records and cancellation-at-period-end workflow
- [x] Canonical customer master shared across products
- [x] Product-aware billing and accounting dimensions

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
- [ ] CA-approved production GST catalog, SAC mappings and actual GSTIN lock — professional/evidence gate
- [ ] Razorpay/live provider credentials + signed webhooks — external credential gate

### Accounting / reconciliation
- [x] Chart of accounts foundation
- [x] Double-entry operational journal
- [x] Invoice postings
- [x] Payment postings
- [x] Credit-note reversal postings
- [x] Refund postings
- [x] Trial balance with balancing verification
- [x] Bank-account registry storing masked account references only
- [x] Bank-transaction import model
- [x] Auto-match of compatible bank credits to customer payments
- [x] Reconciliation exception state when deterministic match is unavailable
- [ ] Approved statutory accounting policy/chart mapping and final accounting-system integration — CA/company policy gate
- [ ] Live bank feed — bank/provider authorization gate

### Governance
- [x] Board Meeting registry
- [x] Resolution registry with SHA-256 locked content hash
- [x] CTC PDF generation
- [x] Authority Grant derived from the approved resolution authority scope
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
- [x] Integration Registry that explicitly rejects raw secrets and stores secret references only
- [x] Command Center derived from canonical database records, with no fabricated bank/cash numbers

### Document / evidence control
- [x] Private document vault
- [x] MIME allowlist + upload-size limit
- [x] SHA-256 per stored version
- [x] Version records
- [x] Lock/immutability workflow
- [x] Locked-document replacement protection
- [x] Download audit record
- [x] Controlled local inspection-pack generator
- [x] Inspection Case / scope model
- [x] Inspection manifest with hashes and readiness warnings
- [x] Read-only evidence-pack ZIP tooling
- [x] Private-document workflow and local vault architecture
- [ ] Controlled corporate documents committed to source control — intentionally prohibited
- [ ] Malware scanning service — production infrastructure gate

### Event/workflow architecture
- [x] Transactional event outbox model
- [x] Invoice, payment, receipt, credit-note, refund, subscription, governance, notice, inspection, bank and contract domain events
- [x] Workflow run registry
- [x] Formal workflow JSON specifications for payment, vendor invoice, GST close, governance authority and inspection packs
- [ ] Production queue/broker/background-worker infrastructure — deployment gate

### Controlled-source integration boundary
- [ ] Corporate evidence and communication ingestion — requires separately authorized runtime integration and retention configuration
- [ ] Company-master, governance and finance evidence link-up — operator-controlled, private deployment activity

## Validation complete in this package
- [x] 13 automated backend/control tests passing
- [x] JavaScript syntax checks
- [x] Python compilation
- [x] Alembic initial migration + v2 migration generated
- [x] Clean database migration upgrade verified
- [x] Controlled invoice sequence tests
- [x] Tax tests
- [x] Payment/idempotency tests
- [x] Credit-note/refund/accounting tests
- [x] Banking auto-match test
- [x] Governance authority-chain test
- [x] Document immutability test
- [x] RBAC test
- [x] Maker-checker test
- [x] Notice/inspection manifest test
- [x] Secret-registry rejection test
- [x] Quality-gate script

## External production gates intentionally not faked

The software build cannot legitimately manufacture these prerequisites:

- real OIDC identity-provider tenant and MFA policy
- production managed PostgreSQL and network controls
- production secret manager
- real KRAVIA GSTIN/current registration evidence and CA-approved tax catalog
- live Razorpay credentials / webhook secrets
- live bank API/feed or approved statement ingestion
- approved statutory accounting mappings
- CS-reviewed governance configuration
- eSign/DSC credentials
- production Drive/Gmail service authorization for the application runtime
- malware-scanning infrastructure
- production queue/worker runtime
- monitoring/alerting/SLO stack
- production backup/PITR and restore drill
- dedicated KRAVIA Office repository/project and DNS mapping
- final staging security assessment and professional sign-offs

## Release rule

**The codebase is a completed development handover for the agreed KRAVIA Office foundation. Do not describe the live service as statutory/production-ready until every external production gate above has real evidence.**

That distinction is intentional: KRAVIA Office must never report fake success, fake compliance, fake tax status, fake bank balances or fake provider connectivity.
