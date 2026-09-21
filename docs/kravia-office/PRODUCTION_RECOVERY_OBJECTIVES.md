# KRAVIA Office production recovery objectives

Verified: 21 September 2026

## Recovery objectives

- **Database RPO:** no more than **24 hours** while the encrypted logical backup runs once per day at 02:00 Asia/Kolkata.
- **Operational RTO target:** no more than **4 hours** from declaration of a database-loss incident to restored KRAVIA Office service.
- **Measured technical restore:** the isolated PostgreSQL 17 restore drill on 21 September 2026 completed successfully in approximately **1 minute 55 seconds** from workflow start to completion. The 4-hour RTO deliberately includes incident confirmation, authorization, restore validation, application reconnection and production smoke testing; it is not a claim that every incident will recover in two minutes.

These are current operating objectives, not contractual customer SLAs.

## Database backup evidence

Production database: Supabase project `KRAVIA Office`, PostgreSQL 17.

The repository runs an encrypted logical backup every day. Each artifact contains separately exported roles, schema and data, an integrity manifest and backup metadata; the package is encrypted before upload. Plaintext SQL is not retained as an Actions artifact.

The successful proof run on 21 September 2026 was followed by an isolated restore drill that:

1. found and decrypted the latest successful encrypted backup;
2. verified backup integrity;
3. restored roles and KRAVIA-owned schema into an isolated PostgreSQL 17 environment;
4. restored compatible data;
5. checked every restored COPY-table row count;
6. verified KRAVIA critical control-plane objects; and
7. destroyed the isolated restore database and plaintext recovery files.

## Private object-storage boundary

The database dump does **not** contain Supabase Storage object bytes.

At verification time, the four production private buckets contained **zero persistent objects** after the controlled storage self-test cleaned up its test payload:

- `corporate-private`
- `office-documents`
- `office-candidate-documents`
- `office-quarantine`

Therefore no persistent KRAVIA business-file payload is presently outside the database backup.

**Gate:** before the first persistent production business document is retained in these buckets, KRAVIA must enable and prove an independent object-storage backup/export mechanism or a provider retention/restore capability suitable for the required RPO. If persistent object count becomes non-zero while no object backup is evidenced, recovery readiness is degraded and must be treated as an operational alert.

## Recovery declaration

A production recovery may be declared for destructive data loss, corruption, unavailable primary database, failed migration with unrecoverable data impact, or another event approved by the Founder/authorized incident lead.

Recovery operators must:

- preserve the affected production system where practical;
- identify the latest verified encrypted backup within the RPO;
- restore first into an isolated recovery environment;
- validate integrity and critical objects before any cutover;
- rotate compromised credentials where the incident involves secrets;
- reconnect API/worker services only after the restored database is accepted;
- execute the final production smoke checklist; and
- retain recovery evidence in the governed audit/evidence store.

## Emergency access

Database credentials, backup database URL and backup-encryption key remain separate protected secrets. Founder break-glass authentication is not a database backup mechanism and must not be used to bypass recovery controls.

## Review trigger

Recalculate RPO/RTO and rerun recovery acceptance whenever any of the following changes materially:

- backup cadence or retention;
- database provider/plan;
- schema or migration mechanism;
- private storage becomes persistent;
- production region/topology;
- authentication/key-management architecture; or
- restore workflow.
