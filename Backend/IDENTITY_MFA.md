# KRAVIA Office — first-party identity and KRAVIA Authenticator

Verified architecture: 21 Sep 2026

## Identity authority

KRAVIA Office and KRAVIA Finance use the KRAVIA-owned FastAPI/PostgreSQL identity subsystem.

Supabase is the managed PostgreSQL/control-plane and private Storage provider. **Supabase Auth is not the active Office password, session or MFA provider.**

The browser talks only to the same-origin Next.js Office BFF. The BFF forwards trusted identity operations to the canonical FastAPI runtime.

## Mandatory sign-in assurance

Every admitted Office role must reach **AAL2** before protected Office or Finance workspace access.

Covered roles include:

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

Canonical flow:

1. user enters KRAVIA corporate email and Office password;
2. FastAPI verifies the Argon2id password and creates an AAL1 first-party session;
3. if no MFA factor exists, Office starts KRAVIA Authenticator enrollment;
4. user scans the enrollment QR or enters the manual setup key in KRAVIA Authenticator;
5. user enters the current six-digit code back into Office;
6. FastAPI verifies the TOTP and promotes the current session to AAL2;
7. protected Office/Finance routes reject the session until AAL2 is present.

## KRAVIA Authenticator

KRAVIA Authenticator is a separate native mobile application under `Authenticator/`.

It is intentionally **not** an Office client:

- it does not store the Office password;
- it does not receive Office access/refresh tokens;
- it does not call KRAVIA APIs to generate codes;
- it does not synchronize seeds to cloud storage;
- it has no OTP clipboard-export feature;
- Android production configuration explicitly blocks INTERNET permission;
- the camera is used only for QR enrollment.

The app accepts only the KRAVIA Office TOTP profile:

- URI type: `otpauth://totp`
- issuer: `KRAVIA Office`
- algorithm: HMAC-SHA1
- digits: 6
- period: 30 seconds
- account: authorised `@kraviaprivatelimited.com` identity

HMAC-SHA1 is used only for the RFC 6238 interoperable TOTP construction. Password hashing, document hashing and other integrity controls use separate modern primitives.

## Seed generation and storage

The TOTP seed is generated server-side using a cryptographically secure random Base32 generator.

Server side:

- the seed is encrypted before database storage;
- the plaintext seed is returned only during initial enrollment;
- a verified factor cannot be silently re-enrolled;
- MFA reset removes the old encrypted seed and revokes affected access according to the governed recovery path.

Phone side:

- the seed is stored in native SecureStore/Keychain/Keystore;
- storage is device-bound/passcode-gated;
- Android app backup is disabled;
- the app requires strong enrolled biometrics before vault unlock;
- screen capture is blocked while the app is active;
- the app locks when backgrounded;
- the in-memory seed is cleared on lock;
- manual setup-key entry is masked;
- a reinstall boundary prevents a surviving iOS Keychain seed from being silently resurrected into a fresh app installation.

The seed is never written to logs, source control, analytics or ordinary application storage.

## TOTP verification

The phone computes:

`TOTP = HOTP(seed, floor(unix_time / 30))`

and displays the six-digit result.

FastAPI independently computes the same RFC 6238 value from the encrypted server-side seed and accepts the configured narrow time window. A successful verification sets the current first-party session to `aal2`.

The OTP itself is short-lived proof. It is not encrypted and does not need to be; the security property comes from possession of the secret seed and the time window. The seed is the credential that must remain protected.

## Enrollment UX

The Office login screen already implements the required sequence.

When the password succeeds:

- an already-verified AAL2 session continues;
- an account with an enrolled factor moves to six-digit verification;
- an account without a factor receives the QR/manual key and is told to use KRAVIA Authenticator.

The login screen links to `/office/authenticator` for installation and setup guidance.

## Recovery and replacement phones

Normal MFA reset is an audited OWNER/ADMIN action within delegated authority.

After MFA reset:

- the old seed is no longer valid;
- affected sessions are revoked by the governed access/recovery flow;
- the replacement phone must enroll a newly generated seed.

Founder/OWNER recovery is not delegated to ordinary administrators. It uses the separate Founder break-glass recovery flow and forces fresh MFA enrollment.

There is intentionally no seed export, QR re-display, cloud backup or authenticator recovery code.

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
```

Next.js trusted server:

```text
OFFICE_API_ORIGIN=https://<accepted-office-api-origin>
OFFICE_SUPABASE_URL=https://<office-control-plane>.supabase.co
OFFICE_SUPABASE_SECRET_KEY=<server-only control-plane key>
```

No authenticator seed, OTP, Office password or first-party token belongs in a public/mobile build variable.

## Distribution

The repository CI builds an installable Android internal APK for controlled pilot installation.

Production employee rollout should use a release-signed Android/iOS build through an approved company distribution channel such as:

- Google Play internal/private distribution or MDM for Android;
- TestFlight/App Store/private MDM distribution for iOS.

Store accounts and signing identities are external release credentials and are never committed to Git.

## Acceptance checklist

Before company-wide rollout:

- RFC 6238 vectors pass;
- KRAVIA-only QR parser tests pass;
- Android INTERNET permission is absent from the generated application manifest;
- Android backup is disabled;
- strong biometric gate is tested on a physical device;
- screenshot/recording protection is tested on a physical device;
- background → foreground requires unlock again;
- uninstall/reinstall requires fresh Office enrollment;
- one test identity completes password → enroll → TOTP → AAL2;
- one existing identity completes password → TOTP → AAL2;
- MFA reset invalidates the old phone and permits fresh enrollment;
- lost-phone recovery procedure is rehearsed;
- Android release signing and iOS signing/distribution are accepted before general employee deployment.
