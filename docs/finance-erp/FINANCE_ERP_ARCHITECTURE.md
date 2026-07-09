# Finance ERP Architecture

## Purpose

The Finance ERP module provides KRAVIA PRIVATE LIMITED with an internal finance operations layer for accounts, journal entries, banking, receivables, payables, GST, budgets, approvals, and finance reports.

## Backend

- Package: `com.kravia.companyos.financeerp`
- Controller: `FinanceErpController`
- Service: `FinanceErpService`
- Persistence: Spring Data JPA repositories
- Audit: every create, update, archive, status change, and report generation writes to audit logs.
- Security: Founder and Director can create/update operational records; Viewer has read-only access; archive actions are Founder-only.

## Frontend

- Module: `src/app/finance-erp`
- Route: `/finance-erp`
- Navigation: `Finance ERP`
- UI pattern: existing enterprise panels, tables, forms, empty states, loading states, and print-friendly layout.

## Accounting Controls

- Journal entries require balanced debit and credit totals.
- Voucher numbers are unique.
- Posted journal entries are immutable.
- No dummy finance data is seeded.
- Empty states are shown when records do not exist.

