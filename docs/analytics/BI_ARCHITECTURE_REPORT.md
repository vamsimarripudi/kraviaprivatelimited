# KRAVIA Company OS - BI Architecture Report

## Purpose

The Business Intelligence layer provides read-only analytics across KRAVIA Company OS modules using stored operational records only.

It does not create fake analytics, seed dashboard numbers, or infer unavailable business data.

## Backend Architecture

Package:

`com.kravia.companyos.analytics`

Core classes:

- `AnalyticsController`
- `AnalyticsService`
- `AnalyticsDto`

The controller exposes module-specific analytics endpoints. The service aggregates data from existing repositories and returns a standard analytics response containing:

- KPI cards
- Trend points
- Risk indicators
- Section notes
- Empty states

## Frontend Architecture

Module:

`src/app/analytics`

Core files:

- `analytics.component.ts`
- `analytics.component.html`

The page uses the existing enterprise workspace shell, route protection, API service layer, shared empty/loading/error states, and print-friendly report patterns.

## Source Modules

Analytics currently reads from:

- Financial records
- Sales leads and customers
- Products portfolio
- Compliance items
- HR records
- Legal contracts and risks
- Procurement vendors, bills, and subscriptions
- Tasks
- Assets and software licenses

## Export Handling

Export buttons are placeholders for PDF, Excel, and CSV generation. Each export request calls the backend and creates an audit log entry.

No downloadable export file is generated in this phase.

## Security

All analytics APIs are protected by backend role checks.

Allowed roles:

- Founder
- Director
- Viewer

Analytics respects the existing authenticated workspace. Future row-level restrictions should be added inside `AnalyticsService` when more granular data permissions are introduced.
