# KRAVIA Company OS Deployment Guide

Date: July 9, 2026

## Production Decision

Do not deploy to internal production until launch blockers are closed.

## Prerequisites

- Java 21
- Maven 3.9 or newer
- Node.js 22 or current Angular-supported LTS
- PostgreSQL 15 or newer
- Docker and Docker Compose for local production testing

## Local Verification Flow

1. Configure backend environment variables.
2. Start PostgreSQL.
3. Run Flyway migrations through backend startup.
4. Run backend tests.
5. Build frontend.
6. Start backend and frontend.
7. Verify login and private routes for Founder, Director, and Viewer.
8. Verify document upload/download through protected APIs.
9. Verify audit log creation for mutating actions.

## Backend Commands

```bash
cd backend
mvn clean test
mvn spring-boot:run
```

Local audit note: these commands were not run during final QA because Maven is unavailable and local Java is 17 while the backend targets Java 21.

## Frontend Commands

```bash
cd frontend
npm install
npm run build
npm start
```

Frontend production build passed during the previous hardening phase after the latest code changes.

## Docker Local Production Test

```bash
docker compose up --build
```

After startup, verify:

- `GET /api/health`
- `GET /api/health/database`
- `GET /api/health/storage`
- Frontend login page
- Protected workspace routes

## Database Migration

Flyway migrations should run automatically at backend startup. Before production cutover:

- Run against a clean PostgreSQL database.
- Confirm all migrations from V1 through V11 apply successfully.
- Confirm the application user has only required privileges.

## Backup Notes

Before production launch:

- Create a PostgreSQL backup command or managed backup policy.
- Test restore into a separate database.
- Confirm document storage backup coverage.
- Record backup results in the `backup_runs` table or deployment runbook.

## Document Storage

Current storage is local development storage. For internal production:

- Keep storage outside the frontend public directory.
- Mount storage as a private backend volume.
- Download only through authenticated backend APIs.
- Plan migration to S3-compatible private storage with signed access later.

## Deployment Blockers

- Settings module is missing.
- Backend Java 21/Maven compile and test verification has not been completed.
- End-to-end role verification has not been completed in a running production-like environment.
