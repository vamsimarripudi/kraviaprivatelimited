# Authenticator

Private native email-verification application for KRAVIA Office.

## Sign-in model

The app provides one direct sign-in journey:

1. Read the welcome note and enter the registered corporate email address and password.
2. KRAVIA sends a single-use six-digit verification code to that registered email address.
3. Enter the code before its animated expiry timer reaches zero.
4. On success, the managed app stores the issued session only in native secure storage and requires a new sign-in after 30 days.

Password plus a registered-email code is the required two-step sign-in. The retired phone-approval/TOTP flow is not shown by this app.

The app never stores the Office password or email code. It holds only a validated server-issued session in native secure storage.

There is intentionally no QR scanner, setup key, local TOTP seed, code export, cloud backup, recovery code, or seed-sharing feature.

## Security boundary

- one explicit HTTPS email-verification client, configured only in a KRAVIA-managed build;
- short-lived, single-use email-code challenge and no local credential persistence;
- native secure storage with `WHEN_PASSCODE_SET_THIS_DEVICE_ONLY` for the validated session;
- screen-capture protection and iOS app-switcher protection;
- no OTP clipboard export;
- application updates retire the previous local TOTP vault;
- Expo OTA executable updates disabled and Android backup disabled.

## Expired session or replacement phone

Open the app and sign in again with the registered email and password. KRAVIA sends a new email verification code. No phone seed, QR code, or administrator approval is used.

## Local development

```bash
cd Authenticator
npm ci
npx expo install --check
npm run typecheck
npm test
npx expo start
```

Set `EXPO_PUBLIC_OFFICE_API_ORIGIN` to the HTTPS origin of the first-party Office identity service for a managed development build. The server-side email delivery provider must also be configured before end-to-end verification can send a code. Do not point the app at an insecure origin or persist credentials in a local configuration file.

Use a physical device to validate SecureStore, screen-capture protection, safe-area layout, the email delivery path, expiry timer, and the 30-day session expiry.

## Release checks

The Authenticator workflows run type checks, security/profile tests, Expo compatibility checks, native prebuild/export checks, and signed release verification. Production signing workflows require the `KRAVIA_AUTHENTICATOR_API_ORIGIN` repository secret to inject the managed HTTPS identity-service origin during the build.
