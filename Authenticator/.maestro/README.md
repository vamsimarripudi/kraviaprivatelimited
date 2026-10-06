# KRAVIA Authenticator Maestro flows

These flows are free/local native UI acceptance helpers.

## Automated cold-launch boundary

```bash
maestro test .maestro/00-launch-lock.yaml
```

This clears app state and proves the app opens at the welcome screen, then reaches the corporate-credential screen for verified device activation.

The email-verification, owner/admin approval, and local-code screens are intentionally not automated with a live mailbox or real approval. They require a disposable, non-production identity and the local backend test fixtures.

Never commit production credentials or a verification code.
