# Leadership & Team

Route: `/company/leadership`. The feature includes Company/About previews, a shared footer link, sitemap discovery, metadata and person/company relationships. It is a code-only feature branch, not a production deployment.

## Content and links

`lib/leadership.ts` contains the three owner-supplied profiles. Vamsi and Satish are founding leadership; Jaya is a key team member. Only approved records are displayed. Keep titles and responsibilities accurate as the team evolves. The narrative describes an early-stage, pre-revenue company with VidyaLuma as its flagship in development. Product links reuse `lib/products/vidyaluma.ts`.

Vamsi's name, avatar and portfolio action navigate to `https://vamsimarripudi.me`. His and Satish's supplied LinkedIn links are separate external actions. The Company/About preview also links Vamsi to his portfolio. Jaya has no invented professional link. `lib/public-links.ts` supplies KRAVIA's LinkedIn URL to the shared footer and company structured data.

## Portraits and pending logo

The owner-supplied neutral avatar is `public/team/default-profile.webp`. Portrait frames are 128px on desktop, 104px on mobile and 48px in Company/About previews. Large initial-letter panels have been removed.

All three actual `portrait` values and `leadershipAssets.vidyalumaLogo` remain null until approved assets arrive. A supplied portrait overrides the default avatar. A failed portrait falls back to the default, and a failed default has an accessible icon fallback. The neutral avatar is not emitted as a real portrait in Person structured data. The absent logo renders a textual VidyaLuma wordmark.

For final images, strip EXIF/location metadata, optimize to WebP or AVIF and store approved assets under `public/team/` or `public/brand/`. Retain original photographs outside Git. Set each asset to `{ src: "/team/approved-file.webp", width: 800, height: 1000, objectPosition: "50% 35%" }` using its actual dimensions. Review circular crops, alternative text, loading and fallback behavior. Do not substitute stock faces or invent professional links.

## Public typography and spacing

Public display headings use 75% of the original scale, with a 16px floor for small headings. Heading margins and selected section padding are reduced, and shared heading line-height is 1.12. Body text, controls, root font size, print output and internal workspace styles are preserved. Leadership retains its previously reduced scale rather than being reduced twice.

Run `node scripts/sync-public-typography.mjs` after changing underlying public styles. It regenerates `app/public-typography.css` and the marked screen-only blocks in public CSS modules without compounding reductions. Finishing rules are in `app/public-refinements.css`.

## Verification — 23 October 2026

Lint, TypeScript checks, 500 tests across 105 files, production build and secret scan passed. Production-mode Chromium checked 16 routes at 390px and 1440px: 32 route/viewport checks returned HTTP 200 without horizontal overflow or uncaught browser errors. Leadership checks covered avatar dimensions, loaded images, supplied links, server-rendered content without JavaScript, 320px layout and intercepted portfolio navigation. Automated WCAG A/AA scanning found no violations in the leadership main content; this is not a claim of complete accessibility certification.

From `Frontend/`, run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` and `node scripts/secret-scan.mjs`. Repeat browser checks after replacing assets. The earlier shared reduced-motion splash hydration correction is retained.

## Release boundary

Real portraits and the VidyaLuma logo remain pending. Production crawler settings inherit the existing environment policy; previews remain non-indexable. Automatic deployment from feature branches stays disabled.

The existing pinned Next.js 16.3.8 dependency previously failed the runtime security audit with a critical finding; that audit reported a fix at 16.4.3. Dependency manifests were not changed in this feature. Resolve and retest the dependency before production release. Successful feature checks do not constitute a clean dependency audit. Do not merge or deploy without the required release approval.
