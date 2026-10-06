# KRAVIA Office — first-party identity and Authenticator MFA

KRAVIA Office and KRAVIA Finance use the KRAVIA-owned FastAPI/PostgreSQL identity subsystem. Supabase Auth is not the active password, session or MFA provider. The browser uses same-origin Next.js BFF routes; access and refresh tokens remain in HttpOnly, `SameSite=Strict` cookies.

## Mandatory assurance

Every admitted role requires AAL2: OWNER, DIRECTOR, ADMIN, MEMBER, FINANCE, CA, CS, LEGAL, HR, OPERATIONS, AUDITOR and PRODUCT_ADMIN. Password verification creates only an AAL1 session. A successful TOTP verification promotes that session to AAL2; workspace guards reject protected access before that point.

Authenticator uses RFC 6238 TOTP with issuer `KRAVIA Office`, SHA-1, six digits and a 30-second period. The server encrypts the random Base32 seed at rest, tracks the last accepted counter to prevent replay, and revokes an AAL1 session after the configured consecutive invalid-code limit.

## Browser-device approval

For a browser that has not already been trusted by that account holder, a valid password and local TOTP code create only a short-lived pending device request. It cannot call Office APIs, refresh a session, or enter a workspace until the registered account holder chooses approve or decline from the corporate-email notice.

The notice names a bounded browser label and the source address observed by the KRAVIA service. It deliberately does not trust client-supplied forwarding headers. Approving the email link changes only the durable request state: it does not sign in the browser that opens the link. Only the original browser, which holds a separate HttpOnly pending proof, can complete an approved request. A declined, expired, replayed, or mismatched request cannot be completed.

This is account-owner scoped. No OWNER, ADMIN, DIRECTOR, or other organisational role is a general device approver, and no user can decide a different account holder's request. The browser trust proof expires after the configured bounded lifetime and is retained only as a hash at rest.

## Approved phone activation

There is no QR enrollment, setup key, seed export, cloud backup, or seed-sharing path.

1. A user enters their corporate email and password in Authenticator, then proves access to that registered mailbox with a one-time six-digit email code.
2. FastAPI issues an AAL2 `AUTHENTICATOR_ACTIVATION` session for 30 days. It is a secure, device-held capability for this workflow only: it cannot read Office data or become an Office browser session.
3. The app rotates its short-lived access token with that scoped session when it creates a phone request. No password is retained after verification.
4. It creates a short-lived phone request with a hashed claim token. The raw claim token exists only on that phone in device-secure storage.
5. A verified AAL2 OWNER or ADMIN sees pending requests in Office Security and explicitly approves the phone.
6. Only the approved phone can claim one freshly generated seed. A claim is single-use and records audit events.
7. The user enters a current local code into Office to complete MFA.

The first Founder can bootstrap the first factor only when no verified MFA factor exists in the organisation. This avoids an unresolvable initial trust loop. Later activation and replacement phones require AAL2 owner/admin approval.

## Phone boundary

Authenticator stores the TOTP seed and the scoped activation refresh session with native passcode-gated device storage, requires strong biometrics to unlock the vault, blocks screen capture, protects the iOS app switcher, clears sensitive memory on backgrounding, and disables OTP clipboard export. It permits only the one explicit HTTPS activation client; generated codes remain local after activation. Passwords and Office sessions are never stored in the app.

An uninstall/reinstall marker prevents an iOS Keychain value from silently reappearing in a fresh app container. A lost or replacement phone requires the governed MFA reset and a fresh approved activation.

## Deployment variables

FastAPI requires these server-only values in production:

```text
APP_ENV=production
AUTH_MODE=first_party
OFFICE_REQUIRED_AAL=aal2
OFFICE_AUTH_SIGNING_SECRET=<server-only>
OFFICE_AUTH_BOOTSTRAP_SECRET=<server-only>
OFFICE_AUTH_BREAK_GLASS_SECRET=<offline-protected emergency secret>
OFFICE_AUTH_EMAIL_DOMAIN=kraviaprivatelimited.com
OFFICE_AUTH_MFA_MAX_FAILED_ATTEMPTS=5
OFFICE_AUTHENTICATOR_ACTIVATION_TTL_SECONDS=600
OFFICE_DEVICE_APPROVAL_REQUIRED=true
OFFICE_DEVICE_APPROVAL_TTL_SECONDS=900
OFFICE_DEVICE_TRUST_TTL_SECONDS=2592000
```

The managed native release injects `EXPO_PUBLIC_OFFICE_API_ORIGIN` from the HTTPS `KRAVIA_AUTHENTICATOR_API_ORIGIN` build secret. Do not expose any server-only identity secret in the mobile build.

## Acceptance checks

Before rollout, test: fresh credential activation; AAL2 owner/admin approval; pending claim produces no seed; approved claim works once; password → local TOTP → AAL2; replay rejection; repeated-invalid-code revocation; governed reset and replacement activation; biometric lock; screen-capture/app-switcher protection; safe-area layout on current iPhone and Android devices; and signed release distribution.

Also test: a fresh browser stays pending after a correct TOTP code; the same account holder can approve or decline through the notice; the browser opening the notice gains no session; only the original browser completes approval; and decline, expiry, action-token replay, completion-proof replay, and cross-user attempts are rejected and audited.
