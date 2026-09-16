# KRAVIA Office — Production Identity, MFA and Delegated Access

## Identity provider

KRAVIA Office uses its dedicated Supabase Auth project in `ap-south-1`. The public website/admin Supabase tenant remains separate.

- issuer: `https://xjtazosozxmudkbxqhjl.supabase.co/auth/v1`
- audience: `authenticated`
- JWKS: `https://xjtazosozxmudkbxqhjl.supabase.co/auth/v1/.well-known/jwks.json`
- required assurance: `aal2`
- MFA: TOTP authenticator
- role claim: `office_roles`
- admission claim: `office_access_status`
- department claim: `office_department`
- authorization revision: `office_authz_version`

No API secret, password, invite token hash, JWT, refresh token, TOTP secret or recovery credential belongs in source control.

## Current hosted state

Completed in the dedicated project:

- asymmetric JWT signing-key migration/rotation;
- Custom Access Token Hook activation;
- public self-signup disabled;
- protected first OWNER identity created/admitted;
- OWNER claim output verified;
- deny-by-default client RLS for access-governance tables;
- delegated OWNER → ADMIN → department/professional role schema;
- one-OWNER database guard;
- role-expiry and authorization-version controls;
- AUDITOR separation-of-duties database guard;
- immutable access-audit guard.

The first OWNER TOTP enrollment remains a human acceptance action because the authenticator secret/code must stay exclusively with the user.

## Authentication and authorization

A protected Office/Finance request requires all of the following:

1. cryptographically valid Supabase session;
2. admitted `ACTIVE` Office identity;
3. at least one current, non-expired explicit Office role;
4. TOTP-verified `aal2` session;
5. role permitted for the requested workspace/module.

The Next.js BFF stores access/refresh tokens in HttpOnly, SameSite=Strict cookies. When `OFFICE_SUPABASE_SECRET_KEY` is configured, the BFF also reads current admission and roles from the trusted Office tables on each protected server flow; a stale JWT therefore cannot preserve browser access after a role/status change.

## Delegation

OWNER is the bootstrap authority and is protected from ordinary deletion, suspension, role removal or transfer. Only OWNER can appoint/remove ADMIN and DIRECTOR. ADMIN can onboard/manage the delegated roles `FINANCE`, `CA`, `CS`, `LEGAL`, `HR`, `OPERATIONS`, `AUDITOR` and `PRODUCT_ADMIN` but cannot modify itself or another privileged identity.

ADMIN is deliberately not a Finance/Legal/HR/security-data superuser. Additional business access requires an explicit additional role.

See `ACCESS_GOVERNANCE.md` for lifecycle, review, recovery and audit rules.

## Invitation activation

Production invitation email must send the token hash to the server-side confirmation route:

```text
{{ .SiteURL }}/office/invite/confirm?token_hash={{ .TokenHash }}&type=invite
```

After confirmation, `/office/activate` requires a 14+ character mixed password and TOTP enrollment/verification before the workspace can open. Cancelled or expired invitations are rejected by the application invitation ledger even if an old email link still exists.

## Deployment variables

Next.js trusted server:

```text
OFFICE_SUPABASE_URL=https://xjtazosozxmudkbxqhjl.supabase.co
OFFICE_SUPABASE_PUBLISHABLE_KEY=<active publishable key>
OFFICE_SUPABASE_SECRET_KEY=<active secret key; server only>
OFFICE_API_ORIGIN=https://<canonical FastAPI Railway origin>
```

FastAPI runtime:

```text
APP_ENV=production
AUTH_MODE=oidc
OIDC_ISSUER=https://xjtazosozxmudkbxqhjl.supabase.co/auth/v1
OIDC_AUDIENCE=authenticated
OIDC_JWKS_URL=https://xjtazosozxmudkbxqhjl.supabase.co/auth/v1/.well-known/jwks.json
OIDC_ROLE_CLAIM=office_roles
OIDC_ACTOR_CLAIM=email
OIDC_REQUIRED_AAL=aal2
```

## Recovery

Normal user TOTP reset is a controlled OWNER/ADMIN operation within delegated authority and is audited. Supabase deletes the factor and terminates sessions for a verified-factor deletion; the user must enroll MFA again.

OWNER recovery is intentionally excluded from ordinary self-service/ADMIN flows. It is a break-glass identity-provider procedure. Supabase does not provide recovery codes; a separately protected backup TOTP factor is the preferred owner recovery control.

## Remaining hosted settings

Before production onboarding begins:

- set Auth Site URL to `https://kraviaprivatelimited.com` and allow the Office confirmation/activation redirect paths;
- install the invite email template above;
- configure production SMTP/email delivery;
- enroll the OWNER TOTP factor and preferably a separately protected backup factor;
- keep JWT expiry appropriate for the sensitivity of Office access;
- note that Supabase leaked-password protection and advanced session-lifetime controls depend on plan availability. The application still enforces strong invite passwords and AAL2 regardless.
