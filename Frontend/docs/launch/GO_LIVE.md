# Go-live runbook

## Pre-cutover gates

- Backup and restore path verified.
- Production migrations rehearsed on staging.
- Real records staged, reviewed and approved.
- Domain, TLS, email, Supabase Auth URLs and monitored contacts verified.
- RLS, MFA, private Storage and signed URL expiry tested with controlled accounts.
- CI, build and security checks green.

## Cutover

1. Capture migration and configuration state.
2. Apply approved production migration(s).
3. Deploy the approved build.
4. Activate canonical domain and HTTPS.
5. Validate public routes, contact handling, Trust/legal pages and disclosure isolation.
6. Validate Corporate Office sign-in, MFA, role boundaries and storage access.
7. Enable approved automations deliberately; retain suppression for imported historical records.

Do not launch when a secret is exposed, private data is accessible, Auth/RLS fails, HTTPS is incomplete, or approved public facts are missing.