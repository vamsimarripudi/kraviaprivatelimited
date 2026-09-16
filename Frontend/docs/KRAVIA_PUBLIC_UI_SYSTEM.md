# Kravia public UI system

This system belongs to the Kravia Private Limited corporate website. It is intentionally separate from product application UI, including VidyaLuma.

## Design foundations

- **Type:** Geist for interface copy, Instrument Serif only for restrained editorial emphasis, Geist Mono for labels and metadata.
- **Surfaces:** paper, mist, ink, Kravia green and gold are defined in `app/globals.css` tokens.
- **Spacing and movement:** use the existing shell, systematic section spacing and `--fast` / `--standard` motion tokens. Motion must be optional under reduced-motion preferences.
- **Focus and layers:** shared focus ring and drawer/sticky layers are governed in the public UI token block.

## Canonical public primitives

| Primitive | Use | Do not use for |
| --- | --- | --- |
| `Card` | Product, trust, contact and feature groupings | A generic wrapper around every paragraph |
| `Badge` | Truthful status/category context | Decorative emphasis or unverified claims |
| `FormField` | Labelled contact and public forms | A placeholder-only field |
| `Accordion` | Secondary explanatory content | A primary company proposition |
| `Drawer` | Mobile navigation and an explicitly focused task | Desktop public-site navigation |

All primitives live in `components/ui/`. The public site uses a top navigation on desktop; the drawer is intentionally mobile-only.

## Interaction standards

- Links and buttons have visible keyboard focus.
- The mobile drawer traps focus, restores it to the trigger, supports Escape, and locks background scrolling.
- Tabs use arrow keys, Home and End in addition to pointer input.
- Forms preserve user input on errors, announce validation errors, avoid raw backend details, disable duplicate submissions and show a durable success result only after the intake API returns a real reference.
- Security reports are routed to the dedicated Trust workflow instead of the ordinary enquiry path.

## Content and trust boundaries

- Products render from the governed public product model in `lib/corporate-content.ts`.
- Corporate facts remain filtered by verification and visibility; do not add CIN, GSTIN, addresses, telephone numbers or contacts without approved data.
- Do not create product UI, customer proof, certifications, or metrics for Kravia without approved source data.
- Public product destinations must state the product boundary clearly and must not duplicate a product application’s marketing or customer interface.

## Component inventory decision

| Existing surface | Decision | Reason |
| --- | --- | --- |
| `SiteNav` | Hardened | Kept Kravia’s top navigation and added an accessible mobile drawer.
| `CapabilityExplorer` | Hardened | Kept the existing capability model and added keyboard tabs.
| `EnquiryForm` | Hardened | Preserved the real intake API and added field/error/submission/success states.
| Product panel | Consolidated | Replaced its hard-coded VidyaLuma presentation with `ProductPortfolio` backed by governed data.
| Corporate Office UI | Kept separate | It is a private operational surface and must not determine public-site design.
| VidyaLuma UI | Excluded | It is a product identity, not a corporate-site component source.

## Verification

Run from the repository root:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Visual verification should cover the homepage, product portfolio, contact router, mobile navigation drawer, keyboard tab navigation and form failure/success states at mobile, tablet and desktop widths.
