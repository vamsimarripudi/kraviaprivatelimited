# HR Architecture Report

## Scope

Phase 22 adds the Human Resources and Organization Management module to KRAVIA Company OS.

The module covers:
- Organization structure
- Departments and designations
- Employee records
- Employee contacts
- Attendance
- Leave management
- Holidays
- Payroll summaries
- Performance reviews
- Training and certifications
- Exit management

## Backend

Package: `com.kravia.companyos.hr`

The backend follows the existing Spring Boot module pattern:
- Controller: `HrController`
- Service: `HrService`
- DTOs: `HrDto`
- Enums: `HrEnums`
- Entities and repositories for each HR table

All write actions are protected through backend role checks and audit logging.

## Frontend

Module: `src/app/hr`

The Angular workspace provides:
- HR dashboard
- Organization tabs
- Employee register
- Attendance and leave views
- Payroll summary view
- Performance, training, certification, and exit views
- Report generation preview

The UI uses the existing enterprise layout, empty states, loading states, and role-aware actions.

## Data Rules

No employee, payroll, attendance, or performance records are seeded. Empty states are shown until real records are entered.

