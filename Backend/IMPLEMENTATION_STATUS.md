# KRAVIA Office — implementation status

Verified: **21 Sep 2026**

## Internal software status

**COMPLETE for the code-owned KRAVIA Office scope.**

The validated completion baseline before documentation-only closeout was:

- branch: `office/internal-completion-20260921`
- commit: `c2736b30da78780d8cc8dfd069803bd40f6145e3`
- GitHub Actions run: `35555188569`
- all four quality jobs: **PASS**

### Automated acceptance

- Frontend: **89 / 89 test files, 431 / 431 tests passed**
- Backend: **110 / 110 tests passed**
- ESLint: **PASS**
- TypeScript: **PASS**
- dependency audit: **0 vulnerabilities**
- secret scan: **PASS**
- Next.js production build: **PASS**
- OpenAPI drift check: **PASS**
- Alembic migration chain through **v14**: **PASS**
- hardened Office quality gate: **PASS**
- Railway API container build + liveness smoke: **PASS**
- background worker container build + one-shot smoke: **PASS**
- repository boundary checks: **PASS**
- database structure checks: **PASS**

## Identity and access — complete

KRAVIA Office uses its own first-party FastAPI/PostgreSQL identity authority.

Implemented and tested:

- Argon2id passwords;
- one-time protected Founder bootstrap;
- short-lived signed access JWTs;
- rotating refresh sessions stored as hashes;
- TOTP MFA and AAL2 enforcement;
- private single-use invitations;
- actual first-party session inventory;
- revocation of secondary sessions;
- trusted-device binding;
- first-party device audit events;
- AAL2 self-service password change;
- administrator-issued short-lived single-use recovery links;
- separate Founder break-glass recovery using `OFFICE_AUTH_BREAK_GLASS_SECRET`;
- recovery revokes sessions and Founder break-glass also resets MFA;
- Finance and Office both gate on `OFFICE_API_ORIGIN`;
- active server modules no longer depend on Supabase Auth administration;
- active security/readiness/intelligence/workforce views use `office_auth_sessions_v2`, not the retired tracking ledger.

Live evidence already observed:

- Founder identity ACTIVE;
- MFA verified;
- successful first-party login, refresh and MFA events;
- active first-party sessions;
- live PostgreSQL/Alembic revision v14.

## Authorization/security — complete

- deny-by-default role/capability model;
- high-risk actions require server-side permission checks;
- same-origin mutation protection across browser-facing Office routes;
- repository-wide mutation-security regression matrix;
- cross-user session IDOR rejection;
- cross-user trusted-device rejection;
- company-managed/trusted-device enforcement where required;
- shared database-backed mutation rate limiting;
- CSP/security headers and fixed-origin runtime gateway;
- privileged provider callback/webhook paths are not exposed through the generic browser runtime proxy.

## Data/control plane — complete

- Supabase/PostgreSQL is the trusted database/control plane, not the active Office password/session provider;
- protected Office tables are RLS-enabled and browser roles remain denied;
- least-privilege `kravia_office_backend` execution role;
- live read-only backend policy for trusted-device identity validation;
- canonical FastAPI API behind the same-origin Next.js BFF/runtime gateway.

## Documents/storage — complete internally

Live private Supabase buckets:

- `corporate-private`
- `office-documents`
- `office-candidate-documents`
- `office-quarantine`

All are private.

Implemented:

- versioned document templates and clauses;
- immutable document input snapshots;
- PDF/DOCX/HTML/XLSX rendering;
- SHA-256 integrity verification;
- version-controlled signed `kravia-storage-broker` Edge Function;
- quarantine-before-release;
- ClamAV scan queue and retry model;
- short-lived private downloads;
- controlled signed-PDF evidence;
- signed PDFs enter quarantine first;
- document becomes `SIGNED` only after CLEAN malware-scan finalization;
- signature-evidence ledger;
- controlled delivery ledger;
- signed deliveries bind to the latest verified signature evidence.

External eSign/DSC automation is therefore an adapter/configuration step, not a missing core workflow. Signed PDF evidence can already be recorded manually in the governed workflow.

## Finance/accounting/GST — complete internally

Implemented:

- integer-paise monetary model;
- immutable billing snapshots;
- invoices;
- payments/receipts/refunds;
- maker-checker workflow;
- Razorpay signature verification;
- RazorpayX execution boundary;
- accounting journals and trial balance;
- bank transaction/reconciliation model;
- accounting/tax period controls;
- ownership ledger;
- product tax profiles;
- IRIS IRP/e-Invoice adapter;
- IRIS VAS purchase-data adapter/reconciliation;
- GST return workings;
- Fynamics/FYN Gateway GSP taxpayer/session/filing evidence boundary.

Provider-dependent actions remain intentionally **fail-closed** until real provider credentials and acceptance are supplied.

## Runtime/operations — complete internally

- Railway FastAPI service architecture;
- dedicated Railway worker architecture;
- durable worker locking/heartbeat;
- outbox and automation processing;
- operational assurance/readiness screens;
- database restore-drill workflow;
- secret/dependency/OpenAPI quality gates;
- Vercel Git auto-deploy policy restricted to `main` to avoid repeated preview-function storage growth.

## Live database changes applied in this completion pass

The KRAVIA Office Supabase project now includes:

- first-party device-event backend read policy;
- versioned signed storage broker source in Git;
- document signature evidence table;
- signature/delivery state machine;
- signed-document quarantine context;
- signed delivery bound to verified signature evidence.

## External production gates — remaining work is external-only

No major code-owned feature is intentionally left for the current Office scope.

The remaining activation items require credentials, provider accounts, professional review, infrastructure access or independent acceptance:

1. canonical Vercel `kravia1` team/project access and production environment read-back;
2. merge/deploy this internally accepted release to production;
3. production `OFFICE_AUTH_BREAK_GLASS_SECRET` generation/storage and controlled drill;
4. production ClamAV service + EICAR acceptance;
5. IRIS IRP credentials/sandbox acceptance;
6. IRIS VAS credentials/consent acceptance;
7. Fynamics/FYN Gateway GSP credentials, taxpayer OTP/session and filing-contract acceptance;
8. Razorpay/RazorpayX live eligibility and credentials;
9. bank/accounting feed authorization;
10. Google Drive service identity/root-folder authorization;
11. Protean/eSign/DSC provider automation;
12. external telemetry/SLO and durable audit archive sink;
13. provider edge/WAF controls;
14. independent staging browser/accessibility/penetration/IDOR acceptance;
15. authoritative Company Master/GST/ownership/banking evidence;
16. applicable CA/CS/auditor/legal approvals.

## Release rule

**Internal software completion = green repository gates.**

**Production/statutory readiness = internal completion + applicable external evidence.**

KRAVIA Office must never fabricate provider, legal, tax, bank, signature or compliance success when the external evidence is absent.
