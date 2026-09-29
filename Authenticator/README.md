# Authenticator

Private native second-factor application for KRAVIA Office and KRAVIA Finance.

## Activation model

Authenticator uses RFC 6238 TOTP (SHA-1, six digits, 30 seconds) for compatibility. A phone is activated through a protected, approval-based flow:

1. Install Authenticator on a company-approved phone and enable a device passcode with strong biometrics.
2. Sign in in the app with the corporate email address and Office password.
3. The app creates a short-lived phone activation request over HTTPS. It receives no Office session and no TOTP seed at this point.
4. A verified AAL2 Office owner or administrator reviews and approves the phone under **Office → Security**.
5. The approved phone claims a freshly generated seed exactly once and stores it in native secure storage.
6. Enter the current code in Office to promote the Office session from AAL1 to AAL2.

The controlled first-Founder bootstrap is the only exception: when the organisation has no verified MFA factor at all, the Founder can activate the first company phone. Every later activation requires AAL2 owner/admin approval.

Authenticator never stores the Office password, an Office browser session, a refresh token, or a cloud copy of the TOTP seed. Once the vault is activated, it generates codes locally without a network connection.

There is intentionally no QR scanner, setup key, seed export, cloud backup, recovery-code, or seed-sharing feature.

## Security boundary

- one explicit HTTPS activation client, configured only in a KRAVIA-managed build;
- short-lived, hashed phone-claim token; no raw claim token is stored on the server;
- audit events for activation request, approval, claim, MFA verification, replay block and reset;
- owner/admin approval requires an AAL2 Office session;
- native secure storage with `WHEN_PASSCODE_SET_THIS_DEVICE_ONLY`;
- strong biometric unlock and background lock;
- screen capture/recording protection and iOS app-switcher protection;
- no OTP clipboard export;
- reinstall detection removes an iOS Keychain value that survived an app uninstall;
- Expo OTA executable updates disabled and Android backup disabled.

## Lost or replacement phone

An authorised Office administrator resets MFA for the affected identity. That revokes the prior factor and applicable sessions. The replacement phone then follows the approval flow above and receives a fresh local seed. The old seed is never exported or reissued.

## Local development

```bash
cd Authenticator
npm ci
npx expo install --check
npm run typecheck
npm test
npx expo start
```

Set `EXPO_PUBLIC_OFFICE_API_ORIGIN` to the HTTPS origin of the first-party Office identity service for a managed development build. Do not point the app at an insecure origin or persist credentials in a local configuration file.

Use a physical device to validate SecureStore, biometrics, screen-capture protection, safe-area layout and the approval journey.

## Release checks

The Authenticator workflows run type checks, security/profile tests, Expo compatibility checks, native prebuild/export checks, and signed release verification. Production signing workflows require the `KRAVIA_AUTHENTICATOR_API_ORIGIN` repository secret to inject the managed HTTPS identity-service origin during the build.
