# KRAVIA Office — design QA

## Comparison target

- Source visual truth: `C:\Users\Vamsi\.codex\generated_images\01a0ec65-a073-76e2-8cb1-0028aa0cd361\exec-d1664ef8-0f89-4363-a2b0-27925b650ad7.png`
- Source dimensions: 1488 × 1056 pixels.
- Intended implementation route: `/office/dashboard` after an authenticated AAL2 Office session.
- Intended viewport: 1440 × 1024 CSS pixels at device scale factor 1.
- Intended state: an Office user with their permitted work, approvals, notifications and company activity available.

## Evidence status

The source visual was opened and inspected. The local application was run at `http://127.0.0.1:3000` and the secure login route was visually inspected in the browser.

- Desktop: `/office/login` at 1440 × 960 renders as a two-column composition (756px navy identity panel and 684px form panel).
- Mobile: `/office/login` at 390 × 844 intentionally hides the decorative identity panel and presents the sign-in form as a single, readable column.
- Browser console: no error-level messages were recorded while rendering the login route.
- The running checkout reports that the internal identity service is inactive, so the real sign-in controls are correctly disabled. The authenticated `/office/dashboard` view cannot be reached without a valid AAL2 Office identity.

## Intended fidelity checks once the app runs

1. Compare the desktop Office dashboard at 1440 × 1024 with the selected command-center composition: navy rail, quiet white top bar, action-first briefing, decision-led work surface and restrained panel hierarchy.
2. Check the login surface at desktop and mobile widths for clear corporate identity, password visibility toggle, recovery link, MFA handoff and visible focus states.
3. Exercise command search, mobile navigation, request creation, approval decision and task actions; confirm no console errors and no regressions in guarded routes.
4. Inspect the five required fidelity surfaces: typography, spacing, colour tokens, source-brand asset treatment and app-specific copy.

## Findings

- [P1] Authenticated dashboard visual QA is blocked by missing local identity configuration.
  - Location: `/office/dashboard` after redirect through the Office guard.
  - Evidence: the live login screen reports “Internal identity service is not active on this deployment”; form controls are disabled and no AAL2 session is available.
  - Impact: the real, data-backed dashboard, command palette and mutation flows cannot be exercised or captured in this checkout without a valid authorized user.
  - Fix: provide a configured local identity service and a permitted non-production Office account, then rerun the authenticated dashboard comparison and interaction checks.

## Open questions

- The selected reference uses populated operational records; the production UI must continue to render the existing live, authorization-scoped records and its established empty states rather than introduce sample company data.

## Implementation checklist

- [x] Apply the Office command-center shell, authenticated navigation hierarchy, shared control language and secure-auth visual direction.
- [x] Preserve Office API routes, role/capability filtering and mutation components.
- [x] Restore dependencies and run typecheck, tests and production build.
- [x] Capture and compare the secure login at desktop and mobile widths; resolve visible P1/P2 differences.
- [ ] Capture and compare the authenticated dashboard and decision flows with a permitted local AAL2 Office session.

## Mobile navigation follow-up — 2026-09-30

### Comparison target

- Source visual truth: `C:\Users\Vamsi\.codex\codex-remote-attachments\01a0ec65-a073-76e2-8cb1-0028aa0cd361\4BC4E2DA-FBE6-4609-A83B-00FBF7F84590\1-Photo-1.jpg`
- Source state: a phone-width Office page with the mobile menu button labelled “Menu” while the complete navigation list is incorrectly visible.
- Intended implementation state: at `max-width: 820px`, a closed `aside[data-mobile-open="false"]` exposes only the compact wordmark and Menu control. The navigation, context, session actions and footer are hidden until the control sets `data-mobile-open="true"`.

### Findings and fix

- [P1] Closed mobile navigation rendered the complete sidebar.
  - Location: `app/office/office-platform.css`, mobile breakpoint.
  - Evidence: the supplied phone capture shows the Menu control in its closed state while all navigation groups remain visible. The shared platform rule set `aside nav` to `display: grid` with higher selector specificity than the existing closed-state hide rule.
  - Fix: added a higher-specificity closed-state selector that hides all non-header sidebar content, and added an open-state `100dvh` scroll boundary so a deliberately expanded menu remains controllable on short screens.

### Verification status

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed after clearing stale generated `.next` metadata; the source routes were verified intact.
- Browser-rendered authenticated Office navigation: blocked. This checkout has no configured internal identity service, so `/office/dashboard` resolves to the configuration-required login surface. No authorized session was fabricated for visual capture.

## Legal mobile reader follow-up — 2026-10-07

## Comparison target

- Source visual truth: `https://termly.io/our-terms-of-use/`
- Source viewport: 390 x 844 CSS px, light theme, public Terms reader after cookie acknowledgement.
- Source evidence captured in this session: compact 56px header; 16px horizontal content inset; Helvetica/Arial body and headings; 40px/44px H1; 32px/35.2px section heading; single-column table of contents.
- Implementation route: `http://127.0.0.1:3000/legal/privacy`
- Implementation target state: public Global Privacy Policy, initial consent sheet visible.

## Changes applied

- Legal reader, Legal & Trust index, and privacy-choice sheet now use the reference's Helvetica/Arial legal-reading typography and single-column rhythm.
- Legal document headings use a compact sans-serif hierarchy instead of the large display treatment.
- The table of contents is a readable single stream rather than a split two-column grid.
- Policy tables use `table-layout: fixed` with wrapping cells at phone sizes; the prior forced `34rem` table width is removed.
- The privacy-choice sheet keeps both Accept and Reject actions visible but compacts its mobile footprint.
- Shared KRAVIA header, footer, logo, legal content, policy routes, and approval controls were not modified.

## Verification

