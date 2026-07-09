# KRAVIA Company OS User Role Permissions Matrix

Date: July 9, 2026

Roles:

- Founder: full access unless otherwise noted.
- Director: operational create/edit/view access.
- Viewer: read-only access.

## Permissions

| Module | Founder | Director | Viewer |
| --- | --- | --- | --- |
| Auth | Login/logout/view own session | Login/logout/view own session | Login/logout/view own session |
| Company Profile | View/edit | View/edit | View only |
| Document Vault | Upload/view/download/edit/archive | Upload/view/download/edit | View/download only |
| Board Meetings | Create/view/edit/archive | Create/view/edit | View only |
| Financial Records | Create/view/edit/archive | Create/view/edit | View only |
| Compliance Center | Create/view/edit/archive | Create/view/edit | View only |
| Tasks | Create/view/edit/complete/archive | Create/view/edit/complete | View only |
| Products Portfolio | Create/view/edit/archive | Create/view/edit | View only |
| Contacts & Partners | Create/view/edit/archive | Create/view/edit | View only |
| Announcements | Create/view/edit/pin/archive | Create/view/edit/view | View published/permitted only |
| Notifications | View/read/archive own notifications | View/read/archive own notifications | View/read/archive own notifications |
| Reports | All reports | Operational reports | Permitted read-only reports |
| Global Search | Full permitted search | Operational permitted search | Read-only permitted search |
| Executive AI Assistant | Full AI access | Operational AI access | No AI access by default |
| Audit Logs | View | View, if permitted by backend policy | Usually restricted/read-only if permitted |
| Settings | Not implemented | Not implemented | Not implemented |

## Permission Review Findings

- Backend enforcement exists structurally, but role-bypass tests must be run in Java 21/Maven Wrapper environment.
- Frontend guards exist structurally, but final browser QA across all roles was not completed during this launch audit.
- Settings cannot be reviewed because the module is absent.

## Required Permission Tests Before Launch

- Founder can perform all create, update, archive, download, report, search, and AI actions.
- Director can perform allowed operational actions but cannot archive where restricted.
- Viewer cannot create, edit, archive, complete, upload, or access AI Assistant.
- Unauthenticated users cannot access private APIs.
- Document downloads fail without valid authorization.
- Search results respect role permissions.
