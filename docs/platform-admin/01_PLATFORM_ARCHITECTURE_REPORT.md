# Platform Architecture Report

## Purpose

Phase 16 adds a Platform Administration module so KRAVIA Company OS can act as the operating control center for KRAVIA software infrastructure and future products.

## Architecture

Backend package:

```text
com.kravia.companyos.platformadmin
```

Frontend module:

```text
src/app/platform-admin
```

Database migration:

```text
V14__platform_administration.sql
```

## Platform Administration Scope

The platform admin center manages:

- environments
- backend service registry
- system health
- releases
- backups
- scheduled jobs
- API registry
- security center signals
- module dependencies
- engineering dashboard metrics

## Shared Services Reused

- Spring Security for authentication.
- `PermissionService` for backend role enforcement.
- `AuditService` for platform administration events.
- Existing module registry from Phase 14.
- Existing configuration service from Phase 14.
- Existing health checks and Spring Boot Actuator.

## Permissions

- Founder: full platform administration.
- Director: read-only platform overview.
- Viewer: no access.

Backend permissions are authoritative. Frontend route guards only improve user experience.

## Future Product Fit

The platform admin model can register future KRAVIA products and services such as:

- VidyaLuma
- VaanMeet
- VFormix
- future KRAVIA products

Each product or service should be registered with environment, service, release, backup, API, and job records as applicable.
