# Backend

Spring Boot foundation backend for KRAVIA Company OS.

## Stack

- Java 21 target
- Spring Boot 3.5
- Spring Security JWT
- Spring Data JPA
- PostgreSQL
- Flyway
- Bean Validation
- BCrypt password hashing
- Global exception handling
- Audit logging base
- Secure local document storage with a storage-service abstraction

## Tables

- `users`
- `roles`
- `user_roles`
- `company_profile`
- `documents`
- `document_versions`
- `board_meetings`
- `meeting_agenda_items`
- `meeting_decisions`
- `meeting_resolutions`
- `meeting_action_items`
- `financial_records`
- `compliance_items`
- `company_tasks`
- `products`
- `contacts`
- `announcements`
- `notifications`
- `ai_queries`
- `ai_context_snapshots`
- `audit_logs`

## Environment

Required:

- `DATABASE_URL`
- `DATABASE_USERNAME`
- `DATABASE_PASSWORD`
- `KRAVIA_JWT_SECRET`

Optional:

- `PORT`
- `KRAVIA_ALLOWED_ORIGINS`
- `KRAVIA_BOOTSTRAP_FOUNDER_EMAIL`
- `KRAVIA_BOOTSTRAP_FOUNDER_PASSWORD`
- `KRAVIA_BOOTSTRAP_FOUNDER_NAME`
- `KRAVIA_JWT_EXPIRATION_MINUTES`
- `KRAVIA_DOCUMENT_STORAGE_ROOT`
- `KRAVIA_DOCUMENT_MAX_FILE_SIZE_BYTES`
- `KRAVIA_DOCUMENT_ALLOWED_CONTENT_TYPES`
- `KRAVIA_DOCUMENT_MULTIPART_MAX_SIZE`
- `KRAVIA_DOCUMENT_MULTIPART_MAX_REQUEST_SIZE`

## Announcements & Notifications

Announcements are stored in `announcements`; generated notification records are stored in `notifications`. Founder and Director users can create and edit announcements, Founder can archive, and Viewer users can only read published/pinned announcements for Viewer or Everyone audiences. Published or pinned announcements generate real `GENERAL` notifications for enabled users in the target audience.

Important actions write audit logs:

- `ANNOUNCEMENT_CREATED`
- `ANNOUNCEMENT_UPDATED`
- `ANNOUNCEMENT_PINNED`
- `ANNOUNCEMENT_ARCHIVED`
- `ANNOUNCEMENT_STATUS_CHANGED`
- `NOTIFICATIONS_CREATED`
- `NOTIFICATION_READ`
- `NOTIFICATIONS_READ_ALL`
- `NOTIFICATION_ARCHIVED`
## Executive AI Assistant

AI query history is stored in `ai_queries`; the stored data context used for each response is stored in `ai_context_snapshots`. The current assistant is a private deterministic data layer: it does not call an external model, does not expose API keys, and returns `No information available.` when permitted stored records are unavailable. Founder and Director users can query the assistant; Viewer users have no AI access by default. Directors can only view/archive their own AI history, while Founder can view all AI history.

Important actions write audit logs:

- `AI_QUERY_CREATED`
- `AI_QUERY_ARCHIVED`

## Reports & Global Search

Reports are generated from existing PostgreSQL records only. The backend exposes print-friendly report responses with metrics and tabular sections, supports date range and module filters, and writes `REPORT_GENERATED` audit logs. PDF and Excel export flags are placeholders for future export endpoints.

Global search queries company profile, documents, board meetings, financial records, compliance items, tasks, products, contacts, announcements, and permitted audit logs. Search results are grouped by module and filtered by role permissions; Viewer users do not receive audit log results, and Director users do not receive restricted auth/security/settings audit log entries.

## Contacts & Partners

Contact records are stored in `contacts`. The backend enforces Founder/Director write access, Founder-only archive access, and Viewer read-only access. The service calculates follow-up due indicators from each contact next follow-up date on read.

Contact actions write audit logs:

- `CONTACT_CREATED`
- `CONTACT_UPDATED`
- `CONTACT_STATUS_CHANGED`
- `CONTACT_ARCHIVED`
## Products Portfolio

Product records are stored in `products`. The backend enforces Founder/Director write access, Founder-only archive access, and Viewer read-only access. Product status, development stage, launch readiness, risks, milestone, and ownership are persisted without seeded dummy records.

Product actions write audit logs:

- `PRODUCT_CREATED`
- `PRODUCT_UPDATED`
- `PRODUCT_STATUS_CHANGED`
- `PRODUCT_ARCHIVED`
## Company Tasks

Company tasks are stored in `company_tasks`. The backend enforces Founder/Director write and complete access, Founder-only archive access, and Viewer read-only access. The service calculates overdue indicators from each task due date on read.

Task actions write audit logs:

- `TASK_CREATED`
- `TASK_UPDATED`
- `TASK_STATUS_CHANGED`
- `TASK_COMPLETED`
- `TASK_ARCHIVED`
## Compliance Center

Compliance records are stored in `compliance_items`. The backend enforces Founder/Director write access, Founder-only archive access, and Viewer read-only access. The service calculates overdue and upcoming-due indicators from each item due date on read.

Compliance actions write audit logs:

- `COMPLIANCE_ITEM_CREATED`
- `COMPLIANCE_ITEM_UPDATED`
- `COMPLIANCE_STATUS_CHANGED`
- `COMPLIANCE_ITEM_ARCHIVED`
## Financial Records

Financial records are stored in `financial_records`. The backend enforces Founder/Director write access, Founder-only archive access, and Viewer read-only access. Profit/loss and net GST position are calculated by the service on every create and update request.

Financial actions write audit logs:

- `FINANCIAL_RECORD_CREATED`
- `FINANCIAL_RECORD_UPDATED`
- `FINANCIAL_RECORD_ARCHIVED`

## Board Meetings

Board meeting records are stored in normalized meeting, agenda, decision, resolution, and action item tables. The backend enforces Founder/Director write access, Founder-only archive access, and Viewer read-only access.

Meeting actions write audit logs:

- `MEETING_CREATED`
- `MEETING_UPDATED`
- `MEETING_STATUS_CHANGED`
- `MEETING_ARCHIVED`
- `MEETING_ACTION_ITEM_CREATED`
- `MEETING_ACTION_ITEM_UPDATED`
- `MEETING_ACTION_STATUS_CHANGED`

## Document Vault

Document files are stored outside public web paths. The API persists metadata in PostgreSQL and stores file bytes through `DocumentStorageService`, currently implemented by `LocalDocumentStorageService` for development. A later S3 implementation should replace the storage service without changing the controller contract.

Important document actions write audit logs:

- `DOCUMENT_UPLOADED`
- `DOCUMENT_UPDATED`
- `DOCUMENT_DOWNLOADED`
- `DOCUMENT_ARCHIVED`

## Run

```powershell
mvn spring-boot:run
```

The API is served under `/api`.

## Production Hardening

Production profile `application-prod.yml` enables Flyway validation, secure servlet cookie defaults, structured request logs, rate limit settings, and production logging levels. Health endpoints are available at `/api/health`, `/api/health/database`, and `/api/health/storage`.

Refresh tokens are stored hashed in `refresh_tokens`. Failed login attempts and account lockouts are stored on `users`. Backup run metadata can be recorded in `backup_runs`.
