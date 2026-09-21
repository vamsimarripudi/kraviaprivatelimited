# KRAVIA Authenticator — Production Android Signing

This repository never stores the production signing keystore or its passwords.

## Permanent signing identity

- Package: `com.kraviaprivatelimited.authenticator`
- Alias: `kravia-authenticator-production`
- Certificate algorithm: RSA 4096 / SHA256withRSA
- Certificate SHA-256: `10:08:95:8A:D5:19:1C:64:DA:A3:D4:03:C5:6B:68:7B:67:4C:26:91:3A:CB:8D:86:E2:EF:29:71:E8:64:7B:75`
- App version: `1.0.0`
- Android versionCode: `1`

## Required GitHub Actions secrets

Configure these four repository secrets before running the production workflow:

1. `KRAVIA_ANDROID_KEYSTORE_B64` — base64 of the permanent JKS keystore.
2. `KRAVIA_ANDROID_KEYSTORE_PASSWORD`
3. `KRAVIA_ANDROID_KEY_ALIAS` — must be `kravia-authenticator-production`.
4. `KRAVIA_ANDROID_KEY_PASSWORD`

The workflow is deliberately `workflow_dispatch` only. Normal pushes and pull requests do not create production-signed artifacts.

## Production build

Run **KRAVIA Authenticator production Android** manually after all normal quality gates are green. The workflow:

- checks Expo SDK compatibility,
- runs typecheck and tests,
- regenerates and verifies locked brand artwork,
- creates the native Android project,
- binds the release variant to the protected keystore,
- builds both AAB and APK,
- verifies the offline manifest boundary,
- verifies APK and AAB certificates against the pinned KRAVIA SHA-256 fingerprint,
- records SHA-256 file hashes and build evidence,
- deletes the runner keystore,
- uploads a short-retention production artifact.

## Distribution boundary

A successful production build does not mean Google Play release is complete. The AAB still requires upload/approval in the KRAVIA-controlled Google Play Console or the selected managed private-app distribution channel.

Never send the keystore or passwords by email, place them in Git, or store the keystore and its recovery/password material in the same uncontrolled location.
