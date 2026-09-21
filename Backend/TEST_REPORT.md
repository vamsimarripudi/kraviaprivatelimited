# KRAVIA Office — final internal test report

Verified: **21 Sep 2026**

## Accepted software baseline

Validated completion commit before documentation-only closeout:

`c2736b30da78780d8cc8dfd069803bd40f6145e3`

GitHub Actions run:

`35555188569`

Result: **SUCCESS**

## Frontend

- Test files: **89 / 89 passed**
- Tests: **431 / 431 passed**
- ESLint: **PASS**
- TypeScript typecheck: **PASS**
- Next.js production build: **PASS**
- dependency audit: **0 vulnerabilities**
- repository secret scan: **PASS**

The production build includes the public site, `/office`, `/finance`, first-party auth BFF routes, recovery routes, Office runtime gateway and document workflows.

## Backend

- Pytest: **110 / 110 passed**
- Python compile: **PASS**
- package/dependency check: **PASS**
- OpenAPI drift: **PASS**
- Alembic clean upgrade through **v14**: **PASS**
- hardened Office quality gate: **PASS**
- Railway API container build: **PASS**
- PostgreSQL driver packaging check: **PASS**
- packaged liveness smoke: **PASS**
- worker container build: **PASS**
- worker one-shot smoke: **PASS**

## Database/repository

- database structure workflow: **PASS**
- repository/application-boundary workflow: **PASS**
- live Supabase migrations for the completion controls applied successfully
- checked Office storage buckets remain private

## Security coverage added during completion

The accepted suites now cover:

- first-party session inventory;
- user-scoped session revocation;
- cross-user session IDOR rejection;
- trusted-device ownership/AAL2 enforcement;
- first-party device-event recording;
- service-layer device actor revalidation;
- no active Supabase Auth admin dependency;
- no active reads from retired auth-session/event ledgers;
- repository-wide same-origin mutation matrix;
- first-party security/intelligence/workforce session models;
- AAL2 password change;
- other-session revocation on password rotation;
- administrator single-use recovery links;
- recovery-token invalidation by password version;
- protected OWNER recovery boundary;
- Founder break-glass recovery;
- session revocation + MFA reset during Founder break-glass;
- private storage-broker signature contract;
- file quarantine and malware-scan finalization;
- signed-document evidence only after CLEAN scan;
- signed-PDF SHA-256 integrity;
- document signature evidence state machine;
- document delivery state machine;
- signed delivery bound to verified signature evidence;
- v11 product-tax-profile migration;
- v12 IRIS IRP migration;
- v13 GST purchase reconciliation migration;
- v14 Fynamics GSP filing migration.

## What this report proves

This report proves the committed **code-owned** KRAVIA Office controls pass their automated acceptance gates.

It does not claim that missing third-party credentials, bank/provider approvals, statutory evidence, CA/CS/legal review, independent penetration testing or external SLO measurements already exist.

Those are the final external activation phase.
