# KRAVIA Company OS ERP Architecture Report

Date: July 9, 2026

## Phase 14 Summary

Phase 14 establishes KRAVIA Company OS as a modular ERP foundation. It does not redesign the UI and does not rewrite completed business modules. Instead, it adds a shared platform layer that can coordinate modules through common registry, configuration, workflow, relationship, dashboard, permission, audit, search, reporting, notification, and storage concepts.

## New ERP Foundation Components

Backend package:

```text
com.kravia.companyos.platform
```

Database migration:

```text
V12__erp_foundation.sql
```

Frontend addition:

```text
src/app/dashboard
```

## Shared Platform Services

| Service | Current Implementation | Purpose |
| --- | --- | --- |
| Identity & Access Management | Existing `security.PermissionService`, `auth`, and `user` packages | Shared authentication and role enforcement. |
| Organization Service | Existing `company.CompanyProfileService` | Single source of truth for company profile data. |
| Audit Service | Existing `audit.AuditService` | Shared audit trail for important system actions. |
| Notification Service | Existing `notification.NotificationService` | Shared notification records and read/archive states. |
| Document Reference Service | New `platform.CrossModuleLinkService` plus existing document vault | Links documents to records across modules. |
| Search Service | Existing `search.SearchService` | Permission-aware global search across modules. |
| Reporting Service | Existing `report.ReportService` | Shared report generation from stored records. |
| Workflow Service | New `platform.WorkflowService` | Lightweight workflow engine for reviews, approvals, and assignments. |
| Configuration Service | New `platform.PlatformConfigurationService` | Centralized settings and feature configuration storage. |
| File Storage Service | Existing `document.DocumentStorageService` | Private file storage abstraction for documents. |
| Module Registry | New `platform.ModuleRegistryService` | Catalog of modules, status, routes, dependencies, permissions, and feature flags. |
| Executive Dashboard | New `platform.ExecutiveDashboardService` | Aggregates real stored module data into one operating view. |

## Module Registry

The module registry stores:

- module code
- module name
- version
- status
- navigation path
- permission summary
- dependencies
- feature flag key

Initial registry entries are created by the platform service when registry data is first requested. This avoids fake operational data while still registering system modules as platform configuration.

## Module Dependencies

| Module | Dependencies |
| --- | --- |
| Auth | None |
| Company Profile | None |
| Document Vault | None |
| Board Meetings | Documents, Tasks |
| Financial Records | Board Meetings, Documents |
| Compliance Center | Documents, Contacts, Tasks |
| Tasks | Documents |
| Products Portfolio | Tasks |
| Contacts & Partners | Documents, Tasks |
| Announcements | Documents, Notifications |
| Notifications | None |
| Reports | Company modules through reporting service |
| Global Search | Company modules through search service |
| Executive AI Assistant | Search, Reports, permitted stored data |
| Audit Logs | All audited modules |
| Settings | Planned, not active |

## Workflow Architecture

The new lightweight workflow engine supports:

- workflow type
- title
- state
- assignee
- related module
- related record ID
- comments
- state history
- audit trail

Workflow states:

- `DRAFT`
- `ASSIGNED`
- `IN_REVIEW`
- `PENDING_APPROVAL`
- `APPROVED`
- `REJECTED`
- `COMPLETED`
- `ARCHIVED`

Workflow types:

- `BOARD_MEETING_APPROVAL`
- `DOCUMENT_REVIEW`
- `COMPLIANCE_SUBMISSION`
- `TASK_ASSIGNMENT`
- `PRODUCT_RELEASE_APPROVAL`
- `GENERAL`

Workflow APIs:

- `GET /api/platform/workflows`
- `GET /api/platform/workflows/{id}`
- `POST /api/platform/workflows`
- `PATCH /api/platform/workflows/{id}/state`
- `POST /api/platform/workflows/{id}/comments`
- `DELETE /api/platform/workflows/{id}`

## Cross-Module Relationships

The ERP foundation adds `cross_module_links` for relationships such as:

