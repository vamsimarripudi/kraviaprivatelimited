# Leadership & Team

Route: `/company/leadership`. This release adds a public team page, a shared preview on the Company and About routes, a footer link, sitemap discovery, metadata and person/company relationships.

## Content ownership

`lib/leadership.ts` is the single source for the three owner-supplied profiles. Vamsi and Satish are the founding leadership; Jaya is the key team member. Titles and responsibilities reflect the owner's instructions. Only `publicationStatus: "approved"` records are displayed. Keep role descriptions accurate as actual responsibilities evolve.

The company is described as early-stage and pre-revenue, with VidyaLuma as its flagship in product development. The product route and external domain are reused from `lib/products/vidyaluma.ts`. No customer numbers, revenue, qualifications or previous employers are implied.

## Pending assets

The code is complete independently of image delivery. All three `portrait` values and `leadershipAssets.vidyalumaLogo` intentionally remain `null`. This renders initials and a textual VidyaLuma wordmark, makes no requests to nonexistent images, and does not emit nonexistent image URLs into structured data.

After the owner supplies approved original images:

1. Strip EXIF/location metadata and optimize portraits to WebP or AVIF. Use consistent crops and retain the originals outside Git.
2. Add assets under `public/team/` and the supplied logo under `public/brand/`. Do not substitute stock portraits or generate faces.
3. Set the appropriate asset to `{ src: "/team/approved-file.webp", width: 800, height: 1000, objectPosition: "50% 35%" }`, using the real file dimensions. The logo uses the same shape with a `/brand/` path.
4. Check actual asset existence, crops, alt text, responsive delivery and the image-failure fallback. Test with JavaScript disabled as well.
5. Add personal LinkedIn links only when supplied and confirmed by the respective person. Missing links remain omitted.

The media component preserves layout dimensions and handles failed image loads. No separate layout implementation is needed when assets arrive. The new CSS is scoped to the leadership components; global styling and unrelated application workflows are unchanged.

## Checks

From `Frontend/`, run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` and `node scripts/secret-scan.mjs`. The focused regression suite is `tests/leadership.test.tsx`. Also inspect the built page at desktop and mobile sizes, internal links, structured data and the About preview.

Production indexability inherits the existing environment policy. Preview environments remain non-indexable. Publishing and adding the final portraits/logo are separate release steps; this change does not enable automatic deployments for feature branches.

## Verification record — 23 October 2026

- Lint, TypeScript checks, production build and secret scan passed.
- 104 test files / 494 tests passed, including 15 leadership regressions.
- Production-mode Chromium checks passed at 360, 390, 768 and 1440 pixels: HTTP 200, no horizontal overflow, no broken images, no uncaught browser errors and no automated WCAG A/AA findings within the new main content.
- Leadership, Company, About, VidyaLuma and sitemap routes returned HTTP 200. Profile content and discovery links are present in server-rendered HTML without JavaScript.
- A pre-existing reduced-motion hydration mismatch in the shared entry splash was fixed using a stable hydration snapshot; it is not hidden with warning suppression.
- Release blocker outside the page feature: the existing pinned Next.js 16.3.8 dependency failed the runtime dependency audit (critical). The audit reports a fix at 16.4.3. Dependency manifests were deliberately not changed in this scoped feature. Resolve and retest that dependency before production release; the successful feature checks do not constitute a clean dependency audit.

Portraits and the supplied VidyaLuma logo remain pending. This is a code-only feature branch, not a production deployment.
