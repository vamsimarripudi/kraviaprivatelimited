# KRAVIA Company OS - Permission-Aware Analytics Guide

## Roles

Founder:

- Full analytics access.
- Can request export placeholders.

Director:

- Operational analytics access.
- Can request export placeholders.

Viewer:

- Read-only permitted analytics access.
- Can view analytics dashboards.

## Enforcement

Permissions are enforced in the backend through `PermissionService`.

Frontend route access is not treated as the security boundary.

## Export Auditing

Every analytics export request creates an audit log entry with:

- Actor
- Module
- Requested format
- Timestamp

## Data Visibility

Analytics responses must use only records the logged-in user is permitted to access.

Current Phase 24 enforcement is role-based. Future enhancements should add record-level visibility checks if restricted records are introduced inside source modules.

## Empty Data Handling

If a user is permitted to access a module but no records exist, the backend returns empty states. The UI must not create placeholder numbers or sample charts.
