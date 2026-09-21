# KRAVIA Office — first-party identity, MFA and KRAVIA Authenticator

Verified architecture: 21 Sep 2026

## Identity provider

KRAVIA Office and KRAVIA Finance use the KRAVIA-owned FastAPI/PostgreSQL identity subsystem.

Supabase provides managed PostgreSQL/control-plane and private Storage services. **Supabase Auth is not the active Office password, session or MFA provider.**

The browser uses same-origin Next.js BFF routes. Trusted identity operations are executed by the canonical FastAPI runtime.

No Office password, JWT, refresh token, invitation token, TOTP seed or recovery credential belongs in source control or public/mobile build variables.

## Mandatory assurance

Protected Office/Finance access requires **AAL2** for every admitted role:

- OWNER
- DIRECTOR
- ADMIN
- MEMBER
- FINANCE
- CA
- CS
- LEGAL
- HR
- OPERATIONS
- AUDITOR
- PRODUCT_ADMIN

There is no role-specific MFA bypass.

Login sequence:

1. FastAPI verifies the corporate email and Argon2id Office password.
2. A first-party session is issued at AAL1.
3. If no TOTP factor exists, Office starts KRAVIA Authenticator enrollment.
4. User scans the QR or enters the setup key in KRAVIA Authenticator.
5. User enters the current six-digit code in Office.
6. FastAPI validates the TOTP, replay counter and attempt policy.
7. Only a successful verification promotes that session to AAL2.
8. Workspace guards reject protected Office/Finance access until AAL2 is present.

## TOTP profile

KRAVIA uses the interoperable RFC 6238 profile:

- authenticator app: `KRAVIA Authenticator`
- issuer: `KRAVIA Office`
- algorithm: HMAC-SHA1
- digits: 6
- period: 30 seconds
- server verification window: current counter plus the configured narrow compatibility window

HMAC-SHA1 is used only inside the standards-defined TOTP construction. Passwords, document integrity and other cryptographic controls use separate modern primitives.

The OTP itself is not encrypted. It is short-lived proof. The **random TOTP seed** is the secret credential that is encrypted/protected.

## Seed generation and storage

### Server

- seed generated with a cryptographically secure random Base32 generator;
- encrypted before persistence;
- plaintext returned only during initial enrollment;
- verified enrollment cannot be silently re-enrolled;
- reset deletes the old factor state;
- MFA reset clears the accepted-counter replay state.

### Phone

KRAVIA Authenticator:

- stores only one KRAVIA identity per installation;
- stores the TOTP seed in native secure storage with device-only/passcode-gated accessibility;
- requires strong enrolled biometric protection before vault unlock;
- blocks screen capture while active;
- protects the iOS app-switcher view;
- locks on background/inactive transition;
- removes the in-memory account/seed on lock;
- masks manual setup-key input;
- has no seed export;
- has no cloud seed sync;
- has no OTP clipboard export;
- explicitly removes Android INTERNET and RECORD_AUDIO permissions;
- disables Android app backup;
- disables Expo OTA executable updates.

Because iOS Keychain values can survive an uninstall, the app pairs a non-secret application-container marker with a secure marker. A fresh/mismatched install destroys any surviving TOTP account and requires fresh Office enrollment.

## Replay and brute-force controls

A six-digit TOTP may be valid for its time counter, but a valid code must not become a reusable login token.

KRAVIA Office therefore records the last accepted TOTP counter per identity.

- a counter that has already been accepted is rejected;
- the event is recorded as `MFA_REPLAY_BLOCKED`;
- failed MFA attempts increment on the AAL1 session;
- after `OFFICE_AUTH_MFA_MAX_FAILED_ATTEMPTS` consecutive failures (default 5), that AAL1 session is revoked;
- successful MFA resets the session failure counter.

This replay protection is server-side and applies regardless of which standards-compatible TOTP implementation computed the digits.

## Enrollment

The Office login UI already implements mandatory enrollment.

When password authentication succeeds:

- AAL2 session → continue;
- AAL1 + existing factor → ask for the current KRAVIA Authenticator code;
- AAL1 + no factor → show KRAVIA Authenticator QR and an explicitly revealed manual setup-key fallback.

The manual seed is not shown by default.

The login screen links to `/office/authenticator` for installation and setup guidance.

## Recovery

Normal eligible-user MFA reset is an audited OWNER/ADMIN operation within delegated authority.

After reset:

- encrypted seed cleared;
- verified timestamp cleared;
- accepted TOTP counter cleared;
- affected sessions handled by the governed access/recovery flow;
- replacement phone must enroll a new random seed.

Founder recovery is excluded from ordinary delegated reset. It uses the separate Founder break-glass process and forces fresh MFA enrollment.

There is intentionally no seed backup, QR re-display, authenticator recovery code or seed-sharing workflow.

## Deployment variables

FastAPI:

```text
APP_ENV=production
AUTH_MODE=first_party
OFFICE_REQUIRED_AAL=aal2
OFFICE_AUTH_SIGNING_SECRET=<server-only>
OFFICE_AUTH_BOOTSTRAP_SECRET=<server-only>
OFFICE_AUTH_BREAK_GLASS_SECRET=<offline-protected emergency secret>
OFFICE_AUTH_EMAIL_DOMAIN=kraviaprivatelimited.com
OFFICE_AUTH_MFA_MAX_FAILED_ATTEMPTS=5
```

Next.js trusted server:

```text
OFFICE_API_ORIGIN=https://<accepted-office-api-origin>
OFFICE_SUPABASE_URL=https://<office-control-plane>.supabase.co
OFFICE_SUPABASE_SECRET_KEY=<server-only control-plane key>
```

Approved application-distribution links are optional server-side website variables:

```text
KRAVIA_AUTHENTICATOR_ANDROID_URL=
KRAVIA_AUTHENTICATOR_IOS_URL=
```

Leave them empty until a persistent KRAVIA-signed distribution channel is accepted.

## Mobile release boundary

The repository builds and tests an offline release-smoke Android APK.

CI verifies:

- locked dependency graph;
- Expo dependency compatibility;
- TypeScript;
- RFC/provisioning/security tests;
- Android and iOS JS export;
- native Android release build;
- generated release manifest has camera permission;
- generated release manifest has backup disabled;
- generated release manifest has no INTERNET permission;
- generated release manifest has no RECORD_AUDIO permission;
- APK SHA-256 is published with the short-retention artifact.

The release-smoke artifact is for controlled testing. Long-term employee distribution requires persistent KRAVIA-controlled Android/Apple signing identities and approved Play/TestFlight/App Store/MDM distribution.

## Production acceptance

Before every-role rollout:

1. physical Android strong-biometric/SecureStore test;
2. physical iPhone Face ID/Touch ID/SecureStore test;
3. screen-capture/app-switcher test;
4. background-lock test;
5. uninstall/reinstall → fresh enrollment test;
6. first-time password → enroll → TOTP → AAL2 test;
7. existing-factor password → TOTP → AAL2 test;
8. replay same accepted TOTP → rejected;
9. repeated invalid MFA → AAL1 session revoked;
10. governed MFA reset → old factor invalid → new phone enrolls;
11. final persistent app signing/distribution accepted.

If future policy requires cryptographic proof that a login came specifically from the official signed app, add device/app attestation and a per-login signed challenge or passkey layer. Do not invent proprietary OTP mathematics.
