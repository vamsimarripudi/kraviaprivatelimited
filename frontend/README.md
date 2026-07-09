# Frontend

Angular foundation frontend for KRAVIA Company OS.

## Stack

- Angular 22
- TypeScript
- Angular Router
- Reactive Forms
- Angular Signals
- Functional HTTP interceptors
- Auth guard
- Role guard
- Enterprise shell with sidebar and top bar
- Dark/light mode
- Empty, loading, and error state components

## Run

```powershell
npm install
npm start
```

The dev server proxies `/api` to `http://localhost:8080` through `proxy.conf.json`.

## Pages

- Login
- Company Profile
- Documents
- Board Meetings
- Finance
- Compliance
- Tasks
- Products
- Contacts
- Announcements
- Notifications
- Reports
- Global Search
- Audit Logs

## Executive AI Assistant UI

The AI Assistant page is available to Founder and Director roles only. It includes a query box, module context selector, date range selector, output type selector, response panel, query history, copy response action, archive action, and the empty state `No AI queries have been created yet.`. Responses are generated from stored KRAVIA Company OS records only; missing context returns `No information available.`.

## Reports & Global Search UI

The Reports page includes report type selection, date range and module filters, generate action, print action, PDF/Excel export placeholders, metrics, report sections, and the empty state `No matching records found.`. The Global Search page searches permitted workspace records, groups results by module, links users back to the relevant workspace page, and shows `No matching records found.` when no records match.

## Announcements & Notifications UI

The Announcements page includes summary cards, create/edit forms, audience/status controls, pin and founder-only archive actions, announcement table, detail view, and the empty state `No announcements have been added yet.`. The Notifications page lists generated notifications, supports mark-read, mark-all-read, archive actions, and shows `No notifications have been added yet.` when empty. Company Profile also shows recent published announcements and unread notifications.
## Contacts & Partners UI

The Contacts page includes summary cards, search, category/status filters, add/edit contact forms, follow-up due indicators, professional contact table, detail view, founder-only archive actions, and the empty state `No contacts have been added yet.`. Company Profile also shows contact summary cards for important contacts, follow-ups due, waiting responses, and active partners.
## Products Portfolio UI

The Products page includes summary cards, search, status/development-stage filters, add/edit product forms, launch readiness progress indicators, product table, detail view, risk and milestone sections, founder-only archive actions, and the empty state `No product records have been added yet.`. Company Profile also shows product summary cards for active, launch-ready, paused, and risk-bearing products.
## Company Tasks UI

The Tasks page includes summary cards, search, category/assignee/status/priority filters, add/edit task forms, overdue indicators, mark-done and founder-only archive actions, a professional task table, detail view, and the empty state `No company tasks have been added yet.`. Company Profile also shows task summary cards for open, overdue, blocked, and completed-this-month tasks.
## Compliance Center UI

The Compliance page includes summary cards, search, category/status/priority filters, due-date sorting from the backend, add/edit compliance item forms, overdue and upcoming due indicators, a professional compliance table, detail view, and the empty state `No compliance items have been added yet.`.
## Financial Dashboard UI

The Finance page includes monthly summary cards, search, month/year filters, add/edit financial record forms, calculated profit/loss and net GST preview, a professional record table, detail view, and the empty state `No financial records have been added yet.`.

## Document Vault UI

The Documents page includes category cards, search, category/status filters, upload progress, document metadata editing, protected downloads, and founder-only archive actions. It shows `No documents have been added yet.` when no records exist.

## Board Meetings UI

The Board Meetings page includes create/edit forms, search, meeting type/status filters, a compact meeting list, collapsible meeting details, agenda/discussion/decision/resolution sections, action item create/update flows, and the empty state `No board meeting records have been added yet.`.

## Role Behavior

- Founder: can view and edit company profile; can upload, edit, download, and archive documents; can create, edit, and archive board meetings; can create, edit, and archive financial records; can create, edit, and archive compliance items; can create, edit, complete, and archive tasks; can create, edit, and archive products; can create, edit, and archive contacts; can create, edit, pin, and archive announcements; can view and manage notifications; can generate reports, search permitted records, use the AI Assistant, and view audit logs.
- Director: can view and edit company profile; can upload, edit, and download documents; can create and edit board meetings; can create and edit financial records; can create and edit compliance items; can create, edit, and complete tasks; can create and edit products; can create and edit contacts; can create, edit, and pin announcements; can view notifications; can generate reports, search permitted records, use the AI Assistant, and view audit logs.
- Viewer: can view company profile, view/download documents, read board meetings, read financial records, read compliance items, read tasks, read products, read contacts, read published announcements, manage own notifications only, generate permitted reports, and search permitted records. Viewer users cannot access the AI Assistant by default.

## Production Hardening UI

The frontend includes production environment configuration, protected fallback pages for application errors and unknown routes, refresh token storage in session storage, and route guard tests. No frontend source file stores backend secrets.
