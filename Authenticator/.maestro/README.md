# KRAVIA Authenticator Maestro flows

These flows are free/local native UI acceptance helpers.

## Automated cold-launch boundary

```bash
maestro test .maestro/00-launch-lock.yaml
```

This clears app state and proves the app opens at the welcome screen, then reaches the corporate-credential screen.

The verification-code screen is intentionally not automated with a live mailbox. It requires a disposable, non-production email identity and a real server-issued code after email delivery is configured.

Never commit production credentials or a verification code.
