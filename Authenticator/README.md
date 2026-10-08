# Authenticator

Private native device-security application for KRAVIA Office.

## Phone activation

Authenticator binds each KRAVIA identity to one explicitly trusted device. Every sign-in starts with corporate credentials and a registered-email verification code:

1. Read the welcome note, then enter registered corporate credentials.
2. Enter the single-use six-digit code sent to the registered email address.
3. A new device is held pending. The registered mailbox receives one secure review link with the device, observed source address, and installation/sign-in steps.
4. On that KRAVIA review page, select **Trust this device** only for the device that started the request. The server records that device as trusted and revokes every earlier trusted device and its active session.
5. Select **Cancel and block sign-in** for an unrecognised request. The pending device session is revoked immediately.
6. The app checks the first-party decision endpoint in the background and continues automatically after a mailbox decision; it never receives an approval link or makes a trust decision itself.
7. The trusted device claims a fresh TOTP seed once, stores it only in native secure storage, and shows a local six-digit code with a 30-second change timer. A replacement phone rotates that seed, so the prior phone's code stops working.
8. Unlock the app with strong biometrics to view the protected rotating-code home. The app cannot access general KRAVIA Office APIs or replace an Office browser session.

The mobile verification session expires after 30 days. Re-verification is then required before the device-security home can be unlocked. No owner, administrator, founder, or another employee can approve a device on someone else’s behalf; only the registered mailbox can trust or ignore its exact sign-in request.

There is intentionally no QR scanning, manual secret entry, manual account creation, camera permission, code clipboard export, seed export, cloud backup, or recovery-code feature.

## Security boundary

- One HTTPS-only client for credential verification, email codes, and device decisions.
- A 30-day mobile session with the server-enforced `AUTHENTICATOR_ACTIVATION` purpose, not general Office access.
- A pending device receives no usable refresh or access token until the registered mailbox trusts it.
- One trusted device per identity, enforced both by the completion transaction and a partial unique database index.
- A fresh, one-time claim rotates the local TOTP factor after a registered-mailbox Trust decision; the old phone's local code becomes invalid.
- High-entropy device proofs are hashed server-side and stored only in native protected storage on the trusted device.
- Native secure storage with `WHEN_PASSCODE_SET_THIS_DEVICE_ONLY`.
- Strong biometric unlock, background lock, screenshot protection, and iOS app-switcher protection.
- Reinstall detection clears a Keychain item that could survive an iOS uninstall.
- Android backup disabled and Expo OTA executable updates disabled.

## Lost or replacement device

Sign in on the replacement device with corporate credentials and the registered-email code, then trust that exact request from the mailbox. Trusting it revokes the previous device and its active session. Ignoring an unexpected request revokes only that pending session.

## Local development

```bash
cd Authenticator
npm ci
npx expo install --check
npm run audit:high
npm run typecheck
npm test
npx expo start
```

Set `EXPO_PUBLIC_OFFICE_API_ORIGIN` to the HTTPS origin of the first-party Office identity service. A configured email provider is required for the credential-email verification and Trust/Ignore steps. Never put Office credentials, email codes, device proofs, or session tokens in source-controlled configuration.

Use a physical device to validate SecureStore, biometric unlock, screen-capture protection, safe-area layout, email verification, the Trust/Ignore journey, one-device revocation, and the 30-day re-verification boundary.

## Release checks

The Authenticator workflows run type checks, security/profile tests, Expo compatibility checks, a fail-closed high-severity audit policy, native prebuild/export checks, and signed release verification. The audit policy permits only explicitly documented upstream build-tool advisories and expires on its review date; a new or changed high-severity leaf finding fails the workflow. Production signing requires `KRAVIA_AUTHENTICATOR_API_ORIGIN` to inject the managed HTTPS Office identity-service origin.
