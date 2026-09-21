# Go-live runbook

## Pre-cutover gates

- Repository quality gates green.
- Playwright Office-auth browser E2E green on the target release.
- Authenticator native build/security checks green.
- Backup and restore path verified.
- Production migrations rehearsed on staging.
- Real records staged, reviewed and approved.
- Canonical domain and TLS verified.
- First-party Office identity runtime configured.
- AAL2/TOTP, role boundaries, private Storage and signed URL expiry tested with controlled accounts.
- Production API and worker runtime identified and healthy.
- Required provider/professional evidence recorded.

## Cutover

1. Capture migration, deployment and configuration state.
2. Apply approved production migration(s).
3. Deploy the accepted `main` build to the approved production frontend.
4. Deploy/verify the accepted API and worker services.
5. Activate canonical domain and HTTPS.
6. Validate public routes, contact handling, Trust/legal pages and disclosure isolation.
7. Validate KRAVIA Office/Finance sign-in, KRAVIA Authenticator MFA, AAL2, role boundaries and private storage.
8. Validate worker heartbeat and one controlled quarantine scan.
9. Enable approved external integrations one at a time; retain fail-closed state for integrations without evidence.
10. Record deployed commit/deployment IDs and acceptance evidence.

Do not launch when a secret is exposed, private data is accessible, first-party Auth/RLS fails, HTTPS is incomplete, malware scanning is required but unavailable, or approved public facts are missing.
