# Backup & Restore Guide

## Purpose

This guide explains how KRAVIA Company OS records should be protected through backup and restore practices.

Backups are a business control. They protect the company from data loss, accidental deletion, system failure, and deployment mistakes.

## What Must Be Backed Up

Back up:

- PostgreSQL database
- Uploaded document storage
- Environment configuration records
- Deployment configuration
- Audit logs

Do not store secrets in ordinary backup notes.

## Backup Frequency

Recommended minimum:

- Database: daily
- Document storage: daily
- Configuration: after every deployment change
- Full restore test: monthly or before major production changes

## Backup Owner

Assign one owner for backup operations.

The owner should confirm:

- Backup completed.
- Backup location is secure.
- Restore process is known.
- Backup evidence is recorded.

## Backup Steps

1. Confirm the system is stable.
2. Run database backup.
3. Back up document storage.
4. Store backup in an approved secure location.
5. Record backup date, owner, and result.
6. Report failure immediately.

## Restore Steps

1. Identify the reason for restore.
2. Stop affected services if needed.
3. Select the correct backup.
4. Restore database to a safe environment first.
5. Restore document storage.
6. Verify login works.
7. Verify company profile loads.
8. Verify documents can be listed and downloaded.
9. Verify audit logs are present.
10. Move restored system into service only after approval.

## Restore Approval

Restore should be approved by a founder unless there is an emergency and prior approval is not possible.

## Backup Rules

- Do not keep backups on personal devices.
- Do not send backups over unsecured channels.
- Do not restore production data into an unsafe environment.
- Do not delete old backups without retention approval.
- Test restore before relying on backups for production.
