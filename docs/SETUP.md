# Local Setup Guide

## Prerequisites

- Java 21
- Maven 3.9+
- Node.js 22+
- npm 11+
- PostgreSQL 15+

## 1. Create Database

Create an empty PostgreSQL database:

```sql
CREATE DATABASE kravia_companyos;
```

Flyway creates the application tables on backend startup.

## 2. Configure Backend Environment

Set these variables before running Spring Boot:

```powershell
$env:DATABASE_URL='jdbc:postgresql://localhost:5432/kravia_companyos'
$env:DATABASE_USERNAME='postgres'
$env:DATABASE_PASSWORD='postgres'
$env:KRAVIA_JWT_SECRET='replace-with-a-long-random-secret-of-at-least-32-characters'
$env:KRAVIA_ALLOWED_ORIGINS='http://localhost:4200'
$env:KRAVIA_BOOTSTRAP_FOUNDER_EMAIL='founder@kravia.local'
$env:KRAVIA_BOOTSTRAP_FOUNDER_PASSWORD='replace-with-a-strong-temporary-password'
$env:KRAVIA_BOOTSTRAP_FOUNDER_NAME='Founder'
```

Remove the bootstrap founder variables after the first account is created.

## 3. Run Backend

```powershell
cd backend
mvn spring-boot:run
```

Backend API runs at `http://localhost:8080/api`.

## 4. Run Frontend

```powershell
cd frontend
npm install
npm start
```

Frontend runs at `http://localhost:4200` and proxies `/api` to Spring Boot.

## 5. Login Flow

1. Open `http://localhost:4200`.
2. Sign in with the founder email and password configured above.
3. Open Company Profile.
4. Save profile data.
5. Open Audit Logs to confirm the profile edit was recorded.

## Role Checks

- Founder and Director can save company profile data.
- Viewer can only view the company profile.
- Audit Logs route is visible only to Founder and Director.
