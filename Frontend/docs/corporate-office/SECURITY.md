# Security

Fail closed when Supabase identity configuration is absent. The browser never receives a service-role key. RLS is enabled on every new Phase 3 table, and unspecified tables remain deny-by-default until a narrowly reviewed policy is added.

Before release: configure MFA, test AAL1/AAL2, configure allowed redirect URLs, review PostgreSQL grants, test storage signed-url expiry, deploy CSP/headers, install malware scanning appropriate to the upload path, set rate limits, configure error monitoring and test real incident/offboarding procedures.
