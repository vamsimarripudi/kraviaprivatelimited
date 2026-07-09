# KRAVIA Company OS Database Standards

## Purpose

This document defines the database engineering standard for KRAVIA Company OS.

Database: PostgreSQL

Migration tool: Flyway

## Migration Rules

- Every schema change must be a Flyway migration.
- Never edit an applied migration.
- Use clear migration names.
- Keep migrations deterministic.
- Add indexes and constraints in the same migration as the table or field where practical.
- Test migrations on a clean database before release.

## Naming Rules

Tables:

```text
snake_case plural nouns
```

Columns:

```text
snake_case
```

Indexes:

```text
idx_<table>_<column_or_purpose>
```

Foreign keys:

```text
fk_<table>_<referenced_table>
```

Unique constraints:

```text
uq_<table>_<column_or_purpose>
```

## Required Columns

Most business tables should include:

- `id`
- `created_at`
- `updated_at`
- `archived_at` where soft delete applies
- `created_by` where ownership or audit context matters
- `version` for optimistic locking

Current base entity includes `id`, `created_at`, and `updated_at`. Optimistic locking is not yet implemented.

## Soft Delete

Soft delete should be used for company records where history matters.

Recommended column:

```text
archived_at timestamptz
```

Archived records should be excluded from normal active lists unless explicitly requested.

## Optimistic Locking

Add optimistic locking for records that may be edited by multiple users:

- Company Profile
- Documents
- Board Meetings
- Financial Records
- Compliance Items
- Tasks
- Products
- Contacts
- Announcements

Recommended JPA field:

```java
@Version
private Long version;
```

## Indexing Standard

Index fields used for:

- Search
- Filtering
- Sorting
- Foreign key joins
- Due-date views
- Status dashboards
- Audit queries

The current migrations include many useful indexes for status, category, due date, title, and created date. Continue this pattern for every new module.

## Constraint Standard

Use constraints to protect data quality:

- `NOT NULL` for required fields
- `UNIQUE` for natural unique records
- foreign keys for relationships
- check constraints for simple numeric rules where useful

Example future checks:

- launch readiness between `0` and `100`
- non-negative file size
- page size limits enforced at API layer

## Referential Integrity

Use foreign keys when records have strong ownership.

Examples:

- meeting child rows reference board meetings
- document versions reference documents
- refresh tokens reference users
- AI context snapshots reference AI queries

Use `ON DELETE CASCADE` only when child records should never outlive the parent.

## Audit Data

Audit logs must remain append-oriented. Avoid deleting audit rows during normal operations.

Audit records should be searchable by:

- actor
- module
- action
- created date
- record ID

## Backup Readiness

Production database readiness requires:

- automated daily backups
- tested restore process
- backup encryption
- retention policy
- restore documentation
- restore drill evidence

## Current Database Health

Strengths:

- Flyway migrations exist.
- Core module tables exist.
- Most operational tables have timestamps.
- Many modules have indexes for status, category, date, and search fields.
- Foreign keys exist for child records.

Gaps:

- No Settings schema exists.
- Optimistic locking is not implemented.
- Some unique constraints and check constraints should be strengthened.
- Backup process is documented but not proven by restore tests.
