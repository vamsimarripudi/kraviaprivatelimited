# Production environment

Verified: **21 Sep 2026**

## Current evidence

The repository is internally production-capable, but the approved KRAVIA production deployment remains an **external gate**.

Connected-provider audit on 21 Sep 2026:

- the connected Vercel workspace available to this audit did **not** expose a project named `kraviaprivatelimited`;
- the connected Railway workspace available to this audit did **not** expose a KRAVIA Office project.

Therefore this repository must not claim that the current `main` commit is deployed to the canonical production runtime until the actual production project/account is connected and read back.

This is deployment evidence, not a code-completion failure.

## Canonical runtime requirements

Frontend:

- approved Vercel (or formally selected replacement) production project;
- repository: `vamsimarripudi/kraviaprivatelimited`;
- branch: `main`;
- root directory: `Frontend`;
- Mumbai execution preference where supported;
- canonical domain and TLS verified.

Office API/worker:

- approved production runtime for the FastAPI API and background worker;
- current accepted `main` source;
- health/liveness verification;
- separate worker service/process;
- production PostgreSQL connectivity.

## Required production variables

Verify names and presence without storing secret values in Git:

- `OFFICE_API_ORIGIN`
- `OFFICE_AUTH_SIGNING_SECRET`
- `OFFICE_AUTH_BOOTSTRAP_SECRET` only while one-time bootstrap is intentionally open
- `OFFICE_AUTH_BREAK_GLASS_SECRET`
- `OFFICE_SUPABASE_URL`
- `OFFICE_SUPABASE_PUBLISHABLE_KEY`
- `OFFICE_SUPABASE_SECRET_KEY`
- database/runtime variables required by the backend
- storage-broker signing variables
- ClamAV configuration
- provider variables only for integrations actually approved for activation

Supabase/PostgreSQL is the data/control plane; **Supabase Auth is not the active Office password/session authority**.

## Required verification

1. Connect the real production provider/account.
2. Confirm project/service identity and source repository.
3. Confirm `main` is the production branch.
4. Verify server-only environment-variable names and scopes.
5. Confirm production/staging separation.
6. Apply reviewed migrations with a recovery path.
7. Verify canonical domain/TLS.
8. Execute Founder/role/AAL2 smoke tests.
9. Verify API and worker health.
10. Record the deployed commit SHA and provider deployment IDs as release evidence.

Do not mark production deployment READY from repository CI alone.
