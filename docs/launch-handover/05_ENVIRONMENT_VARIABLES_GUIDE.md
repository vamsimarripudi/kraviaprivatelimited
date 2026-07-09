# KRAVIA Company OS Environment Variables Guide

Date: July 9, 2026

Do not commit real `.env` files or production secrets.

## Backend Required Variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | JDBC connection string for PostgreSQL. |
| `DATABASE_USERNAME` | PostgreSQL application username. |
| `DATABASE_PASSWORD` | PostgreSQL application password. |
| `KRAVIA_JWT_SECRET` | Strong JWT signing secret. Must be unique per environment. |
| `KRAVIA_FOUNDER_EMAIL` | Initial founder email used during controlled bootstrap. |
| `KRAVIA_FOUNDER_PASSWORD` | Initial founder password used during controlled bootstrap. |

## Backend Recommended Variables

| Variable | Purpose |
| --- | --- |
| `KRAVIA_ACCESS_TOKEN_MINUTES` | Access-token lifetime. |
| `KRAVIA_REFRESH_TOKEN_DAYS` | Refresh-token lifetime. |
| `KRAVIA_ALLOWED_ORIGINS` | Allowed frontend origins for CORS. |
| `KRAVIA_STORAGE_ROOT` | Local private storage directory for development. |
| `KRAVIA_MAX_FILE_SIZE` | Maximum accepted upload size. |
| `KRAVIA_ALLOWED_FILE_TYPES` | Allowed document upload MIME types. |
| `KRAVIA_RATE_LIMIT_PER_MINUTE` | Per-client API rate limit. |
| `KRAVIA_ACCOUNT_LOCKOUT_ATTEMPTS` | Failed login attempts before lockout. |
| `KRAVIA_ACCOUNT_LOCKOUT_MINUTES` | Lockout duration. |

## Frontend Variables

| Variable | Purpose |
| --- | --- |
| `NG_APP_API_BASE_URL` | Backend API base URL, usually `http://localhost:8080/api` for local dev. |

## Docker / Local Production Variables

| Variable | Purpose |
| --- | --- |
| `POSTGRES_DB` | Database name. |
| `POSTGRES_USER` | Database user. |
| `POSTGRES_PASSWORD` | Database password. |
| `BACKEND_PORT` | Published backend port. |
| `FRONTEND_PORT` | Published frontend port. |

## Secret Requirements

- Use a long, random JWT secret.
- Never reuse development secrets in production.
- Store production secrets in the deployment platform secret manager.
- Rotate the bootstrap founder password after first login.
- Restrict production CORS to the deployed frontend origin.

## Verification Checklist

- Backend starts without using fallback secrets.
- Frontend calls the expected backend API base URL.
- CORS allows only approved origins.
- Database credentials connect only to the intended database.
- File storage path is private and not served by the frontend web server.
