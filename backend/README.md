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

## Tables

- `users`
- `roles`
- `user_roles`
- `company_profile`
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

## Run

```powershell
mvn spring-boot:run
```

The API is served under `/api`.
