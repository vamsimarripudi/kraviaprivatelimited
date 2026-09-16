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

Supabase project files and migrations are maintained separately under `../Database/supabase/`. Browser-visible publishable keys must remain protected by correctly configured authorization/RLS; privileged server credentials must never enter Client Components or logs.
