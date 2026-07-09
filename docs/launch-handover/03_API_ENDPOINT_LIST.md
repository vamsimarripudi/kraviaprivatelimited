# KRAVIA Company OS API Endpoint List

Date: July 9, 2026

Backend context path: `/api`

## Auth

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

## Health

- `GET /api/health`
- `GET /api/health/database`
- `GET /api/health/storage`

## Company Profile

- `GET /api/company-profile`
- `PUT /api/company-profile`

## Audit Logs

- `GET /api/audit-logs`

## Document Vault

- `POST /api/documents/upload`
- `GET /api/documents`
- `GET /api/documents/{id}`
- `GET /api/documents/{id}/download`
- `PUT /api/documents/{id}`
- `DELETE /api/documents/{id}`

## Board Meetings

- `POST /api/board-meetings`
- `GET /api/board-meetings`
- `GET /api/board-meetings/{id}`
- `PUT /api/board-meetings/{id}`
- `DELETE /api/board-meetings/{id}`
- `POST /api/board-meetings/{id}/action-items`
- `PUT /api/board-meetings/{id}/action-items/{actionItemId}`

## Financial Records

- `POST /api/financial-records`
- `GET /api/financial-records`
- `GET /api/financial-records/{id}`
- `PUT /api/financial-records/{id}`
- `DELETE /api/financial-records/{id}`

## Compliance Center

- `POST /api/compliance-items`
- `GET /api/compliance-items`
- `GET /api/compliance-items/{id}`
- `PUT /api/compliance-items/{id}`
- `DELETE /api/compliance-items/{id}`

## Tasks

- `POST /api/tasks`
- `GET /api/tasks`
- `GET /api/tasks/{id}`
- `PUT /api/tasks/{id}`
- `PATCH /api/tasks/{id}/status`
- `PATCH /api/tasks/{id}/complete`
- `DELETE /api/tasks/{id}`

## Products Portfolio

- `POST /api/products`
- `GET /api/products`
- `GET /api/products/{id}`
- `PUT /api/products/{id}`
- `DELETE /api/products/{id}`

## Contacts & Partners

- `POST /api/contacts`
- `GET /api/contacts`
- `GET /api/contacts/{id}`
- `PUT /api/contacts/{id}`
- `DELETE /api/contacts/{id}`

## Announcements

- `POST /api/announcements`
- `GET /api/announcements`
- `GET /api/announcements/{id}`
- `PUT /api/announcements/{id}`
- `PATCH /api/announcements/{id}/pin`
- `DELETE /api/announcements/{id}`

## Notifications

- `GET /api/notifications`
- `PATCH /api/notifications/{id}/read`
- `PATCH /api/notifications/read-all`
- `DELETE /api/notifications/{id}`

## Reports

- `GET /api/reports/company-summary`
- `GET /api/reports/financial-summary`
- `GET /api/reports/profit-loss`
- `GET /api/reports/board-meetings`
- `GET /api/reports/compliance`
- `GET /api/reports/tasks`
- `GET /api/reports/products`
- `GET /api/reports/documents`
- `GET /api/reports/contacts`
- `GET /api/reports/activity`

## Global Search

- `GET /api/search?q={query}`

## Executive AI Assistant

- `POST /api/ai/query`
- `GET /api/ai/history`
- `GET /api/ai/history/{id}`
- `DELETE /api/ai/history/{id}`

## Missing From Required Scope

- Settings endpoints were not found.
