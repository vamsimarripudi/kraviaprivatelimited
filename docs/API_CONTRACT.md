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

## Audit Logs

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/audit-logs` | Founder, Director | Return audit logs newest first |

Profile edits create audit entries with module `COMPANY_PROFILE` and action `PROFILE_UPDATED`.

## Database Tables

- `users`
- `roles`
- `user_roles`
- `company_profile`
- `audit_logs`

## Data Rules

- No dummy company profile data is seeded.
- The migration inserts only role names: `FOUNDER`, `DIRECTOR`, `VIEWER`.
- The only user bootstrap is the optional founder account from environment variables.
