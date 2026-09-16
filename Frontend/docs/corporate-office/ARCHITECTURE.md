# Corporate Office architecture

The public website and `/corporate` are separate surfaces. The private surface is excluded from sitemap/structured data, marked noindex, rendered dynamically and protected optimistically by `proxy.ts`. Proxy is not the authorization boundary: every server mutation checks the authenticated user, capability and required MFA assurance.

Supabase is the system of record: Auth for identity, PostgreSQL for metadata/workflows, private Storage for binaries and RLS for database enforcement. All schema is in versioned migrations. The configured default timezone is Asia/Kolkata for display; timestamps are retained as `timestamptz`.

No production environment, real corporate data or production storage bucket is configured in this repository.
