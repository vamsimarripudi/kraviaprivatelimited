# KRAVIA Company OS Developer Guide

## Purpose

This guide explains how engineers should work on KRAVIA Company OS without reducing quality, security, or maintainability.

## Repository Structure

```text
backend   Spring Boot API
frontend  Angular application
docs      API, architecture, operations, security, and handover documentation
```

## Backend Development

Use:

- Java 21
- Spring Boot 3.x
- Maven
- Spring Security
- Spring Data JPA
- Flyway
- Bean Validation
- PostgreSQL

## Frontend Development

Use:

- Angular latest stable
- TypeScript
- Standalone components
- Reactive Forms
- Angular Router
- RxJS
- SCSS
- Angular Signals where useful

## Module Development Checklist

Every module should include:

- Controller
- Service interface
- ServiceImpl
- Repository
- DTOs
- Entity
- Mapper
- Validator
- Specification
- Exception
- Unit tests
- Integration tests
- Permission tests
- Documentation updates

## Backend Coding Rules

- Keep controllers thin.
- Do not put business logic in controllers.
- Do not put SQL in controllers.
- Use DTOs for API input and output.
- Validate requests with Bean Validation.
- Enforce permissions in backend services.
- Log important actions through audit logging.
- Use transactions at service boundaries.
- Prefer specifications for complex filtering.
- Add indexes for new query patterns.

## Frontend Coding Rules

- Keep components focused on UI.
- Put API calls in services.
- Put reusable UI in shared components.
- Use route guards for protected pages.
- Use Reactive Forms for forms.
- Use typed models.
- Avoid duplicated form logic where practical.
- Use empty, loading, and error states consistently.
- Do not store secrets in frontend code.

## Testing Rules

Backend tests should include:

- service unit tests
- validation tests
- repository tests where queries matter
- controller integration tests
- security tests
- permission matrix tests

Frontend tests should include:

- route guard tests
- component tests for important forms
- validation tests
- service tests for API behavior
- responsive smoke tests where practical

## Local Commands

Backend:

```bash
cd backend
mvn clean test
mvn spring-boot:run
```

Frontend:

```bash
cd frontend
npm install
npm run build
npm start
```

## Review Checklist

Before merging:

- code compiles
- tests pass
- no secrets committed
- no dummy data added
- no fake records added
- permissions are enforced in backend
- frontend route guards are correct
- audit logs are added for important actions
- migrations are reviewed
- docs are updated

## Current Engineering Note

The local environment used during the final audit did not have Maven available and had Java 17 instead of Java 21. Backend verification must be run in a correct developer or CI environment.
