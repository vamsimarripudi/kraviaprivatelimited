# KRAVIA Authenticator

Private companion authenticator for KRAVIA Office and KRAVIA Finance.

## Security model

- Standard RFC 6238 TOTP; no proprietary OTP algorithm.
- KRAVIA Office issuer only.
- Six digits, 30-second period, HMAC-SHA1 as required by the interoperable TOTP profile.
- Enrollment secret is stored only in native secure storage.
- No cloud sync.
- No Office password inside the app.
- No network request is required to generate codes.
- Device authentication protects access to the app.
- Screen capture/recording is blocked while the app is open.
- App-switcher content is protected on iOS.
- Only one KRAVIA Office identity is stored per app installation.
- The secret is never shown again after enrollment.
- Lost/replaced phones require a governed Office MFA reset and fresh enrollment.

SHA-1 is used only inside the HMAC construction required by this TOTP profile, not as a general-purpose password or document hash.

## Enrollment

1. User signs into KRAVIA Office/Finance with corporate email and password.
2. First-party identity returns an AAL1 session.
3. Because all Office roles require AAL2, the login screen displays the KRAVIA Office enrollment QR when no factor exists.
4. User opens KRAVIA Authenticator and scans the QR.
5. App rejects any issuer other than `KRAVIA Office`.
6. App stores the TOTP secret in native secure storage.
7. User enters the current six-digit code in Office.
8. FastAPI verifies the TOTP and upgrades the session to AAL2.
9. Subsequent sign-ins require the current KRAVIA Authenticator code.

## Local development

```bash
cd Authenticator
npm install
npm run typecheck
npm test
npx expo start
```

Use a physical device for realistic biometric/SecureStore testing. Face ID is not fully testable in Expo Go; use a development build.

## Native builds

Internal Android APK:

```bash
npx eas build --platform android --profile preview
```

Production:

```bash
npx eas build --platform android --profile production
npx eas build --platform ios --profile production
```

The EAS project/account, Android signing key, Apple signing identity, Play Console and App Store Connect are external release credentials and are intentionally not committed.

## Test coverage

- RFC 6238 SHA-1 reference vectors.
- KRAVIA-only provisioning URI validation.
- Rejection of non-KRAVIA issuers.
- Enforcement of six-digit/30-second KRAVIA parameters.
- Manual setup-key fallback.

## Future hardening

TOTP remains the offline second factor. A later v2 can add device-bound challenge approval or passkeys, but it must not silently replace the existing fail-closed AAL2 policy.
