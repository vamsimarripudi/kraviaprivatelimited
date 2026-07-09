# KRAVIA Company OS API Contract

Base path: `/api`

All endpoints except `POST /auth/login` and `/actuator/health` require:

```http
Authorization: Bearer <jwt>
```

## Auth

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/login` | Public | Authenticate with email/password and receive JWT |
| POST | `/auth/logout` | Authenticated | Stateless logout endpoint; client removes JWT |
| GET | `/auth/me` | Authenticated | Return current user session and roles |

### Login Request

```json
{
  "email": "founder@kravia.local",
  "password": "strong-password"
}
```

### Login Response

```json
{
  "token": "jwt-token",
  "user": {
    "id": "uuid",
    "email": "founder@kravia.local",
    "displayName": "Founder",
    "roles": ["FOUNDER"]
  }
}
```

## Company Profile

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/company-profile` | Founder, Director, Viewer | Load company profile from PostgreSQL |
| PUT | `/company-profile` | Founder, Director | Save company profile and write audit log |

Viewer users can read the company profile but cannot edit it.

## Document Vault

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/documents/upload` | Founder, Director | Upload a document file and create metadata/version records |
| GET | `/documents` | Founder, Director, Viewer | List documents with optional search/category/status filters |
| GET | `/documents/{id}` | Founder, Director, Viewer | View document metadata |
| GET | `/documents/{id}/download` | Founder, Director, Viewer | Download the file through a protected backend API |
| PUT | `/documents/{id}` | Founder, Director | Update document metadata |
| DELETE | `/documents/{id}` | Founder | Archive a document |

### List Query Parameters

- `query`: searches title, description, and file name.
- `category`: one of the configured document category enum values.
- `status`: `ACTIVE`, `ARCHIVED`, `EXPIRED`, or `PENDING_REVIEW`.

### Upload Form Data

```http
Content-Type: multipart/form-data
```

Fields:

- `title` required
- `category` required
- `description` optional
- `file` required

### Document Categories

- `INCORPORATION_CERTIFICATE`
- `MOA`
- `AOA`
- `COMPANY_PAN`
- `TAN`
- `GST`
- `BOARD_RESOLUTION`
- `RENTAL_AGREEMENT`
- `BANK_DOCUMENT`
- `TRADEMARK_DOCUMENT`
- `STARTUP_INDIA_DOCUMENT`
- `AGREEMENT`
- `OTHER`

### Document Response Fields

Document responses include:

- `id`
- `title`
- `category`
- `description`
- `status`
- `fileName`
- `fileType`
- `fileSize`
- `version`
- `uploadedBy`
- `createdAt`
- `updatedAt`
- `archivedAt`

The response never exposes `storagePath`.


## Board Meetings

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/board-meetings` | Founder, Director | Create a board meeting record |
| GET | `/board-meetings` | Founder, Director, Viewer | List meetings with optional search/type/status filters |
| GET | `/board-meetings/{id}` | Founder, Director, Viewer | View meeting details |
| PUT | `/board-meetings/{id}` | Founder, Director | Update meeting details |
| DELETE | `/board-meetings/{id}` | Founder | Archive a meeting |
| POST | `/board-meetings/{id}/action-items` | Founder, Director | Add an action item to a meeting |
| PUT | `/board-meetings/{id}/action-items/{actionItemId}` | Founder, Director | Update an action item |

### Meeting Filters

- `query`: searches meeting title and discussion notes.
- `meetingType`: one of the configured meeting type enum values.
- `status`: `DRAFT`, `SCHEDULED`, `COMPLETED`, or `ARCHIVED`.

### Meeting Types

- `BOARD_MEETING`
- `FOUNDER_MEETING`
- `FINANCE_REVIEW`
- `COMPLIANCE_REVIEW`
- `PRODUCT_REVIEW`
- `BANK_MEETING`
- `INVESTOR_MEETING`
- `OTHER`

### Meeting Payload Fields

Meeting create/update requests include:

- `title` required
- `meetingDate` required, ISO local date-time
- `meetingType` required
- `status` required
- `agendaItems` list
- `discussionNotes`
- `decisions` list
- `resolutions` list
- `actionItems` list, optional

A meeting cannot be marked `COMPLETED` until at least one agenda item exists.

### Action Item Fields

Action item create/update requests include:

- `actionText` required
- `owner` required
- `dueDate` required unless status is `DONE`
- `status` required: `TODO`, `IN_PROGRESS`, `WAITING`, `DONE`, or `BLOCKED`


## Financial Records

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/financial-records` | Founder, Director | Create a monthly financial record |
| GET | `/financial-records` | Founder, Director, Viewer | List financial records with optional search/year/month filters |
| GET | `/financial-records/{id}` | Founder, Director, Viewer | View financial record details |
| PUT | `/financial-records/{id}` | Founder, Director | Update a financial record |
| DELETE | `/financial-records/{id}` | Founder | Archive a financial record |

### Financial Filters

- `query`: searches reporting month, founder notes, and creator.
- `reportingYear`: four-digit year.
- `reportingMonth`: month number from `1` to `12`; single-digit values are normalized by the backend.

### Financial Payload Fields

Financial record create/update requests include:

- `reportingMonth` required, `YYYY-MM`
- `revenue` required, non-negative currency value
- `expenses` required, non-negative currency value
- `cashBalance` optional, non-negative currency value
- `receivables` optional, non-negative currency value
- `payables` optional, non-negative currency value
- `gstCollected` required, non-negative currency value
- `gstPaid` required, non-negative currency value
- `cloudSubscriptions` optional, non-negative currency value
- `vendorPayments` optional, non-negative currency value
- `directorRemuneration` optional, non-negative currency value
- `founderNotes` optional
- `status` required: `DRAFT`, `FINAL`, or `ARCHIVED`

The backend calculates `profitOrLoss = revenue - expenses` and `netGstPosition = gstCollected - gstPaid` for every create and update request.

## Audit Logs

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/audit-logs` | Founder, Director | Return audit logs newest first |

Profile edits create audit entries with module `COMPANY_PROFILE` and action `PROFILE_UPDATED`.
Document actions create audit entries with module `DOCUMENT_VAULT` and actions `DOCUMENT_UPLOADED`, `DOCUMENT_UPDATED`, `DOCUMENT_DOWNLOADED`, and `DOCUMENT_ARCHIVED`.
Board meeting actions create audit entries with module `BOARD_MEETINGS` and actions `MEETING_CREATED`, `MEETING_UPDATED`, `MEETING_STATUS_CHANGED`, `MEETING_ARCHIVED`, `MEETING_ACTION_ITEM_CREATED`, `MEETING_ACTION_ITEM_UPDATED`, and `MEETING_ACTION_STATUS_CHANGED`.
Financial record actions create audit entries with module `FINANCIAL_RECORDS` and actions `FINANCIAL_RECORD_CREATED`, `FINANCIAL_RECORD_UPDATED`, and `FINANCIAL_RECORD_ARCHIVED`.

## Database Tables

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
- `audit_logs`

## Data Rules

- No dummy company profile data is seeded.
- No dummy document records or files are seeded.
- No dummy board meeting records, discussions, decisions, resolutions, or action items are seeded.
- No dummy financial records or metrics are seeded.
- The migration inserts only role names: `FOUNDER`, `DIRECTOR`, `VIEWER`.
- The only user bootstrap is the optional founder account from environment variables.
- Document files are stored in private local storage for development and downloaded only through protected APIs.
