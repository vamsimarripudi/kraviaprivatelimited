# KRAVIA Office — mobile overlay, cards and screen audit (13 November 2026)

## Scope and evidence

- User-supplied iPhone screenshots: Add candidate (unreadable labels), My Work (pale metric-card contrast), and the Workforce status popup (upper half clipped, overlapping topbar) on `kraviaprivatelimited.com`.
- Reviewed all **82 Office-related CSS modules** in `Frontend/components/` matching the Office/workforce/workspace and related governance module families. The repository also contains 16 other CSS modules for public/non-Office features.
- Audited recurring hard-coded white card backgrounds, fixed-position modals/drawers and mobile breakpoints; inspected the Office layout/theme cascade and presence-component lifecycle.
- Reviewed the canonical Products master-data cards, which exposed internal `ACTIVE_CONFIG` status strings.

**What the screenshots prove:** visual clipping, overlap, insufficient contrast and an exposed internal status code. The images alone do not prove any loss of candidate/attendance/approval data.

## Root causes

1. **Workforce popup** used native `<details>` and an absolutely/fixed positioned child panel nested inside a sticky, translucent topbar. On narrow screens the panel could render outside the available viewport while the topbar controls overlapped it.
2. **Theme collision:** many legacy modules hardcode white surfaces while Office's newer global dark-mode rules change foreground colour. Broad selectors such as `[class*="card"]` can also apply to nested classes unintentionally.
3. **Inconsistent viewport treatment:** department forms and overlays set their own height, overflow and width rules; some do not account for iOS safe areas or the 16px input threshold.
4. **Raw data-state vocabulary:** canonical Products showed `ACTIVE_CONFIG` instead of a user-readable description.

## Implemented corrections

| Area | Change | Preserved |
| --- | --- | --- |
| Workforce topbar | Replace dropdown pane with native centered `<dialog>`, top-layer placement, backdrop, keyboard Escape, focus restoration and a close button | No attendance auth or API changes |
| Popup interaction | Small upper-right Actions disclosure for Check in, Start/End break, Check out, Available/Focus/Meeting/OOO/DND and optional expiry | All mutations remain explicit, idempotent and server-authorised |
| Mobile popup | Viewport centered, capped `100dvh` height, scrolling, safe-area insets, 44px targets, 16px menu selects | No automatic attendance transition |
| Office cards | Add late-loaded, Office-only dark/light token guard for CSS Module card/panel/dialog/drawer surfaces, form controls and metric cards | Branded hero, status colour, public website, auth and data unchanged |
| Master data | Render `ACTIVE_CONFIG` as `Configuration active`, remove developer-facing UI explanation | Stored canonical values and permissions unchanged |

## Cross-module audit limits

The 82 CSS modules were **inspected statically**, not all run through a real authenticated browser session. Existing internal screens depend on permissions, real data, trusted device, AAL2 and backend services. Their live end-to-end visual appearance cannot be certified from these screenshots or an unauthenticated browser.

The shared guard is intentionally narrowly scoped to Office CSS Module surface names and does not override status-coloured badges, account state or page-specific layouts. Component-by-component manual follow-up is required if authenticated screenshots reveal additional exceptional surfaces.

## Release validation

- Frontend lint, TypeScript, Vitest, Next.js production build
- Backend quality, database structure and PostgreSQL checks
- Rendered search-discovery checks
- Playwright static CSS fixture checks for native dialog centering at 320×568, 390×844, 844×390 and 1440×900, in light/dark mode, with real Office component styles
- Browser tests for representative legacy metric, card and candidate-form contrast (WCAG 4.5:1 text target)
- Existing Office sign-in/browser tests are unaffected

Release verification is separate from deployment: Vercel build quota/permissions may prevent production from updating even when merged CI is green.

## User acceptance checklist (after deployment)

- On iPhone portrait and landscape, tap Workforce status: modal is centered, fully scrollable and not covered by the topbar.
- Top-right Actions: Check in, Break, Check out, status/OOO and auto-clear only execute when explicitly selected. Menu can scroll independently.
- Escape (physical keyboard), Close and backdrop dismiss restore focus; closing never changes attendance.
- Dark and light: candidate labels/input text/selected requisitions remain legible. My Work and Products cards retain readable labels/statuses.
- Test on 320px, 390px, 430px and tablet/desktop widths; ensure no horizontal scroll and no clipped close/submit control.
- Any additional screen failures should be documented with screen URL, width, theme and a non-sensitive screenshot. Do not infer rollout success from a green build alone.
