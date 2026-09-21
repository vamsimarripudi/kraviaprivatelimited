# KRAVIA Authenticator

Private native second-factor application for KRAVIA Office and KRAVIA Finance.

## Authentication model

KRAVIA Authenticator uses **RFC 6238 TOTP**, not a proprietary "encrypted OTP" algorithm.

KRAVIA Office generates a cryptographically random Base32 seed during MFA enrollment. The server encrypts that seed at rest. The phone stores the same seed in native secure storage and derives the current six-digit code from the seed and the current 30-second time counter.

The six-digit code is deliberately short-lived standard proof. The **seed** is the credential that must remain secret.

Profile:

- issuer: `KRAVIA Office`
- type: TOTP
- HMAC: SHA-1 for RFC interoperability
- digits: 6
- period: 30 seconds
- account label: authorised `@kraviaprivatelimited.com` identity

The backend additionally rejects reuse of an already accepted TOTP counter and revokes an AAL1 session after the configured number of consecutive bad MFA attempts.

## Mandatory Office policy

Every admitted Office/Finance role must complete AAL2 MFA:

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

Canonical login:

1. enter KRAVIA corporate email and first-party Office password;
2. password success creates an AAL1 session only;
3. if no factor exists, Office displays the KRAVIA Authenticator QR/manual setup key;
4. scan the QR or enter the setup key in this app;
5. enter the current six-digit code in Office;
6. FastAPI verifies the TOTP, replay counter and attempt policy;
7. only successful verification promotes the session to AAL2 and opens protected Office/Finance routes.

## Phone-side security boundary

The app is intentionally an **offline credential vault**, not an Office client.

- no Office password;
- no Office access/refresh tokens;
- no Office API calls to generate codes;
- Android INTERNET permission explicitly removed from the final manifest;
- Android RECORD_AUDIO permission removed;
- Expo OTA executable updates disabled;
- camera only for enrollment QR scanning;
- no cloud seed sync;
- no OTP clipboard export;
- strong enrolled biometric required before vault unlock;
- device passcode remains OS fallback after supported biometric authentication;
- TOTP seed stored with `WHEN_PASSCODE_SET_THIS_DEVICE_ONLY`;
- screen capture/recording blocked while active;
- iOS app-switcher content protected;
- app locks on background/inactive transition;
- in-memory account/seed cleared on lock;
- manual setup key input masked;
- one KRAVIA identity per app installation;
- stored account is validated before use;
- reinstall boundary prevents an iOS Keychain seed from silently reappearing in a fresh app container.

### Reinstall boundary

iOS Keychain values can survive an uninstall. KRAVIA Authenticator therefore pairs:

- a non-secret marker in the application document container; and
- a marker in secure storage.

If the local marker is missing or the pair does not match, any surviving TOTP account is deleted and the phone must enroll again through Office.

The marker is not an authentication credential and does not need cryptographic secrecy.

## Server-side MFA hardening

KRAVIA Office maintains the authoritative MFA state.

The current first-party backend includes:

- encrypted MFA seed storage;
- mandatory AAL2;
- one-time accepted-counter tracking to stop replay of a code that was already used;
- bounded ±1 time-window compatibility;
- failed-MFA attempt counting;
- AAL1 session revocation after repeated bad MFA attempts;
- audited enrollment, verification, replay-block and reset events;
- governed OWNER/ADMIN reset for eligible users;
- separate Founder break-glass recovery that forces fresh MFA enrollment.

## Enrollment

1. Install KRAVIA Authenticator on a company-approved phone.
2. Enable a device passcode and strong fingerprint, Touch ID or Face ID.
3. Sign into KRAVIA Office/Finance.
4. Scan the QR shown after password acceptance.
5. If scanning is impossible, reveal the manual setup key in Office and enter it into the masked setup-key field.
6. Enter the current six-digit code into Office.
7. Confirm that Office opens only after the session reaches AAL2.

The QR parser rejects:

- non-`KRAVIA Office` issuers;
- HOTP;
- non-SHA1 TOTP parameters;
- non-six-digit profiles;
- periods other than 30 seconds;
- non-corporate account labels.

## Lost/replaced phone

Never export or copy the old seed.

1. authorised Office administrator performs the governed MFA reset;
2. old factor state is removed and applicable sessions are revoked;
3. replacement phone installs KRAVIA Authenticator;
4. user receives a newly generated seed and enrolls again.

Founder recovery uses the separate break-glass process and also requires a fresh authenticator enrollment.

