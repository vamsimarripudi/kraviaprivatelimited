# KRAVIA Authenticator — iOS Production Signing

The repository does not store Apple signing certificates, private keys, provisioning profiles, or App Store Connect credentials.

## App identity

- Product: KRAVIA Authenticator
- Bundle identifier: `com.kraviaprivatelimited.authenticator`
- Version: `1.0.0`
- Build number: `1`
- Distribution certificate owner: KRAVIA PRIVATE LIMITED

## Certificate request

A KRAVIA-controlled PKCS#10 CSR and encrypted private key are prepared outside Git. Upload the CSR in the KRAVIA Apple Developer account when creating an **Apple Distribution** certificate.

After Apple issues the certificate:

1. Import the Apple-issued certificate together with the matching KRAVIA private key.
2. Export the complete signing identity as a password-protected `.p12`.
3. Register/confirm the App ID `com.kraviaprivatelimited.authenticator`.
4. Create an App Store / Custom App / approved enterprise provisioning profile for that bundle ID.
5. Keep the certificate/private key/profile outside Git.

## Required GitHub Actions secrets

Configure:

- `KRAVIA_IOS_DISTRIBUTION_P12_B64` — base64 of the Apple Distribution `.p12`.
- `KRAVIA_IOS_DISTRIBUTION_P12_PASSWORD`
- `KRAVIA_IOS_PROVISION_PROFILE_B64` — base64 of the approved `.mobileprovision`.
- `KRAVIA_IOS_TEAM_ID`

The workflow validates that the provisioning profile Team ID and application identifier match the configured KRAVIA values.

## Production workflow

Run **KRAVIA Authenticator production iOS** manually. It never runs on push or pull request.

The workflow:

- installs the locked Expo SDK 57 graph,
- runs TypeScript and Authenticator tests,
- reconstructs the approved brand artwork,
- generates the native iOS project,
- imports the Apple Distribution identity into a temporary keychain,
- validates the provisioning profile,
- builds a Release archive,
- exports the signed IPA,
- verifies bundle ID, version, build number, Team ID, embedded profile and code signature,
- records SHA-256 and signature evidence,
- deletes the temporary keychain/signing files,
- uploads the signed IPA with short retention.

## Apple provider boundary

Creating the Apple Distribution certificate, provisioning profile, App Store Connect app record, TestFlight upload, Custom App assignment, or enterprise/MDM publication requires the KRAVIA-controlled Apple Developer/App Store Connect account.

A successful GitHub IPA build is production-signing evidence. It is not evidence of App Store/TestFlight approval or distribution.
