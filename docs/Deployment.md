# KRAVIA Company OS Deployment Engineering Guide

## Purpose

This document defines the deployment engineering standard for KRAVIA Company OS.

## Runtime Requirements

Backend:

- Java 21
- Maven 3.9 or newer
- Spring Boot 3.x
- PostgreSQL 15 or newer

Frontend:

- Node.js version compatible with Angular 22
- Angular CLI
- Static web server or container runtime

Infrastructure:

- Docker and Docker Compose for local production testing
- Private storage volume for documents
- Secure secret management

## Environments

Recommended environments:

- `local`
- `test`
- `staging`
- `production`

Every environment should have separate:

- database
- secrets
- storage path or bucket
- frontend origin
- logging destination

## Deployment Gates

Do not deploy unless:

- frontend build passes
- backend compile passes on Java 21
- backend unit tests pass
- integration tests pass
- Flyway migrations apply on a clean database
- role permission tests pass
- document upload/download tests pass
- no secrets are committed
- environment variables are configured
- health endpoints pass

## Health Checks

Required:

- `GET /api/health`
- `GET /api/health/database`
- `GET /api/health/storage`

Spring Actuator should be enabled for controlled internal monitoring.

Recommended actuator endpoints:

- health
- info
- metrics
- prometheus if a metrics stack is added

## Logging Standard

Production logs should include:

- timestamp
- level
- service name
- environment
- request ID
- actor email where safe
- HTTP method
- path
- status
- duration

Do not log:

- passwords
- JWT tokens
- refresh tokens
- document contents
- full private file paths
- secrets

## Correlation IDs

Every request should have a correlation ID.

The backend should:

- read incoming correlation ID if present
- generate one if absent
- include it in logs
- return it in response headers

## Rollback Standard

Before each deployment:

1. Confirm latest backup.
2. Confirm previous container image or artifact is available.
3. Confirm migration rollback plan.
4. Confirm document storage is unaffected.
5. Confirm founder contact for release approval.

## Database Migrations

Flyway migrations should run before the application serves traffic.

For high-risk migrations:

- test on a copy of production data
- estimate runtime
- verify indexes
- prepare rollback plan

## Current Deployment Status

Deployment assets exist, but production readiness is blocked until:

- Java 21 and Maven backend verification is completed
- Settings scope is resolved
- Docker production test is run
- role permission tests pass
- restore drill is completed
