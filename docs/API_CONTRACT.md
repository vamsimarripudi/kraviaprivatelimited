# KRAVIA Company OS API Contract

Base path: `/api`

All endpoints require `Authorization: Bearer <jwt>` except `POST /auth/login` and health checks.

## Authentication

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/auth/login` | `{ email, password }` | `{ token, user }` |
| GET | `/auth/me` | none | authenticated user |

## Users and Roles

Founder-only.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/users` | List user accounts |
| POST | `/users` | Create user account with BCrypt-hashed password |
| DELETE | `/users/{id}` | Disable user account |

## Company Profile

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/company-profile` | Read company profile |
| PUT | `/company-profile` | Founder/Director update profile |

## Documents

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/documents` | List document metadata |
| POST | `/documents` | Founder upload multipart document |
| GET | `/documents/{id}/download` | Download stored document |

## Operational Record Modules

These modules share the same record shape: `title`, `status`, `ownerName`, `dueDate`, `category`, `referenceCode`, `amount`, `details`, `notes`.

| Module | Base Path |
| --- | --- |
| Board meetings | `/board-meetings` |
| Financial records | `/financial-records` |
| Compliance center | `/compliance-items` |
| Tasks | `/tasks` |
| Products portfolio | `/products` |
| Contacts and partners | `/contacts` |
| Settings | `/settings` |
| Announcements | `/announcements` |
| Notifications | `/notifications` |
| Reports | `/reports` |
| AI assistant data layer | `/ai/context` |

Each base path supports:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `{base}` | List records |
| GET | `{base}/{id}` | Read one record |
| POST | `{base}` | Create record |
| PUT | `{base}/{id}` | Update record |
| DELETE | `{base}/{id}` | Archive record |

Role rules:

- Founder: create, update, archive, view.
- Director: create, update, view operational records.
- Viewer: view only.
- Settings writes are founder-only.

## Audit, Dashboard, Search

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/audit-logs` | Founder/Director read audit log entries |
| GET | `/dashboard/summary` | Real record counts for workspace summary cards |
| GET | `/search?q={term}` | Search company profile, documents, products, contacts, and tasks |

## Empty Data Rule

The backend does not seed fake financial, meeting, product, contact, or document records. Empty database tables produce empty arrays, and the Angular UI renders professional empty states.
