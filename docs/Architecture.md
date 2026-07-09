# KRAVIA Company OS Architecture

## Purpose

This document defines the target enterprise architecture for KRAVIA Company OS. It is the engineering standard for future module work, refactoring, reviews, and production hardening.

## Architecture Decision

KRAVIA Company OS should follow a clean layered architecture.

Backend flow:

```text
Controller
Application Service
Domain Service
Repository
Database
```

Frontend flow:

```text
Route
Page Component
Feature Facade or Service
API Service
Backend API
```

Controllers and Angular components should coordinate work. They should not contain business rules.

## Backend Package Standard

Every backend feature package should move toward this structure:

```text
com.kravia.companyos.<module>
  controller
  application
  domain
  repository
  dto
  entity
  mapper
  validator
  specification
  exception
```

Current code is package-per-module and service-oriented, but most modules do not yet split service interfaces, service implementations, mappers, validators, specifications, and module-specific exceptions.

## Backend Layer Responsibilities

### Controller

- Accept HTTP requests.
- Validate request DTOs using Bean Validation.
- Return standard API responses.
- Delegate to application services.
- Contain no business logic.
- Contain no SQL or JPA query logic.

### Application Service

- Orchestrate use cases.
- Enforce high-level permissions.
- Start transactions.
- Call domain services, repositories, mappers, validators, and audit logging.

### Domain Service

- Hold reusable business rules.
- Calculate derived values.
- Validate state transitions.
- Avoid HTTP, session, or framework-specific logic where practical.

### Repository

- Own persistence access.
- Use Spring Data JPA query methods, specifications, or clearly named custom queries.
- Return entities or projections to services.
- Avoid exposing persistence details to controllers.

### Mapper

- Convert between entities and DTOs.
- Prefer MapStruct for complex mapping.
- Keep mapping code out of controllers.

### Validator

- Hold module-specific validation that cannot be expressed cleanly with Bean Validation annotations.
- Return clear validation errors.

### Specification

- Encapsulate filtering, searching, sorting, and archive/soft-delete rules for JPA queries.

## Frontend Structure Standard

Target Angular structure:

```text
src/app
  core
    auth
    http
    models
    guards
    interceptors
  shared
    components
    directives
    pipes
    utilities
  layout
  features
    company-profile
    documents
    board-meetings
    finance
    compliance
    tasks
    products
    contacts
    announcements
    notifications
    reports
    search
    ai-assistant
    audit
```

The current frontend has `core`, `shared`, `layout`, and feature folders, but feature folders are directly under `src/app` and routes import components eagerly. Future work should migrate feature routes to lazy-loaded standalone route files.

## Angular Component Rules

- Components should handle presentation and user events.
- Business rules should live in services, facades, validators, or utility functions.
- Forms should use Reactive Forms.
- Shared UI states should use reusable empty, loading, and error components.
- Angular Signals can be used for local UI state where they simplify code.
- RxJS should be used for HTTP streams and async workflows.
- Subscriptions should be managed with `async` pipe, `takeUntilDestroyed`, or equivalent lifecycle-safe patterns.

## Lazy Loading Standard

Every feature should expose routes like:

```text
features/<feature>/<feature>.routes.ts
```

Application routes should use `loadChildren` or `loadComponent` instead of eager component imports.

## Cross-Cutting Architecture

Cross-cutting concerns belong in shared infrastructure:

- Authentication and authorization
- JWT handling
- Request logging
- Correlation IDs
- Error handling
- Audit logging
- File validation
- Standard API response model
- Pagination, sorting, and filtering
- Health and metrics endpoints

## Module Readiness Standard

A module is enterprise-ready only when it has:

- Controller
- Service interface
- Service implementation
- Repository
- DTOs
- Entity
- Mapper
- Validator
- Specification
- Module exception
- Unit tests
- Integration tests
- Permission tests
- Documentation updates

## Current Architecture Gaps

- No Settings module exists, although it remains in the final audit scope.
- Most modules use service classes directly instead of service interfaces and implementations.
- Mappers are mostly manual rather than MapStruct-based.
- JPA Specifications are not consistently present for filtering.
- API response envelope and pagination standard are not yet consistently implemented.
- Frontend routes are protected but not fully lazy-loaded.
- Test coverage is thin.
- Optimistic locking is not present in the base entity.

## Architecture Rule For Future Work

No future feature should be added until the module architecture standard is applied to either the new module or the touched module. This prevents the codebase from growing around inconsistent patterns.
