# KRAVIA transactional email system

`templates/kravia.tsx` is the canonical, typed source for six distinct
KRAVIA email designs. Each template renders deterministic email-safe HTML
(tables, inline styling and mobile adjustments) and an accessible plain-text
fallback. The build script writes the generated manifest to
`Backend/backend/generated_email_templates.json`; FastAPI uses it without
requiring a Node process at delivery time.

## Email designs

| Template | Identity | Purpose |
| --- | --- | --- |
| `office_sign_in_code` | Blue verification panel | One-time code |
| `office_device_approval` | Terracotta security alert | New-device review |
| `public_request_received` | Green receipt & reference card | Request acknowledgement |
| `public_request_update` | Blue message panel | Request update |
| `public_intake_internal_notification` | Amber operations dashboard | Internal intake notice |
| `public_welcome` | Sapphire editorial hero | Welcome |

The masthead uses the approved unchanged KRAVIA lockup from
`Frontend/public/brand/kravia-header-lockup-v2.png`. The footer uses
animated GIF social icons (LinkedIn, X, Instagram, Facebook) stored under
`Frontend/public/brand/email/`. Those GIFs use Bootstrap Icons paths
licensed in `Frontend/public/brand/social-icons.LICENSE.txt` (Instagram
uses an equivalent hand-drawn camera silhouette). The official URL list must
remain aligned with `Frontend/lib/public-links.ts`.

Motion is deliberately subtle. Gmail/Apple Mail can animate GIFs; other
clients may show their first frame. Alt text and visible labels provide an
accessible fallback, including when remote images are blocked. No JavaScript,
client-side CSS animations, pixel tracking or third-party image hosts.

## Workflow

1. Edit `templates/kravia.tsx` (the body and plain-text copy must agree).
2. Run `npm run build` from `EmailTemplates/` to regenerate the manifest.
3. Run `npm run check` and `npm run typecheck`.
4. Run `pytest Backend/backend/tests/test_email_delivery.py` from the
   repository root (in the configured backend Python environment).
5. Send isolated example emails to an authorized inbox; inspect Gmail mobile
   light/dark and desktop, image-blocked mode, and a non-animated client.

Do not include production one-time codes, device approval URLs, customer data,
provider secrets or real intake messages in fixtures or design previews.
Runtime values are validated and escaped by `Backend/backend/email_templates.py`.
