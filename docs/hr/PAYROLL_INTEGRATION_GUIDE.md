# Payroll Integration Guide

## Purpose

Payroll summaries provide founder-level payroll visibility. This module is not a payroll processor.

## Payroll Fields

Each payroll summary tracks:
- Employee
- Payroll month
- Salary structure
- Basic salary
- Allowances
- Deductions
- PF
- ESI
- Professional tax
- TDS
- Net salary
- Status
- Linked financial record

## Finance Integration

Payroll summaries may link to Finance ERP records through `linkedFinancialRecordId`.

The backend calculates net salary from stored payroll values.

## Controls

Do not enter dummy payroll data. If payroll data is unavailable, leave the module empty.

