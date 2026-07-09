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
