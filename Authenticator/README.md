# Authenticator

Private native second-factor application for KRAVIA Office.

## Phone activation

Authenticator uses RFC 6238 TOTP (SHA-1, six digits, 30 seconds) only after a protected phone approval:

1. Read the welcome note, then enter registered corporate credentials.
2. Enter the single-use six-digit code sent to the registered email address.
3. The app stores a scoped mobile verification session in native secure storage. It cannot access KRAVIA Office APIs or replace an Office browser session.
4. On a new phone, request activation. A verified AAL2 Office owner or administrator approves the phone in **Office → Security**.
5. The approved phone claims a fresh seed exactly once and stores it only in native secure storage.
6. Unlock the app with strong biometrics to view the local rotating code. Enter that code in Office to complete mandatory MFA.

The mobile verification session expires after 30 days. Re-verification is then required before the local vault can be unlocked again. The TOTP seed is never sent to, copied from, or backed up through a cloud service.

The controlled first-Founder bootstrap is the only approval exception: when no company MFA factor exists, the Founder can activate the first phone. Every later activation requires a verified Office owner or administrator.

There is intentionally no QR scanning, setup-key entry, manual account creation, camera permission, code clipboard export, seed export, cloud backup, or recovery-code feature.

## Security boundary

- One HTTPS-only client for email verification and device activation.
- A 30-day mobile session with the server-enforced `AUTHENTICATOR_ACTIVATION` purpose, not general Office access.
- Owner/admin approval before a seed is issued.
- Short-lived, hashed phone claim token; no raw claim token is stored server-side.
- Native secure storage with `WHEN_PASSCODE_SET_THIS_DEVICE_ONLY`.
- Strong biometric unlock, background lock, screenshot protection, and iOS app-switcher protection.
- Reinstall detection clears a Keychain item that could survive an iOS uninstall.
- Android backup disabled and Expo OTA executable updates disabled.

## Lost or replacement phone

An authorised Office administrator resets MFA for the identity. That revokes the prior factor and applicable sessions. The replacement phone then follows the approval flow and receives a fresh seed. The old seed is never exported or reissued.

## Local development

```bash
cd Authenticator
npm ci
npx expo install --check
npm run typecheck
npm test
npx expo start
```

Set `EXPO_PUBLIC_OFFICE_API_ORIGIN` to the HTTPS origin of the first-party Office identity service. A configured email provider is required for the credential-email verification step. Never put Office credentials, email codes, claim tokens, or seeds in source-controlled configuration.

Use a physical device to validate SecureStore, biometric unlock, screen-capture protection, safe-area layout, email verification, the approval journey, and the 30-day re-verification boundary.

## Release checks

The Authenticator workflows run type checks, security/profile tests, Expo compatibility checks, native prebuild/export checks, and signed release verification. Production signing requires `KRAVIA_AUTHENTICATOR_API_ORIGIN` to inject the managed HTTPS Office identity-service origin.
