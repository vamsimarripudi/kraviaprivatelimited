# KRAVIA Company OS - Automation Rule Guide

## Rule Model

Workflow rules define:

- Rule name
- Trigger module
- Trigger event
- Condition summary
- Action summary
- Status

## Condition Model

Conditions support operators such as:

- Equals
- Not equals
- Greater than
- Less than
- Contains
- Exists
- Before date
- After date

## Automation Actions

Supported action definitions:

- Create task
- Send notification
- Send email
- Create approval
- Generate document
- Update status
- Create audit log
- Schedule reminder
- Link records

## Current Boundary

Phase 25 stores workflow action definitions and logs execution requests. External integrations such as email delivery, document generation, and automatic cross-module mutation should be connected through dedicated services in later controlled phases.