- Task to Board Meeting
- Task to Product
- Compliance to Document
- Compliance to Contact
- Financial Record to Board Meeting
- Product to Tasks
- Announcement to Document
- Document to Audit Log

Relationship APIs:

- `GET /api/platform/links`
- `POST /api/platform/links`
- `DELETE /api/platform/links/{id}`

The relationship service stores links generically so future modules can participate without schema changes.

## Permission Model

Phase 14 keeps the existing role model:

- `FOUNDER`
- `DIRECTOR`
- `VIEWER`

Platform-level rules:

| Capability | Founder | Director | Viewer |
| --- | --- | --- | --- |
| Module registry read | Yes | Yes | Yes |
| Module registry update | Yes | No | No |
| Dashboard read | Yes | Yes | Yes |
| Workflow read | Yes | Yes | Yes |
| Workflow create/comment/state update | Yes | Yes | No |
| Workflow archive | Yes | No | No |
| Cross-module link read | Yes | Yes | Yes |
| Cross-module link create | Yes | Yes | No |
| Cross-module link delete | Yes | No | No |
| Configuration read | Yes | Yes | No |
| Configuration update | Yes | No | No |

Backend permissions remain authoritative. Frontend route guards are only a user experience layer.

## Unified Executive Dashboard

New endpoint:

```text
GET /api/platform/dashboard
```

Dashboard widgets use stored records only:

- company overview from Company Profile
- financial highlights from latest Financial Record
- pending approvals from Workflow
- compliance alerts from Compliance Center
- upcoming meetings from Board Meetings
- open tasks from Tasks
- product progress from Products Portfolio
- recent documents from Document Vault
- notifications from Notification Service
- AI insights from deterministic stored-data signals

If data is missing, the dashboard returns zero counts, empty lists, or `No information available.`

## Configuration Model

The new configuration service centralizes:

- company settings
- notification settings
- security settings
- feature flags
- storage settings
- email settings

Configuration APIs:

- `GET /api/platform/configuration`
- `PUT /api/platform/configuration`

Sensitive configuration values are masked in API responses.

## Search And Reporting Direction

The existing Search and Report services remain the shared engines. Future refactoring should move each module into a common interface:

```text
SearchIndexProvider
ReportDataProvider
```

Each module should provide its searchable fields and report rows through those interfaces. This keeps search and reporting unified as the ERP grows.

## Extension Guidelines For Future Modules

Every new module must:

1. Register itself in the module registry.
2. Define module permissions.
3. Declare module dependencies.
4. Use backend permission checks.
5. Use shared audit logging.
6. Use shared notification service for events.
7. Use cross-module links for relationships.
8. Use workflow service for approvals or reviews.
9. Expose searchable data through the shared search engine.
10. Expose reportable data through the shared reporting engine.
11. Use Flyway migrations for schema changes.
12. Avoid fake data and seeded operational records.

## Engineering Notes

This phase intentionally avoids a mass rewrite of existing modules. Existing modules already share several services, especially permissions, audit logging, notifications, reports, search, and document storage. The new platform layer formalizes those services into an ERP architecture and introduces persistent workflow, registry, configuration, relationship, and dashboard foundations.

## Remaining ERP Gaps

- Existing list APIs still need standard pagination.
- Search should move to provider-based indexing.
- Reporting should move to provider-based report sections.
- Settings remains planned, not fully implemented as a UI module.
- Existing modules should gradually adopt explicit module interfaces.
- Backend verification still requires Java 21 and Maven Wrapper.
- Workflow UI is not yet exposed as a full user page; workflow APIs and dashboard aggregation exist.

## Recommended Next Engineering Sequence

1. Run backend verification in Java 21 + Maven Wrapper.
2. Add tests for platform services.
3. Add pagination and API envelope standards.
4. Add provider interfaces for search and reporting.
5. Add a workflow management UI if operational users need direct workflow control.
6. Complete Settings as a first-class module.
7. Gradually refactor high-risk modules to the architecture standard.