There is intentionally no seed export, QR re-display, cloud backup, app recovery code or seed-sharing feature.

## Local development

```bash
cd Authenticator
npm ci
npx expo install --check
npm run typecheck
npm test
npm run prepare:assets
npx expo start
```

Use physical devices for SecureStore, biometric, screen-capture and reinstall testing. Face ID requires a native/development build for full behavior.

## CI

`.github/workflows/authenticator.yml` runs:

- locked `npm ci`;
- Expo SDK compatibility check;
- dependency audit;
- TypeScript;
- RFC/provisioning/security tests;
- deterministic 1024×1024 KRAVIA icon generation;
- Android JS export;
- iOS JS export;
- Android native prebuild;
- release-smoke APK build;
- merged release-manifest verification proving:
  - camera permission present;
  - backup disabled;
  - INTERNET permission absent;
  - microphone permission absent;
- test-only APK zip alignment;
- ephemeral per-run CI signing so the artifact can be installed on a physical Android device;
- APK signature verification plus SHA-256 generation;
- short-retention CI artifact publication with an explicit test-only notice.

The CI-test APK is installable for controlled physical-device validation. Its signing key is generated inside that workflow run and discarded immediately, so a later CI-test build is **not** an upgrade path: uninstall the earlier CI-test package before installing a build from a different run.

The CI-test signature is never a production trust identity. Long-term employee distribution must use the persistent KRAVIA-controlled Android signing identity.

## Production distribution

Before EAS or store builds, generate the deterministic native assets:

```bash
npm run prepare:assets
npx eas build --platform android --profile preview

npm run prepare:assets
npx eas build --platform android --profile production

npm run prepare:assets
npx eas build --platform ios --profile production
```

Production rollout requires external signing/distribution credentials:

- KRAVIA-controlled Android signing identity;
- Google Play internal/private distribution or approved MDM;
- Apple signing identity;
- TestFlight/App Store/private MDM channel.

The persistent signing identity matters because it prevents an unrelated build from replacing the installed authenticator through the normal update channel.

## Acceptance before every-role rollout

- RFC 6238 vectors pass;
- dependency graph locked and audited;
- Expo compatibility check passes;
- Android release manifest contains no INTERNET or RECORD_AUDIO permission;
- Android backup disabled;
- CI-test APK is zip-aligned, signed and independently verified by `apksigner`;
- production package is signed by the persistent KRAVIA-controlled release identity rather than the ephemeral CI identity;
- strong biometric unlock tested on physical Android and iPhone;
- screen capture protection tested;
- background/foreground requires unlock;
- reinstall requires fresh enrollment;
- manual setup key remains hidden in Office until explicitly revealed;
- first-time account completes password → enrollment → TOTP → AAL2;
- existing factor completes password → TOTP → AAL2;
- replaying the same accepted TOTP is rejected;
- five bad MFA codes revoke the AAL1 session under current server policy;
- MFA reset invalidates the old factor and replacement phone enrolls a new seed;
- recovery procedure rehearsed;
- final Android/iOS production signing/distribution accepted.

## Future direction

TOTP remains the offline second factor.

If KRAVIA later requires cryptographic proof that the **official signed app** approved each login, add device/app attestation plus a per-login signed challenge (for example Play Integrity/App Attest or passkeys). A standards-compliant TOTP server cannot distinguish which compatible authenticator generated a valid code if someone has copied the underlying seed.

Do not replace RFC 6238 with proprietary OTP mathematics.


## Native UI automation

Free/local native UI acceptance helpers live under `.maestro/`.

The cold-launch flow is fully automated and proves the application starts behind the local-authentication boundary:

```bash
maestro test .maestro/00-launch-lock.yaml
```

Flows suffixed with `.after-unlock.yaml` intentionally require the tester to satisfy the operating-system biometric/device-authentication prompt first. KRAVIA does not add a production biometric bypass for automation.

Examples:

```bash
maestro test .maestro/10-manual-enrollment.after-unlock.yaml
maestro test .maestro/11-invalid-enrollment.after-unlock.yaml
maestro test .maestro/20-lock-command.after-unlock.yaml
maestro test .maestro/30-remove-cancel.after-unlock.yaml
```

The manual-enrollment flow uses the non-production test identity `qa@kraviaprivatelimited.com` and RFC-compatible test secret `JBSWY3DPEHPK3PXP`. Never replace it with a production enrollment seed in source control.

Maestro is a UI runner, not a substitute for the existing RFC/security unit tests or final physical-device biometric, screenshot-protection and reinstall acceptance.
