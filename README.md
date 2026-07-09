# KRAVIA Company OS Foundation

Foundation full-stack internal company workspace for KRAVIA PRIVATE LIMITED.

## Structure

- `frontend`: Angular, TypeScript, Router, Reactive Forms, Signals, guards, interceptors, enterprise shell, document workspace.
- `backend`: Java 21, Spring Boot 3.5, Spring Security, JWT, BCrypt, JPA, PostgreSQL, Flyway, validation, audit logging, secure local document storage.
- `docs`: API contract and local setup guide.

## Modules

1. Auth
2. User and roles
3. Company Profile
4. Document Vault
5. Audit Log base

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
- Document upload, metadata update, download, and archive actions create audit logs.

## Local Setup

See [docs/SETUP.md](docs/SETUP.md).

## API Contract

See [docs/API_CONTRACT.md](docs/API_CONTRACT.md).
