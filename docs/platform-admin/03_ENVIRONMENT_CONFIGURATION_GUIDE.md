# Environment Configuration Guide

## Supported Environments

- Development
- Testing
- Staging
- Production
- Disaster Recovery

## Environment Record Fields

Each environment should record:

- name
- URL
- version
- build number
- deployment date
- status
- health
- region

## Configuration Rules

- Do not store secrets in plain text.
- Use secret managers or deployment environment variables for sensitive values.
- Keep production values separate from development values.
- Record deployment versions immediately after release.
- Mark unknown health as `UNKNOWN`, not `UP`.

## Recommended Environment Records

Create records only for real environments that exist. Do not add sample environments.

## Review Frequency

Review environment records:

- after every deployment
- after infrastructure changes
- during monthly operations review
- before investor or audit due diligence
