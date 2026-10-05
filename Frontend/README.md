# KRAVIA Frontend

Next.js 16 / React 19 application for the KRAVIA corporate platform and browser-facing Office integrations.

## Local development

```bash
npm ci
npm run dev
```

## Required quality gate

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Environment variable names are documented in `.env.example`. Store real values only in local/provider-managed environment configuration.

### Public-form receipts

Contact, Support, and Privacy/Trust forms persist their request first, then
ask the Office API to send a KRAVIA acknowledgement. The authenticated Office
workspace reads those same canonical request records: Support handles Contact
and Support, Privacy handles Trust/DPDP, and Security handles restricted
security reports. A reviewer claim, workflow change, and requester-visible
reply are append-only events; a reply is recorded before the signed API asks
Brevo to send it. `UNKNOWN` provider outcomes are never retried automatically.
Configure
`KRAVIA_PUBLIC_INTAKE_WEBHOOK_SECRET` with the same separate 32+-character
server-only value in this frontend and the Office API. The browser never sees
that value or the Brevo API key. Receipt delivery is intentionally not claimed
when either server-side configuration is missing or the provider cannot confirm
the outcome.

Supabase project files and migrations are maintained separately under `../Database/supabase/`. Browser-visible publishable keys must remain protected by correctly configured authorization/RLS; privileged server credentials must never enter Client Components or logs.
