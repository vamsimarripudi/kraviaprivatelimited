# Release Management Guide

## Purpose

Release management records provide traceability for KRAVIA Company OS changes.

## Release Record Fields

Each release should include:

- version
- release name
- release date
- modules included
- breaking changes
- database migration version
- rollback status

## Release Rules

- Record every production release.
- Record the final migration version.
- Mark breaking changes clearly.
- Confirm rollback status before deployment.
- Link release notes to commits or deployment artifacts where available.

## Rollback Status Values

- `NOT_REQUIRED`
- `AVAILABLE`
- `TESTED`
- `BLOCKED`
- `UNKNOWN`

Use `UNKNOWN` only when rollback has not been evaluated.
