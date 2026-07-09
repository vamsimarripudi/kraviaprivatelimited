# KRAVIA Company OS API Standards

## Purpose

This document defines the target API standard for KRAVIA Company OS. It should be used for new endpoints and for refactoring existing endpoints.

## Base Path

Current backend context path:

```text
/api
```

Future versioned API path:

```text
/api/v1
```

Existing endpoints should remain stable until versioned replacements are introduced.

## Standard Success Response

All new APIs should return a consistent response envelope:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "string",
    "timestamp": "2026-07-09T00:00:00Z"
  }
}
```

For lists:

```json
{
  "success": true,
  "data": [],
  "page": {
    "number": 0,
    "size": 25,
    "totalElements": 0,
    "totalPages": 0
  },
  "meta": {
    "requestId": "string",
    "timestamp": "2026-07-09T00:00:00Z"
  }
}
```

## Standard Error Response

All errors should follow one shape:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed.",
    "details": []
  },
  "meta": {
    "requestId": "string",
    "timestamp": "2026-07-09T00:00:00Z"
  }
}
```

Current code has an `ApiError` record. It should be extended into the full standard envelope during refactoring.

## HTTP Status Rules

| Status | Use |
| --- | --- |
| `200` | Successful read or update. |
| `201` | Successful create. |
| `204` | Successful delete/archive with no body. |
| `400` | Invalid request or validation error. |
| `401` | Missing or invalid authentication. |
| `403` | Authenticated but not permitted. |
| `404` | Record not found or not visible to user. |
| `409` | Version conflict or duplicate unique record. |
| `413` | File too large. |
| `415` | Unsupported file type. |
| `429` | Rate limit exceeded. |
| `500` | Unexpected server error. |

## Pagination

All list endpoints should support:

```text
page
size
sort
direction
```

Example:

```text
GET /api/v1/tasks?page=0&size=25&sort=dueDate&direction=asc
```

Default:

- `page`: `0`
- `size`: `25`
- Maximum `size`: `100`

## Filtering

Filters should use clear query parameters:

```text
GET /api/v1/tasks?status=TODO&priority=HIGH
GET /api/v1/documents?category=GST&status=ACTIVE
GET /api/v1/compliance-items?category=MCA&status=IN_PROGRESS
```

Filtering logic should be implemented through service/specification layers, not controllers.

## Searching

Search parameters should use:

```text
q
```

Example:

```text
GET /api/v1/search?q=invoice
```

Search results must respect role permissions.

## Sorting

Sort fields should be allowlisted per endpoint to avoid unsafe query behavior.

Example allowed fields:

- `createdAt`
- `updatedAt`
- `dueDate`
- `status`
- `title`

## Validation

All request DTOs should use Bean Validation:

- `@NotBlank`
- `@NotNull`
- `@Email`
- `@Size`
- `@Min`
- `@Max`
- module-specific custom validators where needed

Controllers should use `@Valid`.

## Authorization

Authorization must be enforced in the backend.

Use:

- Spring Security route protection
- Method-level authorization where appropriate
- Centralized permission checks
- Ownership checks for user-specific data

Frontend guards improve UX but must not be the only security control.

## Audit Logging

Audit these actions:

- Create
- Update
- Archive
- Delete where applicable
- Download
- Login security events
- Report generation
- AI query execution
- Settings changes when Settings is implemented

Audit logs should include:

- Actor
- Action
- Module
- Record ID
- Timestamp
- Request ID
- Summary

## OpenAPI / Swagger

Add Springdoc OpenAPI before production API expansion.

Recommended endpoint:

```text
/api/swagger-ui
```

OpenAPI definitions should include:

- Auth requirements
- Request DTOs
- Response DTOs
- Error response model
- Pagination model
- Role permissions

## API Refactoring Priority

1. Add standard response envelope.
2. Add versioned `/api/v1` path.
3. Add pagination to list endpoints.
4. Add OpenAPI documentation.
5. Add API contract tests.
