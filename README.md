# KRAVIA PRIVATE LIMITED

## Supabase setup

1. Create or select the intended Supabase project.
2. In **Connect**, choose **Next.js** and **App Router**.
3. Copy the Project URL and publishable key into `.env.local`.
4. Obtain a server secret only for approved server-side operations; place it in `SUPABASE_SECRET_KEY`.
5. Restart `npm run dev` after saving the file.
6. Apply the versioned migrations through the approved Supabase migration workflow.
7. Check `GET /api/health/supabase`. It reports only `ok`, `configuration_required` or `unavailable` and never returns credentials.

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are browser-visible by design. The publishable key relies on correctly configured RLS. `SUPABASE_SECRET_KEY` is server-only, highly privileged, Git-ignored and must never appear in a Client Component, browser bundle or log.

Corporate Office routes are protected optimistically by `proxy.ts`; actual data protection requires Supabase Auth, server-side authorization and RLS. Generate typed schema bindings after linking the real project:

```bash
npx supabase gen types typescript --project-id <project-id> > lib/supabase/types.ts
```

Do not place real values in `.env.example`, commits, issue comments or chat.
