# Deployment Discovery — refreshed 16 Sep 2026

## GitHub

KRAVIA Office is now actively maintained inside the accessible canonical company repository:

`vamsimarripudi/kraviaprivatelimited/office`

`main` is the working integration branch used by the current quality workflow. The earlier discovery note stating that no repository was accessible is obsolete and must not be used for planning.

**Decision:** retain Office as a bounded subsystem inside this repository; do not create a disconnected second Office codebase solely for deployment.

## CI

The repository quality workflow now validates both the root corporate site and Office subsystem, including:

- blocking high/critical npm dependency audit;
- secret scan, lint, typecheck, root tests and Next production build;
- Office Python dependency install/compile;
- committed OpenAPI drift check;
- clean Alembic upgrade through the current head;
- Office backend tests;
- Office quality gate.

## Runtime

The canonical Office application is `backend.app:app`. It serves the server-side API/control plane and the same-origin `office/web` surface. A static-only Office deployment would omit required server-side controls and is therefore not the production architecture.

## Vercel / application hosting

Prior discovery found KRAVIA-adjacent/product deployments but no approved Office production deployment. Do not attach Office to an unrelated product project. The final hosting target can be a dedicated Office application/project/environment while still building from this repository's `office/` path.

Hosting remains an external activation decision because production identity, database, secrets, private storage, monitoring and security gates must be provisioned together.

## Domain

Target remains:

`office.kraviaprivatelimited.com`

DNS/TLS is intentionally not cut over by the development build. It should be mapped only after the production application environment and required security/evidence gates pass.
