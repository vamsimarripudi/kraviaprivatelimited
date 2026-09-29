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

final result: partial — automated checks and unauthenticated visual QA pass; authenticated Office visual QA requires real local identity configuration.
