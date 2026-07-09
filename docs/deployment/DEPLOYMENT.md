# KRAVIA Company OS Deployment Guide

## Local Production Test

1. Copy `.env.production.example` to `.env.production`.
2. Replace all placeholder secrets.
3. Run:

```powershell
docker compose --env-file .env.production -f docker-compose.prod.yml up --build
```

Frontend runs on `http://localhost:8088`. Backend is available behind the frontend `/api` proxy.

## Database Migrations

Flyway migrations run automatically on backend startup. To validate migrations during CI or release preparation:

```powershell
cd backend
./mvnw flyway:validate
```

## Backup

PostgreSQL backup example:

```powershell
docker compose --env-file .env.production -f docker-compose.prod.yml exec postgres pg_dump -U kravia kravia_companyos > backups/kravia_companyos.sql
```

Document storage backup should include the `document_storage` Docker volume or the configured `KRAVIA_DOCUMENT_STORAGE_ROOT` path.

## Restore

```powershell
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres psql -U kravia kravia_companyos < backups/kravia_companyos.sql
```

Restore document files to the same private storage root before users download documents.

## Release Checklist

- Use Java 21 and PostgreSQL 15+ or 16+.
- Set `SPRING_PROFILES_ACTIVE=prod`.
- Use a 32+ byte `KRAVIA_JWT_SECRET`.
- Restrict `KRAVIA_ALLOWED_ORIGINS` to the production frontend origin.
- Remove founder bootstrap credentials after first login.
- Verify `/api/health`, `/api/health/database`, and `/api/health/storage`.
- Confirm backups are encrypted and tested before production data entry.
