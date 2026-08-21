# Publishing

Lifecycle: `DRAFT → IN_REVIEW → CHANGES_REQUESTED → APPROVED → SCHEDULED → PUBLISHED → ARCHIVED`.

Only authorised publishers can approve, schedule, publish or archive. Publish-time validation requires an approved content review plus required legal/corporate/product reviews by content type. Scheduling uses Asia/Kolkata operational convention and only publishes an already approved record. Archive removes public visibility but preserves history.

## Revision safety

Apply `supabase/migrations/202608210003_governed_publication_snapshots.sql` before using the revision controls in `/admin/newsroom`.

A published page is served from its immutable approved public snapshot. Starting a revision changes only the private working record; visitors continue to receive the last approved snapshot while editors revise, reviewers assess the change, and a publisher releases the replacement. The migration backfills existing published records, stores new versions append-only, and makes revision, publication, and archive transitions atomic.

Operational sequence:

1. An editor starts a private revision from the publication queue.
2. The editor updates the record, explains what changed, and classifies materiality.
3. The normal review and approval workflow runs for the new version.
4. An authorised publisher releases the approved revision; the public snapshot is replaced atomically.
5. An archive request withdraws the public snapshot and retains private history and audit events.

Do not bypass these actions with direct table updates. They are designed to preserve public/private separation, version history, RLS, audit continuity, and a reliable rollback trail.