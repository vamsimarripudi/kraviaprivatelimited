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

## Audit Logs

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/audit-logs` | Founder, Director | Return audit logs newest first |

Profile edits create audit entries with module `COMPANY_PROFILE` and action `PROFILE_UPDATED`.
Document actions create audit entries with module `DOCUMENT_VAULT` and actions `DOCUMENT_UPLOADED`, `DOCUMENT_UPDATED`, `DOCUMENT_DOWNLOADED`, and `DOCUMENT_ARCHIVED`.

## Database Tables

- `users`
- `roles`
- `user_roles`
- `company_profile`
- `documents`
- `document_versions`
- `audit_logs`

## Data Rules

- No dummy company profile data is seeded.
- No dummy document records or files are seeded.
- The migration inserts only role names: `FOUNDER`, `DIRECTOR`, `VIEWER`.
- The only user bootstrap is the optional founder account from environment variables.
- Document files are stored in private local storage for development and downloaded only through protected APIs.
