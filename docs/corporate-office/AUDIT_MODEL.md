# Audit model

`audit_events` is append-oriented. Capture actor, action, entity, timestamp, AAL and only necessary state references/context. Significant events include meeting creation, notice issue, document upload/access, minutes finalisation, role changes and publication. Never place confidential file contents, passwords, tokens or full form values in audit data.

Normal application roles receive no mutation policy for the audit log. Supabase Auth audit information supplements—but does not replace—application business events.
