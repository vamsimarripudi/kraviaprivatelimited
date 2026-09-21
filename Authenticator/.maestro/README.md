# KRAVIA Authenticator Maestro flows

These flows are free/local native UI acceptance helpers.

## Automated cold-launch boundary

```bash
maestro test .maestro/00-launch-lock.yaml
```

This clears app state and proves the authenticator opens locked.

## After-unlock flows

KRAVIA intentionally has no production biometric bypass. Files ending in `.after-unlock.yaml` must be run after the tester unlocks the app using the operating-system biometric/device-authentication prompt.

For enrollment flows, start from a clean installation, unlock the app, confirm **Enroll this phone** is visible, then run the flow without relaunching the app.

The test identity/secret are non-production fixtures:

- account: `qa@kraviaprivatelimited.com`
- Base32 seed: `JBSWY3DPEHPK3PXP`

Never commit or substitute a production enrollment seed.
