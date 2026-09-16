# Real corporate data migration

The Phase 5 migration schema provides `migration_batches` and `migration_staging_records`. It creates no records automatically.

## Required pipeline

1. Inventory source records and classify each item.
2. Create a batch with source evidence and owner.
3. Stage records; calculate file checksums where relevant.
4. Validate required metadata and flag duplicates without deleting them.
5. Review the preview with the appropriate owner/professional.
6. Approve and commit only verified records.
7. Reconcile expected vs imported record counts and sample document access.
8. Preserve committed batches and imported staging rows as immutable evidence.

Historical Board material must be marked as imported historical evidence, never as a workflow completed by Kravia Corporate Office.