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
- Audit Logs

## Document Vault UI

The Documents page includes category cards, search, category/status filters, upload progress, document metadata editing, protected downloads, and founder-only archive actions. It shows `No documents have been added yet.` when no records exist.

## Role Behavior

- Founder: can view and edit company profile; can upload, edit, download, and archive documents; can view audit logs.
- Director: can view and edit company profile; can upload, edit, and download documents; can view audit logs.
- Viewer: can view company profile and view/download documents only.
