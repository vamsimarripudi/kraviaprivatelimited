# Legal Module Architecture Report

## Scope

Phase 23 adds Legal & Contract Management to KRAVIA Company OS.

The module covers:
- Contract Repository
- Agreement Tracker
- Legal Obligations
- Renewal Tracker
- Legal Approvals
- Legal Risk Register
- Signature Status
- Legal Notices
- Contract Reports

## Backend

Package: `com.kravia.companyos.legal`

Main components:
- `LegalController`
- `LegalService`
- `LegalDto`
- `LegalEnums`
- JPA entities and repositories for contracts, obligations, approvals, notices, and legal risk links

All private APIs enforce role permissions on the backend.

## Frontend

Module: `src/app/legal`

The Angular module provides a protected workspace for contract records, legal obligations, approvals, notices, legal risks, and reports.

## Integrations

- Document Vault: contracts, obligations, approvals, and notices can link to stored documents.
- Risk Register: legal risk links can reference existing risk register entries.
- Notifications: renewal date changes create internal notifications.
- Audit Logs: create, update, archive, approval, and report actions are audited.

## Data Rules

No legal records are seeded. Empty states appear until KRAVIA enters real contracts or legal records.

