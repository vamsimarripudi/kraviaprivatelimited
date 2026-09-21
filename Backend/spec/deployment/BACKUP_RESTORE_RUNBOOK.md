# KRAVIA Office Database Backup & Restore Runbook

## Current backup posture

The KRAVIA Office Supabase organization is currently on the Free plan. Supabase retained daily backups and Point-in-Time Recovery are therefore not relied on for production recovery.

Until a paid backup tier is approved, KRAVIA uses an encrypted logical backup workflow in GitHub Actions.

## Backup source

- Supabase project: KRAVIA Office
- Database: PostgreSQL 17
- Recommended connection for GitHub-hosted runners: Supabase **Session Pooler** connection on port 5432
- Do not use a browser/Data API key for backups.

The workflow uses the Supabase CLI because it applies Supabase-specific dump filtering and produces separate roles, schema, and data SQL files suitable for recovery.

## Required GitHub configuration

Repository Settings → Secrets and variables → Actions.

Secrets:

- `KRAVIA_BACKUP_DATABASE_URL`
  - Use the complete Supabase Session Pooler database connection string.
  - Treat it as a password-bearing production credential.
- `KRAVIA_DB_BACKUP_KEY`
  - Strong independent backup-encryption secret.
  - Never reuse the Office signing or Founder bootstrap secrets.

The production backup schedule is enabled directly in the workflow and does not depend on a repository variable. Missing secrets fail the run closed rather than silently skipping the backup.

## Schedule

The committed schedule is daily at **02:00 Asia/Kolkata** (20:30 UTC on the previous date).

Manual `workflow_dispatch` is always available for validation and restore-drill preparation. A change to the backup workflow on `main` also triggers an immediate proof run.

## Backup contents

Each run exports:

1. `roles.sql`
2. `schema.sql`
3. `data.sql`
4. `SHA256SUMS`
5. `BACKUP_METADATA`

The files are packaged and encrypted with GnuPG AES-256 before upload. Only the encrypted `.gpg` payload is uploaded as a GitHub Actions artifact.

Artifact retention: **14 days**.

## Security rules

- Never upload plaintext SQL as an artifact.
- Never print either backup secret.
- Never reuse `OFFICE_AUTH_SIGNING_SECRET` or `OFFICE_AUTH_BOOTSTRAP_SECRET` for backup encryption.
- Keep the database URL and encryption key in GitHub Actions Secrets only.
- The encrypted artifact is not a replacement for a future paid off-site/PITR strategy.
- Storage objects are not covered by a database dump; private object-storage backup must be handled separately when that service is activated.

## Manual validation

After secrets are configured:

1. Open GitHub → Actions → **Encrypted KRAVIA database backup**.
2. Run workflow manually.
3. Confirm all three dump stages pass.
4. Download the encrypted artifact.
5. Keep the encryption key out of the downloaded directory.
6. Perform a restore drill against an isolated test database before relying on the backup.

## Decrypt locally

Do not paste the encryption key into shell history. Prefer an environment variable or password-manager integration.

Example:

```bash
gpg --batch --pinentry-mode loopback \
  --passphrase "$KRAVIA_DB_BACKUP_KEY" \
  --output kravia-office-backup.tar.gz \
  --decrypt kravia-office-backup.tar.gz.gpg

tar -xzf kravia-office-backup.tar.gz
sha256sum -c SHA256SUMS
```

## Restore order

Restore into an isolated test Supabase/PostgreSQL project first.

```bash
psql --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file roles.sql \
  --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql \
  --dbname "$RESTORE_DATABASE_URL"
```

After restore, verify:

- expected public tables exist;
- first-party Office identity tables exist;
- key row counts match;
- required extensions exist;
- application migrations align with source;
- authentication signing/bootstrap secrets are configured separately;
- application health/readiness passes.

## Paid-tier upgrade path

When budget permits, enable Supabase retained backups/PITR and keep logical encrypted exports as defense in depth. PITR should not replace independent restore drills.
