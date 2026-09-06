# VORIO chart completion — 2026-09-06

The existing Recharts market presentation is finalized with Global / United States controls, zero-based axes, source notes, an expandable data table and an endpoint-derived growth index. Intermediate years remain explicitly identified as calculated from the publisher CAGR, not observed statistics. Forecast strokes are dashed; tooltips distinguish base estimates from forecast endpoints.

VORIO now bypasses the entry splash, matching YUKTA. This removes the reduced-motion splash hydration failure observed during production browser inspection without changing other public routes.

## Recorded verification

- `npm run lint`: passed.
- `npm test`: 54 tests passed across 14 files.
- `npm run build`: passed, including TypeScript validation.
- `VORIO_VERIFY_ORIGIN=http://localhost:3100 node scripts/verify-vorio-browser.mjs`: passed against the local production build at 1440, 768 and 390 pixels.
- Browser assertions: chart present; no document horizontal overflow; six data rows; canonical URL correct; no splash; United States control operable by keyboard; no runtime exceptions.
- Desktop and mobile chart screenshots visually inspected. Captures are local-only in the ignored `artifacts/yukta-review` directory.

The browser script requires a separately launched isolated headless Chrome on port 9310; never attach it to a personal browser profile. It defaults to the public production origin; use `VORIO_VERIFY_ORIGIN` for local verification.

Market values remain in the canonical `lib/products/vorio-market.ts` registry. This patch changes presentation, not the underlying research estimates. Market forecasts are industry context, not VORIO revenue, measured product outcomes or guaranteed demand.

Production rollout follows the main-branch deployment pipeline. Local test success alone does not establish deployment completion.
