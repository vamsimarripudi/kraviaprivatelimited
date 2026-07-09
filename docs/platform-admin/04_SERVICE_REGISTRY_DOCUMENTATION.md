# Service Registry Documentation

## Purpose

The service registry tracks backend services used by KRAVIA Company OS and future KRAVIA products.

## Service Record Fields

Each service record includes:

- service name
- version
- status
- health
- API base URL
- owner
- last deployment
- dependencies

## Example Service Categories

Use real service names only, such as:

- Authentication Service
- Company Service
- Finance Service
- Compliance Service
- Task Service
- Product Service
- Notification Service
- AI Service
- Search Service

Do not create fake service entries.

## Ownership

Every production service should have an owner responsible for:

- release status
- health review
- incident response
- dependency tracking
- documentation updates

## Dependency Rules

Record dependencies clearly so future changes can be reviewed before deployment.
