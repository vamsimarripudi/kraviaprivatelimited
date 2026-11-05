# Dedicated KRAVIA public visitor database

**Do not confuse this project with KRAVIA Office or the isolated anonymous
website-privacy Neon database.**

Neon project: `kravia-public-access` · project ID `round-butterfly-88885202`
· PostgreSQL 17 · Singapore region · database `kravia_public_access`.

Apply the versioned schema migration to this project only. It contains
independent identities, one-time challenges, revocable sessions, optional
double-opt-in newsletter consent, resource files and download audit. There are
no public grants or browser/Data API credentials.

A server-only pooled Neon connection URL is required in Vercel under
`KRAVIA_PUBLIC_ACCESS_DATABASE_URL`. Do not store credentials in the repo,
CI logs, front-end variables, or documentation.

See `docs/kravia-public-access/IMPLEMENTATION.md` for workflows, security,
communication templates, production gates and content-approval policies.


## Database integration test

Apply migrations in ascending filename order. After the initial visitor-schema
migration, apply `202611050002_challenge_conflict_fix.sql`. It fixes a
PostgreSQL PL/pgSQL name-resolution conflict in the `complete_challenge`
email-verification function without touching any existing data or consent
history.

Run `tests/registration-smoke.sql` against a test PostgreSQL 17 database after
migrating. The test verifies wrong-code rejection, attempt counting, successful
account creation, opt-in pending state, opt-out default and replay rejection.
It uses synthetic `.test` addresses and rolls back every write. The GitHub
quality-gate job **Public account PostgreSQL integration** runs both migrations
and this test automatically against an isolated PostgreSQL 17 container.

An earlier SQL function had passed file-level CI but failed when executed in
PostgreSQL. A database-backed test is mandatory for future changes to
challenge completion or newsletter consent transitions.
