# KRAVIA Company OS - Workflow Engine Architecture

## Purpose

The workflow engine is the centralized orchestration layer for approvals, reviews, tasks, notifications, scheduled jobs, rules, and automation definitions across KRAVIA Company OS.

## Backend Package

The engine extends the existing platform workflow foundation:

`com.kravia.companyos.platform`

Core classes:

- `WorkflowAutomationController`
- `WorkflowAutomationService`
- `WorkflowAutomationDto`
- `WorkflowAutomationEnums`
- Workflow template, step, rule, action, condition, notification, and scheduled job entities

## Database Tables

- `workflow_templates`
- `workflow_steps`
- `workflow_instances`
- `workflow_instance_steps`
- `workflow_actions`
- `workflow_conditions`
- `workflow_rules`
- `workflow_notifications`
- `scheduled_jobs`
- `workflow_history`

## Frontend Module

Angular module:

`src/app/workflow-engine`

The page provides:

- Workflow monitor
- Workflow designer
- Workflow execution controls
- Business rules
- Scheduler
- Workflow reports

## Design Rule

Modules should call the workflow engine for approval/review orchestration rather than implementing separate workflow state machines.