- Source capture: completed with the in-app browser.
- Implementation browser capture: blocked. The in-app browser rejected navigation to the already-running local server under its URL policy, so a browser-rendered local screenshot could not be captured in this session.
- Source-level focused lint: passed for the three changed React components.
- TypeScript: passed.
- Tests: 97 files / 460 tests passed outside the Windows sandbox.
- Production build: passed.

## Fidelity surfaces

- Fonts and typography: implemented against the source's `Helvetica, Arial, sans-serif` stack and measured mobile type scale.
- Spacing and layout rhythm: implemented as a 16px mobile inset, a single reading column, and compact heading/body rhythm.
- Colors and tokens: retained KRAVIA's existing surface and contrast tokens; no Termly branding, copy, assets, or scripts were imported.
- Image quality and assets: no image assets changed. KRAVIA logo/header/footer assets remain untouched.
- Copy and content: unchanged except existing controls retain their original labels.

## Comparison history

1. Initial review: the production reader used oversized display styling, two-column contents, and a 34rem minimum-width table, creating the mobile presentation shown in the user report. P1.
2. Fix: scoped reader/index/consent CSS now applies the compact single-column legal layout and responsive table rules.
3. Post-fix visual comparison: blocked pending a browser session that permits the local route.

final result: blocked

## Legal print and consent follow-up — 2026-10-07

**Comparison target**

- Source visual truth: supplied mobile Legal & Trust capture at `C:\Users\Vamsi\.codex\codex-remote-attachments\01a0ec65-a073-76e2-8cb1-0028aa0cd361\33A83BE8-E50E-4430-B8F1-0EFCB81F3ED2\1-Photo-1.jpg`; supplied A4 letterhead at `C:\Users\Vamsi\.codex\codex-remote-attachments\01a0ec65-a073-76e2-8cb1-0028aa0cd361\33A83BE8-E50E-4430-B8F1-0EFCB81F3ED2\2-KRAVIA-LETTER-HEAD.pdf`.
- Source print evidence: A4, one page, 595.304 × 841.89 pt. The letterhead PDF was rendered and visually inspected before use; its source SHA-256 is `4F13BBF44B342F63F4C84FA42EEDE2AD7F4886D8B09B03404DDD58A2DFA1CFBC`.
- Research evidence: current Cookiebot guidance supports equal-weight Accept and Reject actions plus a separate granular preferences path. It informed interaction hierarchy only; no third-party CMP, script, artwork, or copy was imported.
- Implementation route: `http://127.0.0.1:3000/legal/cookies`.
- Intended implementation state: mobile first-layer privacy sheet; printed approved policy after the built-in Print action.

**Findings**

- [P1] The existing lower-right Privacy Choices control and saved-status toast obscured the Legal & Trust content on a phone.
  - Location: `components/cookie-preferences.tsx` and `components/cookie-preferences.module.css`.
  - Fix: removed the persistent reopen control and fixed status toast. The first layer now has equally sized Accept optional analytics and Reject optional analytics actions, plus Manage cookies. The manager exposes the only optional category, preserves necessary technologies as always on, respects GPC, and sends choices through the existing same-origin audited route. A contextual Manage cookies action is available on the Cookie Policy, rather than a floating site control.
- [P1] Browser printing had no controlled corporate paper treatment or deterministic page labels.
  - Location: `components/legal-print-document.tsx`, `lib/legal/print-layout.ts`, and `components/legal-document.module.css`.
  - Fix: built an explicit A4 print reader from the same canonical policy body. Every page carries the rendered KRAVIA letterhead asset and a calculated `Page X of Y` label; all 26 released policies retain every canonical paragraph and table row in the page model.
- [P1] The first print implementation touched the footer selector from the legal CSS module.
  - Fix: moved the selector to a print-only global rule guarded by `data-legal-print`; the normal KRAVIA footer source and rendering remain unchanged.

**Fidelity surfaces**

- Fonts and typography: print output uses a restrained Arial/Helvetica body hierarchy that aligns with the legal reader; the source letterhead artwork remains unchanged.
- Spacing and layout rhythm: explicit 210 × 297 mm pages reserve header, body, page-label, and registered-office footer areas.
- Colors and visual tokens: policy print uses the supplied navy/gold letterhead; the consent sheet uses the existing KRAVIA ink, paper, mist, green, and gold tokens.
- Image quality and asset fidelity: the source A4 letterhead was rasterized at 300 DPI into `public/legal/kravia-letterhead-a4.png` (SHA-256 `79710F9B387FD77D9EC0F33D1258B5D6CB2C26E246F320977E076B1A9E43B8B0`) for reliable browser printing. No logo or artwork was redrawn.
- Copy and content: policy content remains from the approved canonical body. Consent copy names only the actual optional analytics category and does not claim unimplemented tracking categories.

**Verification**

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: 97 files / 464 tests passed outside the Windows sandbox.
- `npm run build`: passed after the print and consent implementation.
- Implementation browser screenshot and physical/printer PDF capture: blocked. The in-app browser rejects the already-running local `127.0.0.1` route under its URL policy, so no local visual capture could be compared in this session. No production deploy or physical print result is claimed.

**Implementation checklist**

- [x] Remove the lower-right persistent Privacy Choices control.
- [x] Preserve real optional-analytics consent persistence, GPC handling, withdrawal reload, and necessary technologies.
- [x] Provide Accept, Reject, and Manage paths with equal first-layer prominence.
- [x] Produce bounded A4 letterhead pages with `Page X of Y` labels from the canonical policy content.
- [x] Keep normal header/footer content unchanged and isolate print-only behavior.
- [ ] Capture a real browser print preview and one physical/PDF print sample once a browser session permits the local route.

final result: blocked
