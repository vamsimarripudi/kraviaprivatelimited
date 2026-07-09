# KRAVIA Company OS Security Audit Report

Date: July 9, 2026

## Production Decision

NOT READY - BLOCKERS FOUND

Security readiness depends on closing launch blockers and running backend tests in the correct Java 21 environment.

## Security Controls Observed

| Area | Status | Notes |
| --- | --- | --- |
| Authentication | Implemented | JWT login, refresh, logout, and current-user APIs are present. |
| Password hashing | Implemented | BCrypt is configured in the backend foundation. |
| Backend permissions | Implemented pending tests | Controllers and services use role checks; final permission tests were not run locally. |
| Route guards | Implemented pending browser QA | Angular auth and role guards are present from the application foundation. |
| Audit logging | Implemented | Audit structures and endpoint are present; modules are expected to log important mutations. |
| File access | Implemented pending runtime test | Documents use protected backend download APIs instead of public file paths. |
| File storage | Dev-ready | Local secure storage is present for development; S3-compatible storage remains future work. |
| CORS | Implemented | Production CORS configuration exists and must be restricted per environment. |
| Rate limiting | Implemented with limitation | In-memory implementation is not cluster-wide. |
| Account lockout | Implemented pending tests | Failed login lockout was added in hardening, but not runtime verified locally. |
| Health endpoints | Implemented | `/api/health`, `/api/health/database`, and `/api/health/storage` exist. |
| Error handling | Implemented | Global exception handling structure exists. |

## Static Security Scan

Checked for:

- `lorem`
- `dummy`
- `fake`
- likely hardcoded `password=`
- likely hardcoded `secret=`
- likely hardcoded API key strings
- `console.`

Result: no app-source secrets, fake records, dummy data, lorem ipsum, or console logging were found. Documentation contains placeholder examples and explicit no-dummy/no-fake language only.

## Critical Blockers

1. Settings is missing from the required launch scope, so security and permission behavior for that module cannot be audited.
2. Backend security tests were not executed locally because Java 21 was unavailable in the audit environment. Use the backend Maven Wrapper in a Java 21 environment.

## High-Priority Security Issues

- Run API permission tests for Founder, Director, and Viewer across every private endpoint.
- Confirm refresh-token revocation behavior during logout.
- Confirm document download authorization with real uploaded files.
- Confirm upload validation for path traversal, unsafe filenames, size limits, and MIME allowlists.
- Run production CORS verification against the intended frontend origin only.

## Medium-Priority Security Issues

- Replace in-memory rate limiting with Redis or another shared limiter before multi-instance deployment.
- Restrict health endpoints to internal networks or load-balancer health checks if required.
- Add automated dependency vulnerability scanning in CI.
- Add signed private document URLs when moving to object storage.

## Low-Priority Security Improvements

- Add security headers at the frontend reverse proxy layer.
- Add structured security events for suspicious login attempts.
- Add tamper-evident audit log retention controls.
- Add periodic access review exports for founders/directors.

## Security Verdict

Security design is directionally sound for a controlled internal system, but production approval should wait until backend tests, role-bypass tests, document authorization tests, and Settings scope resolution are complete.
