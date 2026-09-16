# KRAVIA Office — Production Identity & MFA

## Production identity provider

KRAVIA Office uses a dedicated Supabase Auth project. It is isolated from the public website and other KRAVIA/product projects.

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
- Canonical browser login: `/office/login` (Finance users may enter at `/finance/login`)

No private API key, user password, TOTP secret or recovery material belongs in this repository.

## Security model

1. There is no KRAVIA Office public self-signup endpoint and hosted email self-registration is disabled.
2. An identity existing in Supabase is not sufficient for Office access.
3. The identity must have an `ACTIVE` row in `office_identity_users`.
4. The identity must hold at least one explicit row in `office_user_roles`.
5. The enabled custom access-token hook injects only those approved roles into `office_roles`.
6. Production Office and Finance require the JWT `aal` claim to equal `aal2`.
7. The canonical FastAPI runtime still cryptographically verifies issuer, audience, signature, expiry and the role claim before protected handlers execute.
8. Path-workspace browser access and refresh tokens are stored only in HttpOnly, SameSite=Strict cookies. They are never returned to application JavaScript or stored in local/session storage.
9. Same-origin mutation protection is applied at the path-workspace BFF; FastAPI retains its own host/origin/rate-limit/security controls.
10. Public website `/admin` authentication remains a separate identity boundary and must not be conflated with Office roles.

## Hosted activation status

Completed in the dedicated hosted Supabase project:

- asymmetric JWT signing-key migration/rotation;
- Custom Access Token hook activation using `public.office_custom_access_token_hook`;
- public Office self-signup disabled while email/password sign-in remains available for approved users;
- first approved human Office identity created and email-confirmed;
- first identity admitted as `ACTIVE` with the intentional `OWNER` role;
- hook output verified to emit `office_roles=[OWNER]` and `office_access_status=ACTIVE` for that identity;
- unassigned identities verified fail-closed with no Office roles.

Remaining hosted identity action before production acceptance: enroll and verify the first user's TOTP factor through the canonical path login, then confirm the resulting session is `aal2`.

## TOTP enrollment through the path workspace

1. Deploy the root Next.js application with `OFFICE_SUPABASE_URL` and the active modern Office publishable key.
2. Open `/office/login` on the KRAVIA website.
3. Sign in with the approved personal corporate identity.
4. The BFF keeps the password session tokens in HttpOnly cookies. If there is no verified factor, the page starts TOTP enrollment and displays the Supabase enrollment QR.
5. Scan the QR with the approved authenticator app and submit the current code.
6. The BFF verifies the factor and refuses workspace entry unless Supabase reports `aal2`.
7. Verify that `/office/dashboard` opens and that the identity header shows only the assigned Office role(s).

Do not send passwords, QR secrets or TOTP codes through Git, chat, screenshots, documents or tickets.

## Production FastAPI environment

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

## Production Next.js path-workspace environment

```text
OFFICE_SUPABASE_URL=https://xjtazosozxmudkbxqhjl.supabase.co
OFFICE_SUPABASE_PUBLISHABLE_KEY=<active modern publishable key>
OFFICE_API_ORIGIN=https://<canonical FastAPI runtime origin>
```

The publishable key is deliberately kept as deployment configuration even though it is designed for public-client use; this keeps rotation independent of source releases. `OFFICE_API_ORIGIN` is server-only and is never returned to browser code.

## Suspension / revocation

Changing an Office identity to `SUSPENDED` or `REVOKED` causes newly issued JWTs to contain no Office roles. For urgent removal, also revoke/sign out the user's active Supabase Auth sessions so an already-issued token is not left valid until normal expiry. Re-enable access only through an explicit reviewed identity/role change.

## Recovery

Supabase TOTP does not rely on application-managed recovery codes. Privileged Office identities should enroll a separately protected backup authenticator factor where operationally appropriate. Recovery actions must be treated as privileged identity-administration events and documented outside source control.
