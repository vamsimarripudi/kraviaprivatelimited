# KRAVIA Authenticator — architecture and security

## Purpose

KRAVIA Authenticator is the private second-factor application for KRAVIA Office and KRAVIA Finance.

The security boundary is intentionally split:

1. KRAVIA Office verifies the user's first-party password and creates an AAL1 session.
2. KRAVIA Authenticator stores the enrolled TOTP seed on the phone and generates the current code locally.
3. The first-party backend verifies the code, enforces replay/attempt controls and promotes the existing session to AAL2.
4. Protected Office/Finance routes require AAL2.

## TOTP profile

- Standard: RFC 6238
- Issuer: `KRAVIA Office`
- Algorithm: HMAC-SHA1 for TOTP interoperability
- Digits: 6
- Period: 30 seconds
- Account label: authorised KRAVIA corporate identity
- Validity tolerance: bounded server-side time window
- Seed generation: server-side cryptographically random Base32
- Seed persistence on server: encrypted at rest
- Seed persistence on phone: native secure storage

The six-digit code is not the long-term secret. The TOTP seed is the credential that must remain protected.

## Mandatory AAL2 policy

The MFA boundary applies to every admitted role:

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

## Phone-side security controls

The native application currently enforces:

- no Office password storage;
- no Office access token or refresh token storage;
- no network dependency for code generation;
- Android INTERNET permission blocked;
- Android microphone permission blocked;
- camera permission limited to QR enrollment;
- Expo OTA executable updates disabled;
- strong biometric/device authentication before vault access;
- secure-store accessibility tied to a configured device passcode;
- screen capture/recording protection;
- app-switcher protection where supported;
- automatic lock when the app backgrounds;
- in-memory account/seed clearing when locked;
- masked manual setup-key entry;
- no OTP clipboard export;
- one KRAVIA account per app installation;
- stored-account schema/issuer/account validation;
- reinstall boundary preventing a surviving iOS Keychain seed from silently reappearing in a fresh application container.

Android package:

`com.kraviaprivatelimited.authenticator`

iOS bundle identifier:

`com.kraviaprivatelimited.authenticator`

## Server-side MFA controls

The first-party backend owns authoritative MFA state.

Current controls include:

- encrypted TOTP seed storage;
- mandatory AAL2 for protected routes;
- database-atomic accepted-counter claim;
- rejection of replayed or older accepted TOTP counters;
- bounded TOTP time-window validation;
- atomic invalid-attempt counting;
- session revocation after the configured MFA-attempt limit;
- fail-closed protection if session state changes during MFA verification;
- stale AAL1 tokens cannot mutate MFA state after AAL2 promotion;
- audited enrollment, verification, replay-block, revocation and reset events;
- OWNER/ADMIN governed reset for eligible accounts;
- separate Founder break-glass recovery;
- reset/recovery requires fresh authenticator enrollment.

## Enrollment sequence

1. User signs into KRAVIA Office/Finance with corporate email and KRAVIA password.
2. Backend returns AAL1 only.
3. If no verified factor exists, Office creates a new TOTP seed and displays a KRAVIA QR code.
4. User scans the QR using KRAVIA Authenticator.
5. The app rejects a wrong issuer, HOTP, unsupported algorithm, wrong digit count, wrong period or non-corporate account.
6. The app stores the seed in native secure storage.
7. User types the current six-digit code into Office.
8. Backend atomically claims the TOTP counter and promotes the session from AAL1 to AAL2.
9. Office opens the authorised workspace.

## Lost/replaced/reinstalled phone

Do not copy or export the old seed.

Required procedure:

1. authorised administrator performs the governed MFA reset;
2. active sessions for the affected identity are revoked as defined by the backend workflow;
3. replacement/reinstalled phone opens KRAVIA Authenticator;
4. Office generates a new seed;
5. user enrolls the new device and proves the new TOTP;
6. Office issues/continues only with AAL2 after verification.

## Trust boundaries

### Allowed

- standard TOTP calculation on device;
- QR scanning during enrollment;
- platform secure storage;
- platform device authentication;
- same-origin KRAVIA Office BFF for enrollment/verification;
- persistent KRAVIA-controlled production signing identity.

### Forbidden

- seed export;
- cloud seed sync;
- copying OTP to clipboard;
- bypassing MFA for any role;
- direct browser database access to MFA material;
- exposing enrollment secret in logs;
- treating an ephemeral CI signing identity as production;
- replacing RFC 6238 with proprietary OTP mathematics.
