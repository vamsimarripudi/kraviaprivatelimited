# Integrations and launch

KRAVIA Office owns password/session/MFA authority through the first-party FastAPI identity runtime. Supabase/PostgreSQL remains the trusted data/control plane and private-storage foundation; Supabase Auth is not the active Office login provider.

Adapters define email, bank-data, tax/GST and e-sign boundaries. Provider-dependent actions remain fail-closed when credentials, eligibility, consent or acceptance evidence is absent. No personal mailbox, bank scraping or fake provider-health state is permitted.

Before go-live:

- connect the approved frontend and API/worker production projects;
- configure `OFFICE_API_ORIGIN` and first-party identity secrets;
- keep Founder bootstrap closed after successful one-time setup;
- configure the Office PostgreSQL/control-plane environment and storage broker;
- provide production ClamAV and complete clean/infected acceptance;
- verify domain/TLS and corporate email/DNS;
- apply reviewed migrations to a backed-up environment;
- configure external telemetry/archive providers when selected;
- activate IRIS/Fynamics/Razorpay/bank/eSign adapters only after real provider acceptance;
- complete Director, CA, CS, auditor and legal review where applicable.

Production readiness is evidence-driven. An internal software feature or adapter must not be shown as provider-approved, filed, compliant or production-connected until the corresponding external evidence exists.
