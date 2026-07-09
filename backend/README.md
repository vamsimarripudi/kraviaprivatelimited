# Backend

Spring Boot backend for KRAVIA Company OS.

## Stack

- Java 21 target
- Spring Boot 3.5
- Spring Security JWT
- Spring Data JPA
- PostgreSQL
- Flyway
- Bean Validation
- BCrypt password hashing

## Environment

Required:

- `DATABASE_URL`
- `DATABASE_USERNAME`
- `DATABASE_PASSWORD`
- `KRAVIA_JWT_SECRET`

Optional:

- `PORT`
- `KRAVIA_STORAGE_ROOT`
- `KRAVIA_CORS_ALLOWED_ORIGINS`
- `KRAVIA_BOOTSTRAP_FOUNDER_EMAIL`
- `KRAVIA_BOOTSTRAP_FOUNDER_PASSWORD`
- `KRAVIA_BOOTSTRAP_FOUNDER_NAME`
- `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM`

## Run

```powershell
mvn spring-boot:run
```

The API is served under `/api` because `server.servlet.context-path` is set in `application.yml`.
