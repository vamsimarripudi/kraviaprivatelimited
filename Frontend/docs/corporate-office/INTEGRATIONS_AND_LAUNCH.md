# Integrations and launch

Adapters define email, bank-data and e-sign boundaries. The default email adapter reports `CONFIGURATION_REQUIRED`; no personal mailbox, credentials, bank scraping or fake health state is used.

Configure production providers through secret management, create signed/replay-protected webhook handlers for each provider, then record health in the integration registry. The production-readiness table records verified evidence only.

Before go-live: provision corporate mailboxes; set Supabase redirect URLs/MFA; apply migrations to a backed-up project; configure monitoring and restore testing; add domain/TLS/email DNS after the final domain is supplied; and complete Director, CA, CS and legal review.
