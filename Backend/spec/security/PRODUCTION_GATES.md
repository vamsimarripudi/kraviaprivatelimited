# KRAVIA Office — production security gates

This document separates **software controls that are implemented and continuously testable** from **external deployment/provider/professional evidence** that must be supplied only during final activation.

## Implemented software controls

### Identity and access
- KRAVIA first-party FastAPI/PostgreSQL identity authority; Supabase Auth is not used by active Office login, invitation, MFA or recovery flows.
- Argon2id password hashing.
- Short-lived signed access JWTs.
- Rotating refresh tokens stored only as SHA-256 hashes.
- HttpOnly/SameSite=Strict browser cookies through the same-origin Next.js BFF.
- TOTP MFA with encrypted-at-rest factor secret and AAL2 enforcement.
- Failed-login lockout and auditable first-party authentication events.
- Actual first-party session inventory with user-scoped revocation; cross-user session IDOR is regression-tested.
- Private single-use invitation registration with no ordinary OWNER assignment.
- AAL2 current-password change that revokes other sessions.
- Administrator-issued short-lived single-use password recovery links, with delegated-role restrictions.
- Separate high-entropy Founder break-glass recovery that revokes Founder sessions and resets MFA.
- Trusted-device binding with hashed browser proof, company-managed approval, first-party device-event audit and no legacy session-ledger dependency.
- Server-side capability/permission enforcement and repository-wide mutation-security tests.
- Same-origin protection for browser-facing Office mutations; signed external webhook paths are the explicit exception.

### Data/control plane
- RLS-enabled protected Office tables.
- anon/authenticated browser roles denied direct access to checked identity/GST/control-plane tables.
- least-privilege `kravia_office_backend` PostgreSQL execution role.
- transaction-scoped role application in production runtime/migrations.
- no direct browser access to SQLAlchemy-owned business tables.

### Finance, accounting and tax
- integer-paise money model and immutable billing snapshots;
- maker-checker controls and idempotency;
- signed Razorpay webhook validation;
- controlled RazorpayX payout boundary;
- double-entry journal/trial balance;
- accounting/TAX period locks and approved reopen workflow;
- product tax profiles;
- IRIS IRP/e-Invoice adapter;
- IRIS VAS purchase-data/reconciliation adapter;
- GST return workings;
- Fynamics/FYN Gateway GSP filing/evidence boundary;
- provider-dependent execution remains fail-closed when configuration is absent.

### Documents and files
- versioned/hashed controlled documents;
- private Supabase Storage buckets;
- version-controlled signed `kravia-storage-broker` Edge Function;
- private quarantine;
- size/MIME/extension/SHA-256 verification;
- ClamAV streaming pipeline with retry/failure states;
- clean-object promotion only after malware scan;
- short-lived signed private downloads;
- browser roles do not receive unrestricted private-bucket access.

### Runtime and operations
- CSP and browser security headers;
- trusted-host and Origin guards;
- shared database-backed mutation rate limiting;
- durable worker with distributed locking, heartbeat and failure alerts;
- outbox/automation processing;
- operations summary that never fabricates SLO measurements;
- audit retention, legal holds and deterministic archive manifests;
- encrypted backup and isolated restore-drill workflows;
- secret scanning, blocking dependency audit, lint, typecheck, tests, build, migrations and OpenAPI drift in CI.

## Internal release gates

A candidate Office software release is internally acceptable only when all repository gates are green:

- frontend dependency audit and secret scan;
- ESLint and TypeScript;
- full frontend test suite;
- Next.js production build;
- Python compile;
- OpenAPI drift check;
- Alembic upgrade through current head;
- backend pytest;
- hardened Office quality gate;
- API-container liveness;
- background-worker one-shot smoke.

Any red gate blocks merge.

## External identity/deployment evidence — final phase

After internal software acceptance:

- configure production `OFFICE_AUTH_SIGNING_SECRET`;
- configure production `OFFICE_AUTH_BOOTSTRAP_SECRET`;
- configure a separate offline `OFFICE_AUTH_BREAK_GLASS_SECRET`;
- set `AUTH_MODE=first_party` and `OFFICE_REQUIRED_AAL=aal2`;
- verify canonical Vercel `OFFICE_API_ORIGIN`;
- verify canonical production domain/TLS;
- exercise a private non-owner invitation and recovery link in production-like staging;
- store the Founder break-glass secret offline and perform a controlled drill without retaining the returned token;
- complete external/browser all-role security acceptance.

## External infrastructure evidence — final phase

- production database networking restrictions;
- provider backup/PITR settings and restore evidence;
- production secret rotation procedure;
- ClamAV production service and EICAR acceptance test;
- external telemetry/SLO source;
- durable audit archive sink;
- provider edge/WAF defense in depth.

## External finance/GST/provider evidence — final phase

- CA-approved GSTIN/tax/SAC/invoice/accounting mapping;
- IRIS IRP sandbox then production acceptance;
- IRIS VAS taxpayer/user authorization;
- Fynamics/FYN Gateway GSP taxpayer OTP/session and final filing contract acceptance;
- Razorpay/RazorpayX eligibility and credentials;
- bank/accounting authorization;
- signed provider-webhook replay tests;
- eSign/DSC provider where required.

## Professional/statutory evidence — final phase

- authoritative Company Master and registered-office evidence;
- current GST evidence;
- reconciled cap table/share register/share certificates;
- CA approval of tax/accounting policy and close procedure;
- CS approval of governance/minutes/register/ownership handling;
- legal/management approval of retention, privacy and controlled funding/mandate language.

## Release rule

A green build proves the committed software controls. It does not fabricate provider approval, statutory status, bank connectivity, tax filing, legal review or external SLO attainment.

When external evidence is missing, KRAVIA Office must remain fail-closed or visibly unverified. Missing evidence must never be converted into fake success.
