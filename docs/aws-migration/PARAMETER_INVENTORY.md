# KRAVIA Railway → AWS Parameter Store (names-only inventory)

> Inventory generated from connected Railway production service metadata. Values are redacted by Railway OAuth and are NOT copied. Proposed types and paths require Codex/operator review. Vercel variables are NOT verified.

- API variable names: **85**
- Worker variable names: **43**
- Unique names across both: **96**
- Candidate portable names after excluding Railway-generated names and PORT: **83**

Proposed mapping: shared → `/kravia/prod/shared/NAME`; api → `/kravia/prod/api/NAME`; worker → `/kravia/prod/worker/NAME`.

| Variable name | SSM scope | Proposed type | Review action |
|---|---|---|---|
| `APP_ENV` | shared | String | Review live requirement |
| `AUTH_MODE` | api | String | Review live requirement |
| `BREVO_API_KEY` | api | SecureString | Review live requirement |
| `BREVO_SENDER_EMAIL` | api | String | Review live requirement |
| `BREVO_SENDER_NAME` | api | String | Review live requirement |
| `CLAMAV_HOST` | shared | String | Update AWS target and verify |
| `CLAMAV_PORT` | shared | String | Review live requirement |
| `CLAMAV_SCAN_TIMEOUT_SECONDS` | shared | String | Review live requirement |
| `DATABASE_EXECUTION_ROLE` | shared | String | Review live requirement |
| `DATABASE_URL` | shared | SecureString | Review live requirement |
| `DOCUMENT_STORAGE_DIR` | api | String | Review live requirement |
| `FINANCE_EXECUTION_MODE` | shared | String | Reapprove fail-closed policy |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | api | String | Review live requirement |
| `GOOGLE_DRIVE_TIMEOUT_SECONDS` | api | String | Review live requirement |
| `GST_EINVOICE_ENABLED` | api | String | Reapprove fail-closed policy |
| `GST_GSP_BASE_URL` | api | String | Review live requirement |
| `GST_GSP_CLIENT_ID` | api | SecureString | Review live requirement |
| `GST_GSP_CLIENT_SECRET` | api | SecureString | Review live requirement |
| `GST_GSP_ENVIRONMENT` | api | String | Review live requirement |
| `GST_GSP_FILING_CONTRACT` | api | String | Review live requirement |
| `GST_GSP_IP_USR` | api | SecureString | Review live requirement |
| `GST_GSP_PROVIDER` | api | String | Review live requirement |
| `GST_GSP_STATE_CODE` | api | String | Review live requirement |
| `GST_GSP_TIMEOUT_SECONDS` | api | String | Review live requirement |
| `GST_GSP_USERNAME` | api | SecureString | Review live requirement |
| `GST_GSTR1_CURRENT_YEAR_TURNOVER` | api | String | Review live requirement |
| `GST_GSTR1_PREV_YEAR_TURNOVER` | api | String | Review live requirement |
| `KRAVIA_API_DEPLOYMENT_GENERATION` | api | String | Review live requirement |
| `KRAVIA_CIN` | api | String | Review live requirement |
| `KRAVIA_CLAMAV_SELF_TEST_ATTEMPTS` | worker | String | Review live requirement |
| `KRAVIA_CLAMAV_SELF_TEST_ON_STARTUP` | worker | String | Review live requirement |
| `KRAVIA_CLAMAV_SELF_TEST_RETRY_SECONDS` | worker | String | Review live requirement |
| `KRAVIA_DB_BACKUP_KEY` | api | SecureString | Review live requirement |
| `KRAVIA_FILE_PIPELINE_SELF_TEST_ATTEMPTS` | worker | String | Review live requirement |
| `KRAVIA_FILE_PIPELINE_SELF_TEST_ON_STARTUP` | worker | String | Review live requirement |
| `KRAVIA_FILE_PIPELINE_SELF_TEST_RETRY_SECONDS` | worker | String | Review live requirement |
| `KRAVIA_FILE_SCAN_BATCH_SIZE` | shared | String | Review live requirement |
| `KRAVIA_GSTIN` | api | String | Review live requirement |
| `KRAVIA_LEGAL_NAME` | api | String | Review live requirement |
| `KRAVIA_PLAY_REVIEWER_EMAIL` | api | String | Review live requirement |
| `KRAVIA_PLAY_REVIEWER_EXPIRES_AT` | api | String | Review live requirement |
| `KRAVIA_PLAY_REVIEWER_OTP` | api | SecureString | Review live requirement |
| `KRAVIA_PLAY_REVIEWER_PASSWORD` | api | SecureString | Review live requirement |
| `KRAVIA_PUBLIC_INTAKE_WEBHOOK_SECRET` | api | SecureString | Review live requirement |
| `KRAVIA_REGISTERED_OFFICE` | api | String | Review live requirement |
| `KRAVIA_STORAGE_BROKER_KEY_A` | shared | String | Review live requirement |
| `KRAVIA_STORAGE_BROKER_KEY_B` | shared | String | Review live requirement |
| `KRAVIA_STORAGE_BROKER_KEY_C` | shared | String | Review live requirement |
| `KRAVIA_STORAGE_BROKER_PRIVATE_KEY` | shared | SecureString | Review live requirement |
| `KRAVIA_STORAGE_BROKER_PRIVATE_KEY_B64` | shared | SecureString | Review live requirement |
| `KRAVIA_STORAGE_BROKER_TIMEOUT_SECONDS` | shared | String | Review live requirement |
| `KRAVIA_STORAGE_BROKER_URL` | shared | String | Review live requirement |
| `KRAVIA_STORAGE_DOWNLOAD_TIMEOUT_SECONDS` | shared | String | Review live requirement |
| `KRAVIA_WORKER_BATCH_SIZE` | worker | String | Review live requirement |
| `KRAVIA_WORKER_DEPLOYMENT_GENERATION` | worker | String | Review live requirement |
| `KRAVIA_WORKER_DEPLOY_GENERATION` | worker | String | Review live requirement |
| `KRAVIA_WORKER_INTERVAL_SECONDS` | worker | String | Review live requirement |
| `KRAVIA_WORKER_PROBE_GENERATION` | worker | String | Review live requirement |
| `MAX_UPLOAD_BYTES` | api | String | Review live requirement |
| `OFFICE_ALLOWED_HOSTS` | api | String | Update AWS target and verify |
| `OFFICE_ALLOWED_ORIGINS` | api | String | Update AWS target and verify |
| `OFFICE_AUTH_BOOTSTRAP_SECRET` | api | SecureString | Preserve/rotate under approved session plan |
| `OFFICE_AUTH_BREAK_GLASS_SECRET` | api | SecureString | Preserve/rotate under approved session plan |
| `OFFICE_AUTH_EMAIL_DOMAIN` | api | String | Review live requirement |
| `OFFICE_AUTH_SIGNING_SECRET` | api | SecureString | Preserve/rotate under approved session plan |
| `OFFICE_FILE_SCAN_MAX_BYTES` | api | String | Review live requirement |
| `OFFICE_FILE_SCAN_TIMEOUT_SECONDS` | api | String | Review live requirement |
| `OFFICE_MUTATION_RATE_LIMIT` | api | String | Review live requirement |
| `OFFICE_RATE_LIMIT_WINDOW_SECONDS` | api | String | Review live requirement |
| `OFFICE_REQUIRED_AAL` | api | String | Review live requirement |
| `OIDC_ACTOR_CLAIM` | api | String | Review live requirement |
| `OIDC_AUDIENCE` | api | String | Review live requirement |
| `OIDC_ISSUER` | api | String | Review live requirement |
| `OIDC_JWKS_URL` | api | String | Review live requirement |
| `OIDC_REQUIRED_AAL` | api | String | Review live requirement |
| `OIDC_ROLE_CLAIM` | api | String | Review live requirement |
| `PORT` | api | Exclude / replace | Provider-generated/not portable |
| `PUBLIC_BASE_URL` | api | String | Update AWS target and verify |
| `RAILWAY_DOCKERFILE_PATH` | shared | Exclude / replace | Provider-generated/not portable |
| `RAILWAY_ENVIRONMENT` | shared | Exclude / replace | Provider-generated/not portable |
| `RAILWAY_ENVIRONMENT_ID` | shared | Exclude / replace | Provider-generated/not portable |
| `RAILWAY_ENVIRONMENT_NAME` | shared | Exclude / replace | Provider-generated/not portable |
| `RAILWAY_PRIVATE_DOMAIN` | shared | Exclude / replace | Provider-generated/not portable |
| `RAILWAY_PROJECT_ID` | shared | Exclude / replace | Provider-generated/not portable |
| `RAILWAY_PROJECT_NAME` | shared | Exclude / replace | Provider-generated/not portable |
| `RAILWAY_PUBLIC_DOMAIN` | api | Exclude / replace | Provider-generated/not portable |
| `RAILWAY_SERVICE_ID` | shared | Exclude / replace | Provider-generated/not portable |
| `RAILWAY_SERVICE_KRAVIA_OFFICE_API_URL` | shared | Exclude / replace | Provider-generated/not portable |
| `RAILWAY_SERVICE_NAME` | shared | Exclude / replace | Provider-generated/not portable |
| `RAILWAY_STATIC_URL` | api | Exclude / replace | Provider-generated/not portable |
| `SUPABASE_AUTH_URL` | shared | String | Review live requirement |
| `SUPABASE_POOLER_HOST` | shared | String | Review live requirement |
| `SUPABASE_POOLER_PORT` | shared | String | Review live requirement |
| `SUPABASE_POOLER_USER` | shared | SecureString | Review live requirement |
| `SUPABASE_PUBLISHABLE_KEY` | shared | String | Review live requirement |
| `TAX_CONFIG_APPROVED` | shared | String | Reapprove fail-closed policy |

## Review gates

- This table is an inventory, not proof of complete/current running secret values. Check each against real runtime consumers and keep the documented fail-closed mode.
- Do not copy Railway platform metadata or transient deployment generation variables unless required by code.
- SSM Standard 4-KB value cap; review private keys and service-account data for single-line/base64 adapter, secure file mounting or Secrets Manager.
- Keep `OFFICE_API_ORIGIN` and required BFF secrets in Vercel until frontend migration; the connected Vercel project is not accessible from this account.
- Never publish AWS parameter values, Railway secret values, or decrypted output as a pull-request comment.
- Check the actual `CLAMAV_HOST` is `clamav` within EC2 Compose, and the API's allowed hosts/origins match the new HTTPS endpoint.
- A worker profile may require Brevo credentials if it owns mail dispatch. Avoid duplicate mail execution; do not infer required credentials solely from current Railway variable names.
