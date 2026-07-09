# Procurement Architecture Report

## Scope
Phase 20 adds procurement and vendor management to KRAVIA Company OS without redesigning the existing application.

## Backend
Package: `com.kravia.companyos.procurement`

Implemented layers:
- Controller: REST endpoints under `/api/procurement`
- Service: permission checks, validation coordination, audit logging, Finance ERP payable linkage
- Repository: Spring Data JPA repositories
- Entity: normalized procurement records
- DTO: request and response records

## Database
Migration: `V18__procurement_vendor_management.sql`

Tables:
- `procurement_vendors`
- `purchase_requests`
- `purchase_orders`
- `vendor_bills`
- `procurement_subscriptions`
- `procurement_approvals`
- `vendor_documents`

Key relationships:
- Purchase records link to vendors.
- Vendor bills can link to purchase orders.
- Vendor bills can link to Finance ERP payables.
- Vendor documents link to Document Vault records.

## Frontend
Module: `src/app/procurement`

The screen is lazy-loaded through Angular Router and uses the existing enterprise shell, forms, cards, tables, badges, empty states, loading states, and error states.

## Permissions
- Founder: create, view, update, archive, approve
- Director: create, view, update, approve
- Viewer: read-only

Backend services enforce permissions before state changes.

## Audit Logging
Create, update, archive, approval, and report-generation actions produce audit log entries.

## Finance Integration
Unpaid vendor bills create or link Finance ERP payable records where applicable.