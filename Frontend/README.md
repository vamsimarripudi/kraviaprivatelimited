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

### Legal drafts and website privacy choices

The supplied Legal & Trust documents are review drafts. The public reader uses
only approved publication snapshots; a future policy release also needs its
matching content hash, named legal/operations/release approvals, scope and an
effective period in the database release gate. Reaching a target date does not
publish a draft.

`KRAVIA_ENABLE_LEGAL_LOCAL_PREVIEW=true` and an absolute
`KRAVIA_LEGAL_DRAFT_SOURCE_DIR` permit a local-only review rendering of a pack
outside this repository. The preview is disabled whenever `NODE_ENV` is
`production`; do not set these values in staging or production.

Optional website analytics remain off until an affirmative privacy choice is
persisted. Configure `KRAVIA_PUBLIC_CONSENT_HMAC_KEY` as a separate 32+-character
server-only value and apply the privacy-preferences migration. If that record
cannot be safely written, the browser keeps optional analytics off. The browser
cookie contains only the choice/version, never a visitor identifier.

Supabase project files and migrations are maintained separately under `../Database/supabase/`. Browser-visible publishable keys must remain protected by correctly configured authorization/RLS; privileged server credentials must never enter Client Components or logs.
