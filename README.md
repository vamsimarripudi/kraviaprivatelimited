# KRAVIA Company OS Foundation

Foundation full-stack internal company workspace for KRAVIA PRIVATE LIMITED.

## Structure

- `frontend`: Angular, TypeScript, Router, Reactive Forms, Signals, guards, interceptors, enterprise shell, document workspace, board meeting workspace, financial dashboard, compliance center, company tasks, products portfolio, contacts and partners, announcements, notifications, reports, global search.
- `backend`: Java 21, Spring Boot 3.5, Spring Security, JWT, BCrypt, JPA, PostgreSQL, Flyway, validation, audit logging, secure local document storage, board meeting records, financial records, compliance tracking, company tasks, products portfolio, contacts and partners, announcements, notifications, reports, global search.
- `docs`: API contract and local setup guide.

## Modules

1. Auth
2. User and roles
3. Company Profile
4. Document Vault
5. Board Meetings
6. Financial Records
7. Compliance Center
8. Company Tasks
9. Products Portfolio
10. Contacts & Partners
11. Announcements
12. Notifications
13. Reports
14. Global Search
15. Audit Log base

## Roles

- `FOUNDER`
- `DIRECTOR`
- `VIEWER`

## Security

- All private APIs require a JWT bearer token.
- Passwords are hashed with BCrypt.
- JWT secret and founder bootstrap credentials are environment variables.
- The only seeded user is the optional founder account from environment variables.
- Roles are stored in PostgreSQL through `roles` and `user_roles`.
- Company profile edits are enforced by backend permissions and create audit logs.
- Document APIs are backend-protected by role, downloads go through authenticated API routes, and storage paths are never exposed to the frontend.
- Board meeting APIs are backend-protected by role and important meeting actions create audit logs.
- Financial record APIs are backend-protected by role and create, update, and archive actions create audit logs.
- Compliance APIs are backend-protected by role and create, update, status change, and archive actions create audit logs.
- Task APIs are backend-protected by role and create, update, status change, complete, and archive actions create audit logs.
- Product APIs are backend-protected by role and create, update, status change, and archive actions create audit logs.
- Contact APIs are backend-protected by role and create, update, status change, and archive actions create audit logs.
- Announcement and notification APIs are backend-protected by role, and published/pinned announcements generate real notifications for their audience.
- Report APIs generate print-friendly output from existing records only and audit every report generation.
- Global search is backend-protected and filters results by role, including restricted audit/security visibility.

## Local Setup

See [docs/SETUP.md](docs/SETUP.md).

## API Contract

See [docs/API_CONTRACT.md](docs/API_CONTRACT.md).
