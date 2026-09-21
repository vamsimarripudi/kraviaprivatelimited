# KRAVIA Authenticator

Private companion authenticator for KRAVIA Office and KRAVIA Finance.

## What it is

KRAVIA Authenticator is an **offline RFC 6238 TOTP application**. It is not an Office client, password manager or approval application.

The server creates a cryptographically random TOTP seed during MFA enrollment. The phone stores that seed in native secure storage and derives the current six-digit code from the seed plus time. The six-digit code is therefore time-based, not a proprietary "random OTP" algorithm.

## Mandatory Office policy

KRAVIA Office requires AAL2 for every admitted role, including OWNER, DIRECTOR, ADMIN, MEMBER, FINANCE, CA, CS, LEGAL, HR, OPERATIONS, AUDITOR and PRODUCT_ADMIN.

Sign-in flow:

1. Office password is verified by the KRAVIA first-party identity service.
2. The password session starts at AAL1.
3. If no TOTP factor exists, Office displays a KRAVIA Authenticator QR/manual setup key.
4. The phone stores the TOTP seed locally.
5. The user enters the current six-digit code into Office.
6. FastAPI verifies the TOTP and upgrades the session to AAL2.
7. Protected Office/Finance routes reject the session until AAL2 is present.

## Security model

- Standard RFC 6238 TOTP; no proprietary OTP algorithm.
- Issuer locked to `KRAVIA Office`.
- Six digits, 30-second period, HMAC-SHA1 for TOTP interoperability.
- Corporate `@kraviaprivatelimited.com` account labels only.
- Enrollment secret stored in Expo SecureStore using device-bound/passcode-gated accessibility.
- Strong biometric enrollment required before the vault unlocks.
- Device passcode remains the OS fallback after supported biometric failures.
- Android automatic backup disabled.
- Android production INTERNET permission explicitly blocked.
- Microphone permission explicitly blocked.
- Camera permission exists only for QR enrollment.
- No Office password is stored.
- No network client exists in application code.
- No cloud sync.
- No OTP clipboard export.
- Screen capture/recording blocked while the app is active.
- App-switcher content protected.
- App locks immediately on background/inactive state.
- In-memory TOTP seed is cleared when the app locks.
- Manual setup key input is masked.
- A local non-secret installation marker is paired with a secure marker. If the app is uninstalled/reinstalled and iOS Keychain data survives, the stale TOTP enrollment is destroyed instead of silently resurrected.
- Only one KRAVIA Office identity is stored per application installation.
- Lost/replaced phones require governed Office MFA reset and fresh enrollment.

SHA-1 is used only inside the standards-defined HMAC construction for this TOTP profile. Passwords, documents and other integrity controls use stronger modern primitives elsewhere in KRAVIA Office.

## Enrollment

1. Install KRAVIA Authenticator on the employee's company-approved phone.
2. Enable a device passcode and strong fingerprint/Touch ID/Face ID.
3. Sign into KRAVIA Office/Finance with corporate email and password.
4. Scan the QR code shown after password acceptance, or use the manual setup key.
5. Verify the current six-digit code in Office.
6. Confirm Office opens only after the session reports AAL2.

The QR parser rejects non-KRAVIA issuers, HOTP, non-SHA1 profiles, non-six-digit profiles and periods other than 30 seconds.

## Local development

```bash
cd Authenticator
npm install --legacy-peer-deps
npm run typecheck
npm test
npx expo start
```

Use a physical device for realistic SecureStore/biometric testing. Face ID requires a development/native build rather than Expo Go for full behavior.

## CI and installable Android build

`.github/workflows/authenticator.yml` performs:

- dependency audit;
- TypeScript validation;
- RFC/provisioning/security tests;
- Android JS export;
- Android native prebuild;
- installable debug APK build;
- short-retention APK artifact upload.

The CI debug APK is for controlled internal/pilot installation only. A long-term employee rollout should use a release-signed Android build distributed through Google Play internal/private distribution or another approved company MDM channel.

## Production signing

Android/iOS release signing credentials are not committed to Git.

For EAS-based distribution, generate the deterministic native icon before invoking the build client:

```bash
npm run prepare:assets
npx eas build --platform android --profile preview

npm run prepare:assets
npx eas build --platform android --profile production

npm run prepare:assets
npx eas build --platform ios --profile production
```

Expo/EAS account ownership, Android signing key, Apple signing identity, Play Console and App Store Connect/TestFlight are external release credentials.

## Recovery

- Normal user MFA reset is an audited OWNER/ADMIN action within delegated authority.
- The affected user's sessions are revoked and the old phone's factor becomes invalid.
- The replacement phone must enroll a new random seed.
- Founder recovery uses the separate KRAVIA break-glass workflow and forces fresh MFA enrollment.

There is intentionally no seed export, QR re-display, cloud backup or recovery code inside the authenticator app.
