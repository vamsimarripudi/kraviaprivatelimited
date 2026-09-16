# KRAVIA PRIVATE LIMITED

KRAVIA is organized as a small monorepo with three explicit application boundaries:

- `Frontend/` — Next.js 16 / React 19 corporate platform and browser-facing route adapters.
- `Backend/` — Python/FastAPI KRAVIA Office services, finance/ownership logic, automation, security controls, tests, deployment assets and operational documentation.
- `Database/` — database-provider project files and versioned migrations. Provider changes are intentionally handled separately from application refactors.

Repository-control files such as `.github/`, `.gitignore`, `AGENTS.md` and this README remain at the root because Git and CI require them there.

## Frontend

```bash
cd Frontend
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run dev
```

The production build is expected to pass after lint, type-checking and tests. Do not suppress warnings to make CI green; remove actionable warnings at their source.

## Backend

```bash
cd Backend
python -m pip install -r backend/requirements.txt
python -m compileall -q backend
python -m pytest backend/tests -q
python scripts/quality_gate.py
```

The backend container entrypoint remains defined by `Backend/Dockerfile.api`. Deployment providers should use `Backend/` as their service root.

## Database

Supabase project assets are under `Database/supabase/`. Database credentials, production linkage and provider-specific deployment changes are not committed to this repository.

## Quality policy

Every merge to `main` must pass the GitHub quality gates for frontend, backend and repository structure. Secrets must never be committed. Environment examples contain names/placeholders only.
