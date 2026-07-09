# KRAVIA Company OS - Analytics Data Model

## Response Model

Each analytics endpoint returns an `AnalyticsDashboardResponse`.

Fields:

- `module`
- `generatedAt`
- `from`
- `to`
- `kpis`
- `sections`
- `risks`
- `emptyStates`

## KPI Model

Each KPI uses:

- `label`
- `value`
- `unit`
- `tone`

Supported units:

- `count`
- `INR`
- `percent`

## Trend Model

Trend points use:

- `label`
- `value`
- `tone`

Trend points are generated from actual stored records, such as reporting month, lead stage, status distribution, or product readiness.

## Risk Indicator Model

Risk indicators use:

- `label`
- `value`
- `severity`
- `description`

Severity is informational for the UI and does not create new risk records.

## Date Filters

The Phase 24 analytics date range filters records by stored update timestamps where available.

Financial month views also group stored financial records by reporting month.

## Empty States

If a source module has no stored records, the backend returns a professional empty state instead of dummy analytics.
