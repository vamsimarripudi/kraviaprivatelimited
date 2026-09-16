# KRAVIA Office — Production Identity & MFA

## Production identity provider

KRAVIA Office uses a dedicated Supabase Auth project. It is isolated from other KRAVIA/product projects.

- Project name: `KRAVIA Office`
- Project ref: `xjtazosozxmudkbxqhjl`
- Region: `ap-south-1`
- Issuer: `https://xjtazosozxmudkbxqhjl.supabase.co/auth/v1`
- Audience: `authenticated`
- JWKS: `https://xjtazosozxmudkbxqhjl.supabase.co/auth/v1/.well-known/jwks.json`
- Required assurance level: `aal2`
- MFA factor: TOTP authenticator
- Office role claim: `office_roles`
- Access-state claim: `office_access_status`

No private API key, user password, TOTP secret or recovery material belongs in this repository.

## Security model

1. There is no KRAVIA Office public self-signup endpoint.
2. An identity existing in Supabase is not sufficient for Office access.
3. The identity must have an `ACTIVE` row in `office_identity_users`.
4. The identity must hold at least one explicit row in `office_user_roles`.
5. The custom access-token hook injects only those approved roles into `office_roles`.
6. Production Office requires the JWT `aal` claim to equal `aal2`.
7. The canonical API still cryptographically verifies issuer, audience, signature, expiry and the role claim before protected handlers execute.
8. Browser access and refresh tokens are stored only in HttpOnly, SameSite cookies. They are never returned to application JavaScript or stored in local/session storage.
9. Same-origin mutation protection, host validation, rate limiting and CSP remain enforced.

## First-user activation

Complete these dashboard-controlled steps after the code deployment configuration is ready:

1. In **Project Settings → JWT signing keys**, migrate from the legacy JWT secret to the signing-keys system and activate the generated asymmetric key. ES256/P-256 is preferred. Do not revoke a previously-used key until its accepted-token window has elapsed.
2. In **Authentication → Hooks**, enable the Custom Access Token hook and select `public.office_custom_access_token_hook`.
3. In **Authentication → MFA**, confirm TOTP enrollment and verification are enabled.
4. In **Authentication → Providers / Email**, keep the required internal sign-in method enabled and disable public self-registration for Office.
5. Create or invite the first authorized Office identity from **Authentication → Users**. Do not share its password in Git, chat, docs or tickets.
6. Add that user's UUID to `office_identity_users` with status `ACTIVE` and assign the minimum required role in `office_user_roles`. The first administrative account should be assigned `OWNER` only when that authority is intentional.
7. Sign in through `/auth.html`, enroll TOTP, verify the code and confirm the resulting session is `aal2` with the expected `office_roles` claim.

## Production environment

```text
APP_ENV=production
AUTH_MODE=oidc
SUPABASE_AUTH_URL=https://xjtazosozxmudkbxqhjl.supabase.co
SUPABASE_PUBLISHABLE_KEY=<deployment configuration>
OIDC_ISSUER=https://xjtazosozxmudkbxqhjl.supabase.co/auth/v1
OIDC_AUDIENCE=authenticated
OIDC_JWKS_URL=https://xjtazosozxmudkbxqhjl.supabase.co/auth/v1/.well-known/jwks.json
OIDC_ROLE_CLAIM=office_roles
OIDC_ACTOR_CLAIM=email
OIDC_REQUIRED_AAL=aal2
```

`SUPABASE_PUBLISHABLE_KEY` is deliberately not committed even though it is designed for client/public use; it remains deployment configuration so keys can be rotated independently of source releases.

## Suspension / revocation

Changing an Office identity to `SUSPENDED` or `REVOKED` causes newly issued JWTs to contain no Office roles. For urgent removal, also revoke/sign out the user's active Supabase Auth sessions so an already-issued token is not left valid until normal expiry. Re-enable access only through an explicit reviewed identity/role change.

## Recovery

Supabase TOTP does not rely on application-managed recovery codes. Privileged Office identities should enroll a separately protected backup authenticator factor where operationally appropriate. Recovery actions must be treated as privileged identity-administration events and documented outside source control.
