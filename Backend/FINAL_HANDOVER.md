# KRAVIA Office — final internal handover

Verified: **21 Sep 2026**

## Executive state

The **code-owned KRAVIA Office product scope is internally complete**.

Validated completion baseline:

- branch: `office/internal-completion-20260921`
- validated baseline before the current E2E closeout: `00d16e1aaa8561683726f6d962efea751546c2ff`
- GitHub Actions run: `35569335468`
- result: **SUCCESS**
- frontend: **90 / 90 files, 435 / 435 tests**
- backend: **114 / 114 tests**
- production Next.js build: **PASS**
- OpenAPI: **PASS**
- Alembic through v15: **PASS**
- API container/liveness: **PASS**
- worker container/smoke: **PASS**

No major internal feature is deliberately being deferred to a future coding phase for the current Office scope.

## Canonical architecture

### Browser/UI
`www.kraviaprivatelimited.com`

- `/office` — internal business workspace
- `/finance` — Finance/CA/Auditor workspace
- same-origin Office auth BFF
- same-origin Office runtime gateway

### Application runtime
Railway FastAPI:

- first-party identity;
- business APIs;
- finance/accounting/GST;
- document renderer;
- private file quarantine API;
- provider adapters.

Railway worker:

- durable worker lock/heartbeat;
- outbox;
- automation;
- private-file malware scan;
- CLEAN signed-document workflow finalization.

### Data/control plane
Supabase/PostgreSQL:

- Office business/control tables;
- first-party auth persistence;
- private Storage buckets;
- signed `kravia-storage-broker` Edge Function;
- RLS/browser denial boundaries.

Supabase Auth is **not** the active Office password/session authority.

## Identity final state

Implemented:

- Founder bootstrap;
- Argon2id credentials;
- JWT access tokens;
- rotating refresh tokens;
- TOTP AAL2;
- private invitations;
- role/department identity;
- first-party sessions;
- secondary-session revocation;
- trusted devices;
- password change;
- administrator recovery links;
- Founder break-glass recovery;
- MFA reset;
- access reviews;
- suspension/reactivation/offboarding controls.

Recovery does not require email/SMS. An authorised administrator can create a private short-lived single-use recovery link. Founder recovery uses a separate high-entropy break-glass secret and resets both sessions and MFA.

## Document/evidence final state

Implemented:

- reusable versioned document templates;
- versioned clauses;
- immutable input snapshots;
- approval workflow;
- PDF/DOCX/HTML/XLSX rendering;
- private storage;
- SHA-256 verification;
- signed-PDF evidence;
- malware quarantine before signed-state finalization;
- signature-evidence ledger;
- delivery-evidence ledger;
- signed deliveries bound to verified signature evidence.

This means Protean/eSign/DSC automation is now an external adapter step. KRAVIA Office can already complete the governed lifecycle using a real signed PDF artifact without pretending a provider acted.

## Finance/GST final internal state

Implemented:

- billing/invoice domain;
- payments/receipts/refunds;
- double-entry accounting;
- trial balance;
- bank transaction/reconciliation model;
- maker-checker;
- period locking/reopen;
- ownership ledger;
- GST tax profiles;
- e-Invoice/IRP adapter;
- purchase-data/VAS reconciliation;
- GST return workings;
- GSP filing evidence boundary.

Real filing/payment execution remains disabled until the applicable provider is accepted.

## Storage/file-security final state

Live private buckets:

- `corporate-private`
- `office-candidate-documents`
- `office-documents`
- `office-quarantine`

Inbound files are fail-closed:

1. validate size/type/name;
2. write to private quarantine;
3. worker scans via ClamAV;
4. reject infected files;
5. promote CLEAN objects;
6. finalize any bound business workflow only after CLEAN status.

Signed documents follow this same path.

## What must be done today outside code

These are the only actions that still block full external/production acceptance.

### P0 — do today before calling the release production-ready

1. **Vercel**
   - create/reconnect the canonical KRAVIA Vercel production project; the connected Vercel workspace audited on 21 Sep 2026 did not expose a `kraviaprivatelimited` project;
   - ensure old preview deployments are cleaned enough to remove the Functions Storage block;
   - confirm `kraviaprivatelimited` production project points to the correct repository/root;
   - verify `OFFICE_API_ORIGIN` and Office server-only variables;
   - confirm the post-merge production deployment reaches green.

2. **Railway**
   - verify the approved production API + worker services track the accepted `main`; the connected Railway workspace audited on 21 Sep 2026 did not expose a KRAVIA Office project;
   - inspect the currently staged Railway production change before accepting it;
   - confirm API and worker secret sets are consistent where required.

3. **Identity secrets**
   - generate/store a strong production `OFFICE_AUTH_BREAK_GLASS_SECRET` separately from signing/bootstrap secrets;
   - retain it offline/private;
   - do one controlled staging drill and destroy any recovery token produced by the drill.

4. **ClamAV**
   - provide a production/private ClamAV service;
   - configure `CLAMAV_HOST` / `CLAMAV_PORT`;
   - run an EICAR clean/infected acceptance test through Office quarantine.

### P1 — external integrations; can be enabled one by one

5. IRIS IRP sandbox credentials and e-Invoice acceptance.
6. IRIS VAS credentials + taxpayer/user consent.
7. Fynamics/FYN Gateway GSP credentials + taxpayer OTP/session + final filing contract acceptance.
8. Razorpay/RazorpayX live credentials/eligibility.
9. bank/accounting feed authorization.
10. Google Drive service identity/root folder.
11. Protean/eSign/DSC provider automation.
12. external monitoring/SLO and durable audit archive.
13. provider edge/WAF controls.

### P2 — professional/statutory acceptance

14. authoritative Company Master evidence.
15. current GST evidence.
16. cap-table/share-register/share-certificate reconciliation.
17. CA approval for GST/tax/accounting mappings and close procedure.
18. CS approval for governance/register/ownership handling.
19. applicable legal/auditor review.
20. independent browser/accessibility/penetration/IDOR acceptance.

## Start-tomorrow rule

Tomorrow, work should start from the accepted `main` release and focus on **real operations**, not another architecture rewrite.

Recommended first-day operating sequence:

1. sign in as Founder with AAL2;
2. verify Security Settings sessions/devices;
3. verify worker heartbeat;
4. create one controlled document;
5. render PDF;
6. exercise quarantine with a safe file;
7. run one private recovery-link drill for a non-owner test identity;
8. verify finance/GST provider readiness screens remain fail-closed;
9. start connecting external providers in priority order;
10. retain evidence for every acceptance step.

## Non-negotiable release rule

Do not change a provider/statutory state to READY/FILLED/COMPLIANT merely because the internal software is complete.

Internal completion is proven by green software gates.

External readiness is proven only by actual provider, infrastructure, legal, tax, audit and professional evidence.
