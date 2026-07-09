# Contributing To KRAVIA Company OS

## Purpose

This document defines the contribution standard for KRAVIA Company OS.

## Contribution Principles

- Protect company data.
- Keep changes small and reviewable.
- Avoid fake data and placeholder records.
- Maintain backend permission enforcement.
- Keep user-facing UI professional and consistent.
- Update documentation when behavior changes.

## Branching

Use clear branch names:

```text
feature/<module-name>
fix/<issue-name>
docs/<document-name>
refactor/<area-name>
security/<area-name>
```

## Commit Messages

Use concise commit messages:

```text
Add document vault upload validation
Fix viewer access for reports
Document backup restore flow
Refactor task filtering service
```

## Pull Request Checklist

Every pull request should confirm:

- purpose is clear
- scope is limited
- tests are added or updated
- no secrets are committed
- no dummy records are committed
- migrations are included if schema changed
- permissions are enforced in backend
- audit logging is updated where needed
- documentation is updated

## Code Review Focus

Reviewers should check:

- security risks
- role bypass risks
- data integrity
- validation gaps
- missing audit logs
- performance issues
- duplicated logic
- unclear naming
- UI consistency
- migration safety

## Documentation Rules

Update docs when changing:

- API behavior
- database schema
- deployment setup
- environment variables
- user workflows
- security rules
- operations flows

## Data Rules

Never commit:

- real passwords
- JWT secrets
- private API keys
- production database URLs
- private documents
- fake company records
- lorem ipsum

## Testing Expectations

Minimum expected tests for non-document changes:

- unit test for new business logic
- validation test for new request rules
- permission test for protected behavior
- integration test for important API flows

## Architecture Rule

New modules should follow the architecture standard in `docs/Architecture.md`.

Do not expand inconsistent patterns without an explicit refactoring plan.
