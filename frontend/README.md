# Frontend

Angular frontend for KRAVIA Company OS.

## Stack

- Angular 22
- TypeScript
- Angular Router
- Reactive Forms
- Angular Signals
- Functional HTTP interceptors
- Custom enterprise UI components

## Run

```powershell
npm install
npm start
```

The Angular dev server uses `proxy.conf.json` to send `/api` requests to `http://localhost:8080`.

## Roles

- Founder: full access, user management, settings, document upload, archive actions.
- Director: create/edit/view operational records, view documents and audit logs.
- Viewer: read-only workspace access.
