# KRAVIA Authenticator — physical-device acceptance

Use this checklist before employee rollout.

## Android

- [ ] Production/test package installs successfully.
- [ ] Package name is `com.kraviaprivatelimited.authenticator`.
- [ ] Device passcode is required.
- [ ] Strong biometric is enrolled.
- [ ] App does not expose Office password fields.
- [ ] App unlock requires local authentication.
- [ ] QR enrollment opens camera only when requested.
- [ ] A valid KRAVIA QR enrolls successfully.
- [ ] A non-KRAVIA QR is rejected.
- [ ] Manual setup key entry is masked.
- [ ] Current six-digit TOTP matches the backend.
- [ ] TOTP changes at the expected period.
- [ ] Code cannot be copied from an app action.
- [ ] Screen capture/recording is blocked while sensitive UI is active.
- [ ] App backgrounding locks the authenticator.
- [ ] Returning to the app requires local authentication.
- [ ] Airplane mode does not stop TOTP generation after enrollment.
- [ ] Android app has no INTERNET permission.
- [ ] Android app has no RECORD_AUDIO permission.
- [ ] Android backup is disabled.
- [ ] Reinstall/clear-state does not silently restore the prior enrollment.
- [ ] Lost-device reset makes the old enrollment unusable.
- [ ] Fresh seed enrollment succeeds after reset.
- [ ] Password → TOTP → AAL2 opens KRAVIA Office.
- [ ] Five invalid MFA attempts (current policy) revoke the AAL1 session.
- [ ] Reusing an accepted TOTP is rejected.

## iPhone

- [ ] Production/test package installs successfully.
- [ ] Bundle identifier is `com.kraviaprivatelimited.authenticator`.
- [ ] Device passcode is required.
- [ ] Face ID/Touch ID is enrolled.
- [ ] App unlock requires local authentication.
- [ ] QR enrollment works.
- [ ] Manual setup works.
- [ ] Current TOTP matches the backend.
- [ ] App backgrounding locks the authenticator.
- [ ] Screen capture/app-switcher protection behaves as designed.
- [ ] Offline TOTP continues to work.
- [ ] Delete/reinstall does not silently resurrect an old Keychain enrollment.
- [ ] Fresh enrollment is required after reinstall/reset.
- [ ] Password → TOTP → AAL2 opens KRAVIA Office.
- [ ] Replayed TOTP is rejected.

## Web/BFF

- [ ] Enrollment QR is visible only after valid first-factor authentication.
- [ ] Manual setup key is hidden by default.
- [ ] MFA enrollment/verification responses use `Cache-Control: no-store`.
- [ ] Cross-origin mutation is rejected.
- [ ] AAL1 cannot open protected Office/Finance routes.
- [ ] AAL2 opens only the user's authorised workspace.
- [ ] Reset/recovery does not create an MFA bypass.

## Production signing

- [ ] Android production package uses a persistent KRAVIA-controlled signing identity.
- [ ] iOS production package uses a persistent KRAVIA-controlled Apple signing identity.
- [ ] CI-test ephemeral key is not used for employee production rollout.
- [ ] Signing credentials are not committed to Git.
- [ ] Distribution URL in Office points only to approved KRAVIA-controlled distribution.
