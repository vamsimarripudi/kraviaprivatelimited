# Rollback and recovery

Before production work, document the real provider contacts and recovery owner in the private Corporate Office inventory.

- Frontend: redeploy the last verified release.
- Database: prefer a forward-compatible correction; use restore only through the approved backup/recovery process.
- Storage: preserve object version/checksum evidence and restore only authorised records.
- Domain/TLS/email: revert only provider configuration changes that have been captured and reviewed.
- Automations: pause affected definitions, preserve run history and resolve dead-letter items before retry.

Never copy production records into development to troubleshoot an incident.