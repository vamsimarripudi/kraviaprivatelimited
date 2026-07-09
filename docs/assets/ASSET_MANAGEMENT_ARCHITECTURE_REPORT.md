# Asset Management Architecture Report

## Scope
Phase 21 adds an internal Asset Management module for KRAVIA Company OS.

## Backend
Package: `com.kravia.companyos.asset`

Implemented layers:
- Controller: REST APIs under `/api/assets`
- Service: validation, permissions, audit logging, assignment state updates, and reporting
- Repository: Spring Data JPA repositories
- Entity: normalized asset records
- DTO: typed request and response records

## Database
Migration: `V19__asset_management.sql`

Tables:
- `assets`
- `asset_assignments`
- `asset_maintenance_records`
- `software_licenses`
- `cloud_resources`
- `asset_documents`

## Integrations
- Asset vendors link to Procurement Vendor Master through `procurement_vendors`.
- Asset documents link to Document Vault through `documents`.
- Dashboard metrics are generated from stored asset records only.

## Permissions
- Founder: full access including archive
- Director: create, edit, assign, and view
- Viewer: read-only

Backend services enforce permissions for every mutation.