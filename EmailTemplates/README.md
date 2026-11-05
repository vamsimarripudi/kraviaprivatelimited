# KRAVIA email templates

This package is the canonical source for KRAVIA's transactional email layout.
It uses React Email to render a deterministic manifest at
`Backend/backend/generated_email_templates.json`. The FastAPI delivery service
uses that checked-in manifest so sending email never depends on a Node process
in production.

## Workflow

1. Change the React Email components in `templates/`.
2. Run `npm run build` from this directory to regenerate the server manifest.
3. Run `npm run check` to confirm the artifact is current and contains only
   the approved placeholder tokens.
4. Run the backend email tests. Never add a provider key, recipient address,
   activation code, or real customer content to this package or its snapshots.

The manifest contains layout and placeholder tokens only. The backend validates
and escapes every runtime value before replacement; Office-authored messages
remain plain text and are never treated as HTML.
