# KRAVIA Authenticator — release and rollout

## Release states

### Code-complete

The repository may be called code-complete only when:

- unit/security tests pass;
- backend quality gate passes;
- frontend tests/build pass;
- Android and iOS JS export pass;
- Android native build passes;
- release manifest security assertions pass;
- TOTP replay/attempt controls pass.

### Test-distribution ready

Android test distribution additionally requires:

- installable APK;
- zip alignment;
- valid APK signature;
- recorded SHA-256;
- explicit test-only signing notice.

A CI-test package signed by an ephemeral workflow key is not a production release.

### Production-distribution ready

Requires external KRAVIA-controlled credentials/channels:

Android:

- persistent KRAVIA signing identity;
- approved Google Play private/internal distribution or approved MDM;
- final signed package verification.

iOS:

- persistent Apple signing identity;
- approved TestFlight/App Store/private organizational/MDM distribution;
- final signed package verification.

## Versioning

For every production release:

- increment application version;
- increment Android `versionCode`;
- increment iOS `buildNumber`;
- tag the tested source commit;
- record package hash and signer identity;
- preserve the acceptance evidence.

## Rollout sequence

1. Engineering internal test.
2. Founder/administrator pilot.
3. Small controlled employee group.
4. Verify recovery/lost-device process.
5. Verify support procedure.
6. Expand to every Office/Finance role.
7. Enforce approved distribution URL from Office.

## Support procedure

Support must be able to handle:

- phone lost;
- phone replaced;
- app deleted/reinstalled;
- biometric/passcode changed;
- device time incorrect;
- TOTP rejected due to clock drift;
- stale or replayed code;
- locked AAL1 session after failed attempts;
- administrator MFA reset;
- Founder break-glass recovery.

Support must never request that an employee send the TOTP seed, QR image or Office password.

## Security incident rule

If a TOTP seed is suspected to be exposed:

1. reset MFA;
2. revoke active sessions as required;
3. enroll a new seed;
4. verify AAL2;
5. record the security event;
6. do not restore/reuse the compromised seed.
