# KRAVIA Database

Database project assets live here so schema evolution is explicit and reviewable.

- `supabase/config.toml` — Supabase local/project configuration.
- `supabase/migrations/` — versioned SQL migrations for the Next.js/Supabase surface.

The Python Office backend currently retains its Alembic migrations with the backend package so application imports and deployment behavior remain stable during this repository-only refactor. Database-provider linkage, credentials and any migration-system consolidation are intentionally deferred until the database deployment discussion.

Never commit production credentials, generated local state or database dumps.
