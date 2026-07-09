# KRAVIA Company OS - Workflow API Documentation

Base path:

`/api/workflow-engine`

## Monitor

- `GET /summary`

## Templates

- `GET /templates`
- `POST /templates`
- `PUT /templates/{id}`
- `DELETE /templates/{id}`
- `POST /templates/{id}/steps`
- `PUT /steps/{id}`
- `DELETE /steps/{id}`
- `POST /templates/{id}/conditions`

## Execution

- `GET /instances`
- `POST /instances/start`
- `PATCH /instances/{id}/command`
- `PATCH /instances/{id}/steps/{stepId}`

## Actions

- `GET /actions`
- `POST /actions`

## Rules

- `GET /rules`
- `POST /rules`
- `PUT /rules/{id}`
- `DELETE /rules/{id}`
- `POST /rules/{id}/conditions`

## Scheduler

- `GET /scheduled-jobs`
- `POST /scheduled-jobs`
- `PUT /scheduled-jobs/{id}`
- `DELETE /scheduled-jobs/{id}`

## Reports

- `GET /reports?type={reportType}`

Report types:

- `WORKFLOW_PERFORMANCE`
- `APPROVAL`
- `AUTOMATION`
- `SLA`
- `ESCALATION`
- `WORKFLOW_AUDIT`
