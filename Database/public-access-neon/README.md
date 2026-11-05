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
