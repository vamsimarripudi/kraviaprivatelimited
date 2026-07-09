# KRAVIA PRIVATE LIMITED Company OS

This repository now contains a full-stack enterprise internal company portal for KRAVIA PRIVATE LIMITED.

- `frontend`: Angular 22, TypeScript, Angular Router, Reactive Forms, Signals, custom enterprise UI, protected routes, HTTP interceptors, dark/light mode, print styles.
- `backend`: Java 21 target, Spring Boot 3.5, Spring Security JWT auth, Spring Data JPA, PostgreSQL, Flyway migrations, Bean Validation, audit logging, file upload storage, notifications, global search, and REST APIs.

The older static prototype files remain in the root for reference, but the production rebuild lives in `/frontend` and `/backend`.

## Core Modules

- Authentication
- Users and roles
- Company profile
- Document vault
- Board meetings
- Financial records
- Compliance center
- Tasks
- Products portfolio
- Contacts and partners
- Audit logs
- Settings
- Announcements
- Notifications
- Reports
- Global search
- AI assistant data layer

## Local Requirements

- Java 21
- Maven 3.9+
- Node.js 22+
- npm 11+
- PostgreSQL 15+

## Backend Setup

Create a PostgreSQL database, then set environment variables before starting Spring Boot.

```powershell
$env:DATABASE_URL='jdbc:postgresql://localhost:5432/kravia_companyos'
$env:DATABASE_USERNAME='postgres'
$env:DATABASE_PASSWORD='postgres'
$env:KRAVIA_JWT_SECRET='replace-with-a-long-random-secret-of-at-least-32-characters'
$env:KRAVIA_BOOTSTRAP_FOUNDER_EMAIL='founder@kravia.local'
$env:KRAVIA_BOOTSTRAP_FOUNDER_PASSWORD='replace-with-a-strong-temporary-password'
$env:KRAVIA_BOOTSTRAP_FOUNDER_NAME='Founder'
cd backend
mvn spring-boot:run
```

Flyway creates the database schema automatically on startup. The bootstrap founder account is created only when the configured email does not already exist.

## Frontend Setup

```powershell
cd frontend
npm install
npm start
```

Angular serves on `http://localhost:4200` and proxies `/api` to Spring Boot on `http://localhost:8080`.

## Security Notes

- Passwords are hashed with BCrypt in the backend.
- JWT signing secrets, database credentials, and bootstrap passwords are read from environment variables.
- All internal API routes require authentication except `/api/auth/login` and `/api/actuator/health`.
- Founder, Director, and Viewer permissions are enforced in backend services and reflected by Angular route guards and role-aware UI.
- Important write actions create records in `audit_logs`.
- Document files use local private storage in development through `DocumentStorageService`, with an interface ready for S3-compatible storage later.

## API Contract

See [docs/API_CONTRACT.md](docs/API_CONTRACT.md).
