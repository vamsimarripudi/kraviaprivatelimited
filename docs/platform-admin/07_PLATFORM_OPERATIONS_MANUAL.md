# Platform Operations Manual

## Daily Operations

1. Open Platform Administration.
2. Review system health.
3. Review failed login attempts and locked accounts.
4. Check job status.
5. Check backup status.
6. Review API registry for degraded or disabled APIs.

## Weekly Operations

1. Review environments.
2. Review service registry health.
3. Review pending releases.
4. Review backup restore-test status.
5. Review security events.
6. Update records with verified information only.

## Founder Responsibilities

Founder can:

- create platform administration records
- update platform configuration
- review service health
- track release and backup status
- review security center signals

## Director Responsibilities

Director can:

- view platform overview
- review operational health
- report missing or outdated records

Director cannot create or update platform administration records.

## Viewer Access

Viewer has no access to platform administration.

## Data Rule

Do not add placeholder infrastructure records. If a value is unknown, leave it empty or set status to `UNKNOWN` or `NOT_CONFIGURED`.
