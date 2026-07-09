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
$env:KRAVIA_DOCUMENT_STORAGE_ROOT='C:\kravia-companyos\private-documents'
$env:KRAVIA_DOCUMENT_MAX_FILE_SIZE_BYTES='26214400'
$env:KRAVIA_DOCUMENT_ALLOWED_CONTENT_TYPES='application/pdf,image/png,image/jpeg,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain'
```

Remove the bootstrap founder variables after the first account is created.

Document storage defaults to `./storage/private-documents` under the backend working directory if `KRAVIA_DOCUMENT_STORAGE_ROOT` is not set. The `storage/` directory is intentionally ignored by git.

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
5. Open Documents to upload, search, filter, view metadata, download, or archive documents according to role.
6. Open Board Meetings to create, search, filter, edit, archive, and manage action items according to role.
7. Open Finance to create, search, filter, edit, archive, and review monthly financial records according to role.
8. Open Reports to generate print-friendly summaries from existing records.
9. Open Global Search to search across permitted workspace records.
10. Open Audit Logs to confirm profile, document, meeting, finance, and report actions were recorded.

## Role Checks

- Founder can view and edit company profile, upload/download/edit/archive documents, create/edit/archive board meetings, create/edit/archive financial records, create/edit/archive compliance items, create/edit/complete/archive tasks, create/edit/archive products, create/edit/archive contacts, create/edit/pin/archive announcements, manage notifications, generate all reports, search all permitted records, use the AI Assistant, and view audit logs.
- Director can view and edit company profile, upload/download/edit documents, create/edit board meetings, create/edit financial records, create/edit compliance items, create/edit/complete tasks, create/edit products, create/edit contacts, create/edit/pin announcements, view notifications, generate operational reports, search permitted records, use the AI Assistant, and view audit logs excluding restricted auth/security/settings entries.
- Viewer can view company profile, view/download documents, read board meetings, read financial records, and read compliance items, read tasks, read products, read contacts, read published announcements, and manage own notifications only, generate permitted reports, and search permitted records only. Viewer users cannot access the AI Assistant by default.
- Audit Logs route is visible only to Founder and Director.

## Executive AI Assistant Checks

- AI APIs are protected by backend role checks and allow Founder/Director only.
- AI responses are generated from stored records only; missing context returns `No information available.`.
- AI query history is stored in `ai_queries` and context snapshots are stored in `ai_context_snapshots`.
- AI usage writes `AI_QUERY_CREATED` audit logs.
- Document context includes document metadata only, never private file contents.

## Reports & Global Search Checks

- Reports are generated from stored records only and show empty sections when no records match.
- Report generation writes `REPORT_GENERATED` audit logs.
- Date range and module filters are enforced by the backend report service.
- PDF and Excel buttons are frontend placeholders for future export endpoints.
- Global Search groups results by module and returns `No matching records found.` when empty.
- Viewer search results exclude audit logs and private announcement drafts.

## Announcements & Notifications Checks

- Announcement create/update rejects missing title, message, audience, or status.
- Published and pinned announcements generate real `GENERAL` notifications for enabled users in the selected audience.
- Viewer users only see published/pinned announcements addressed to Viewer or Everyone.
- Notification read/archive APIs are protected by backend recipient checks; Founder can manage all notifications.
## Contacts & Partners Checks

- Contact create/update rejects missing name, category, status, missing contact method, invalid email, and missing next follow-up date when follow-up is needed.
- Search, category filter, status filter, and follow-up-date sorting are handled by the backend.
- Follow-up due indicators are calculated by the backend from the next follow-up date.
- Contact APIs are protected by backend role checks; Viewer users are read-only.
## Products Portfolio Checks

- Product create/update rejects missing name, category, status, development stage, invalid launch readiness values, and missing responsible person for active products.
- Search, status filter, and development-stage filter are handled by the backend.
- Launch readiness and product risks are visible without fake metrics.
- Product APIs are protected by backend role checks; Viewer users are read-only.
## Company Tasks Checks

- Task create/update rejects missing title, category, status, priority, assignee for active tasks, and due date for high or critical tasks.
- Search, category/assignee/status/priority filters, and due-date sorting are handled by the backend.
- Overdue indicators are calculated by the backend from the task due date.
- Task APIs are protected by backend role checks; Viewer users are read-only.
## Compliance Center Checks

- Compliance create/update rejects missing title, category, status, priority, due date when applicable, and responsible person for active items.
- Search, category/status/priority filters, and due-date sorting are handled by the backend.
- Overdue and upcoming-due indicators are calculated by the backend from the item due date.
- Compliance APIs are protected by backend role checks; Viewer users are read-only.
## Financial Records Checks

- Financial create/update rejects missing reporting month, revenue, expenses, GST collected, GST paid, or status.
- Currency values must be non-negative numbers with no more than 2 decimal places.
- Zero values are valid.
- Profit/loss and net GST position are calculated by the backend.
- Financial APIs are protected by backend role checks; Viewer users are read-only.

## Document Vault Checks

- Upload rejects missing title, missing category, missing file, unsafe file names, disallowed file types, and files over the configured size limit.
- File paths are never returned by the API.
- Download uses `GET /api/documents/{id}/download`; do not serve document storage as a static public folder.

## Board Meetings Checks

- Meeting create/update rejects missing title, date, type, or status.
- Completed meetings require at least one agenda item.
- Active action items require an owner and due date.
- Board meeting APIs are protected by backend role checks; Viewer users are read-only.

## Production Hardening Checks

- Copy `.env.production.example` to `.env.production` and replace all placeholders before local production testing.
- Run `docker compose --env-file .env.production -f docker-compose.prod.yml up --build` for local production validation.
- Check `/api/health`, `/api/health/database`, and `/api/health/storage` after startup.
- Confirm weak bootstrap passwords fail startup validation.
- Confirm repeated failed logins lock the account temporarily.
- Confirm document downloads still require authenticated backend access.
- Review [deployment guide](deployment/DEPLOYMENT.md) and [production readiness report](deployment/PRODUCTION_READINESS_REPORT.md).
