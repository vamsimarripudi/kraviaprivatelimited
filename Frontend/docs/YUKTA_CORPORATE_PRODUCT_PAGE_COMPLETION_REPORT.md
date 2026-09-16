# YUKTA corporate product page — implementation report

Date: 2026-09-06. Repository: `vamsimarripudi/kraviaprivatelimited`, branch `main`.

**Status: COMPLETE WITH EXPLICIT CONTENT / EXTERNAL GAPS. Not publicly deployed by this task.**

## Implemented

Existing `/products/yukta` and canonical registry extended, not duplicated. Kravia ownership and in-development status are explicit. Sections include product definition, target scope, buyer friction, workflow illustration, capabilities, queue, paper-first clinical authority, billing, future integration boundaries, administrative AI, roles, intended operational value, market charts, source table/methodology, four alternatives, adoption and 20 FAQs. No patient database, new CMS or fake dashboard.

The existing corporate enquiry path carries YUKTA category. Intake now uses existing database quota control, stable retry references backed by the existing unique constraint, safe failures and a synchronous double-submit guard. Contact-router selection now follows the selected context without discarding entered text. Medical-record warnings added. A live lead was not inserted; route tests use synthetic inputs and a mocked persistence boundary.

Recharts chosen as an open-source React chart layer. YUKTA uses endpoint bars, not invented annual history, plus a separate facility comparison. India/global control is keyboard-usable. Data, cards and server-rendered table share one validated dataset. Zero axes, forecast labels/dashed outlines, no autoplay chart animation. Existing VORIO market section also gets a cleaner responsive area-chart panel and endpoint-derived index bars.

Actual browser inspection exposed two inherited defects: the header overflowed at tablet widths, and font aliases resolved on an ancestor before Next font variables existed. Corrected navigation breakpoint and alias scope, retaining the configured Manrope/Cormorant/DM Mono families. YUKTA does not show the splash. No other page was redesigned.

## Accepted metrics

| Value | Label / period | Geography | Publisher / source |
|---|---|---|---|
| USD 522.3 million | PMS revenue estimate, 2024 | India | [Grand View Research](https://www.grandviewresearch.com/horizon/outlook/practice-management-system-market/india) |
| USD 1,049 million | PMS revenue forecast, 2030 | India | Same original report |
| USD 13.81 billion | PMS revenue estimate, 2026 | Global | [Mordor Intelligence](https://www.mordorintelligence.com/industry-reports/practice-management-system-market) |
| USD 20.75 billion | PMS revenue forecast, 2031 | Global | Same original report |
| 24,323 public / 6,481 private | Scan and Register participating facilities, 2026-08-07 | India | [MoHFW / PIB](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2295972&lang=1&reg=48) |

No annual intermediate YUKTA chart points. India endpoint CAGR discrepancy is disclosed; public CAGR omitted. Global arithmetic reconciles approximately to the reported 8.48%. No aggregation of overlapping markets, numerical TAM/SAM/SOM, valuation, ROI, customer count or user-suggested $25B headline. Facility numbers are neither total hospitals nor YUKTA adoption.

## SEO and data safety

Canonical: `https://www.kraviaprivatelimited.com/products/yukta` (existing www policy retained).
Title: `YUKTA | Clinic & Hospital Workflow Platform by Kravia`.
Unique social preview, WebPage, BreadcrumbList and semantic SoftwareApplication; shared Corporation ID. JSON-LD safely escapes `<`. No fabricated Offer/rating, FAQ rich-result promise or artificial medical-provider identity. Sitemap contains the route. Preview policy and protected middleware unchanged. Research reports and private source IDs are not public downloads; public renderer receives reviewed public facts only.

## Actual verification

- `npm test`: 54 tests passed across 14 files, including evidence/arithmetic validation and enquiry acceptance/failure/retry tests.
- `npm run build`: passed; compilation 15.1 seconds, TypeScript 24.5 seconds, static generation 5.1 seconds in the final application build. These are local build timings, not Core Web Vitals.
- `npm run lint` and `npm run typecheck`: passed before browser artifacts; final source-only rerun recorded separately in task output. Generated Chrome profile excluded from ESLint and Git, not application source.
- `node scripts/verify-yukta-browser.mjs`: passed at 1440, 768 and 390 CSS pixels; document width matched viewport, both market chart states rendered, six source rows, FAQ text, no splash, keyboard Space selected Global, no captured runtime exceptions.
- Desktop/mobile screenshots actually inspected after font fix. Tablet programmatically checked. Evidence: `artifacts/yukta-review/market-1440.png`, `market-768.png`, `market-390.png`, `results.json` (local, ignored).
- Local GET 200: `/products/yukta`, `/products/vidyaluma`, `/products/vorio`, `/sitemap.xml`, `/robots.txt`, `/products/yukta/opengraph-image`, `/contact?product=yukta`. Content types correct; canonical and YUKTA enquiry context confirmed. Five JSON-LD objects parsed successfully from HTML.
- No formatter script exists. `git diff --check` found no whitespace errors; Git reported normal CRLF-to-LF normalization notices.
- Largest observed generated JavaScript chunk: 371,838 raw bytes in the inspected build, not route-specific transfer size or a measured bundle delta. No production CWV/Lighthouse score claimed.

## Files

Created: `app/products/yukta/opengraph-image.tsx`; `components/vorio-market-chart.tsx`; `components/vorio-market-chart.module.css`; `components/yukta-research.tsx`; `components/yukta-research-charts.tsx`; `components/yukta-research.module.css`; `lib/products/yukta-research.ts`; `lib/enquiry-intake.ts`; `tests/yukta-research.test.ts`; `tests/enquiry-route.test.ts`; `scripts/verify-yukta-browser.mjs`; this report and the four YUKTA research/claim/model/SEO reports.

Modified: `.gitignore`, `eslint.config.mjs`, `app/globals.css`, `app/api/enquiries/route.ts`, `app/products/yukta/page.tsx`, `components/brand-splash.tsx`, `components/enquiry-form.tsx`, `components/structured-data.tsx`, `components/vorio-product-page.tsx`, `components/yukta-product-page.tsx`, `lib/products/yukta.ts`, `package.json`, `package-lock.json`.

## Remaining gates and limitations

1. Reviewed product documents establish design, not release availability. Obtain current product-owner/public-claim approval and any later release ledger before promoting status. No approved product screenshot/logo or production/pilot outcome evidence was established; no such claim is made.
2. Live Supabase acceptance and concurrent quota behavior were not exercised. Existing quota RPC and contact unique constraint must be present in the target environment. The existing count-based quota is not a global WAF or concurrency-proof abuse guarantee. No email delivery is claimed; acceptance means stored enquiry, as before.
3. Full WCAG audit, screen reader, zoom, Safari/iOS/Firefox, real-device and production performance checks remain. Browser test captures JavaScript exceptions, not a comprehensive console/network audit. No formal accessibility certification claimed.
4. Enquiry-start/accepted and source-expansion analytics remain uninstrumented; current product CTA/page and chart-selection events are available. No Search Console/Bing access, indexing submission, observed ranking or AI citation measurement performed.
5. No independent equivalent India PMS estimate was established. Proprietary market methodology is limited to accessible summaries. Recheck by 2027-03-06 using the documented manual workflow; no background scraper or paid service.
6. Public deployment was not triggered; implementation, local tests, product release, legal approval and search indexing are separate states.

Cost: no new paid tools, reports, APIs, services, hosting or Docker infrastructure. Existing runtime and free open-source package used. No YUKTA application containers touched.
