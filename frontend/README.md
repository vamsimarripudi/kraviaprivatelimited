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
- Audit Logs

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

- Founder: can view and edit company profile; can upload, edit, download, and archive documents; can create, edit, and archive board meetings; can create, edit, and archive financial records; can create, edit, and archive compliance items; can create, edit, complete, and archive tasks; can view audit logs.
- Director: can view and edit company profile; can upload, edit, and download documents; can create and edit board meetings; can create and edit financial records; can create and edit compliance items; can create, edit, and complete tasks; can view audit logs.
- Viewer: can view company profile, view/download documents, read board meetings, read financial records, read compliance items, and read tasks only.
