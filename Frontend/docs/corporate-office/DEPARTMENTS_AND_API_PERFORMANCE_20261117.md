# KRAVIA Office — Enterprise department access and API performance

## Decision scope

Source-audited on 17 November 2026 against GitHub main and the canonical
Supabase ownership, permission and pg_stat_statements records. This document
separates **implemented and tested** work from **remaining live verification**
and does not invent external integrations or grant broad staff permissions.

## Root cause: staff member owns multiple real departments

Current live ownership record showed:
- Jaya M: OPERATIONS, LEGAL, SECRETARIAL, CUSTOMER_SUCCESS, SUPPORT, SECURITY.
- Manohar: EXECUTIVE, FINANCE, PEOPLE, PRODUCT.
- The remaining active catalog entries have no owner, including SALES,
  PROCUREMENT, DEVOPS, IT, ADMINISTRATION, AUDIT, MARKETING and QUALITY.
- Jaya has ADMIN, CS (Company Secretary), LEGAL and OPERATIONS roles, with
  no active office access-profile assignment.

The old Office shell passed **only the currently focused department** to
officeClientSectionVisible. It also used the heavy handover endpoint (transfer
history and employee directory) to populate the compact navigation. The new
implementation retains the current focus picker but shows links across **all
owned/assigned** departments and uses /api/office-my-departments as a minimal
authenticated navigation endpoint.

Navigation is **not** authorization. The effective capability snapshot, each
API handler, Postgres department verdict and device-binding checks still
enforce actual record and action access. A role such as ADMIN or CS does not
inherit Finance, HR-sensitive, Sales, payments or payroll automatically.

## Department inventory (existing functional routes)

| Department | Owner at audit | Source-backed workspace | Remaining conditions |
|---|---|---|---|
| Executive | Manohar | decisions, strategy, intelligence | scoped approval permissions |
| Finance | Manohar | payroll, budget, cards | finance specific controls, company device |
| People / HR | Manohar | recruitment, people | HR profiles and sensitive-device controls |
| Product | Manohar | products, portfolio | scoped product authority |
| Operations | Jaya | assets, facilities | verified asset/device requirements |
| Legal | Jaya | contracts, privacy, trust | contract and customer-trust rights separately scoped |
| Secretarial | Jaya | governance, registrations, compliance, documents, custody | current owner reads, statutory sign-off remains separate |
| Customer Success | Jaya | **customer-success** (new; customer-trust workflow) | approved company device for customer.trust.read; no Sales master access |
| Customer Support | Jaya | support | support-case reads plus governed status/workflow actions |
| Security | Jaya | security, resilience, ai | trusted device and explicit sensitive permissions |
| Platform / DevOps | Unassigned | integrations, domains | owner and permissions required |
| Engineering | Unassigned | engineering | owner and scope required |
| Procurement | Unassigned | vendors | owner and buyer rights required |
| Sales | Unassigned | crm | owner and customer master rights required |
| Quality Engineering | Unassigned | quality | owner and QA entitlements |
| Administration | Unassigned | no standalone department section; central access and IT tools exist | assign manager and map non-privileged tasks |
| Audit | Unassigned | audit is reserved for executive review | independent auditor assignment required |
| IT | Unassigned | employee IT desk is a personal section | separate IT owner for privileged administration |
| Marketing | Unassigned | no dedicated staffed module | build real campaign/lead evidence workflows |
| Tax & GST | Unassigned | GST/filing controls in scoped Finance workspace | CA authorization and company tax controls required |

"Existing functional route" means code, source and defined workflows exist, not
that every department has passed live human acceptance testing or every external
provider credential has been activated. Unassigned/no-section departments are
explicitly **not** represented as finished.

## API and data-flow architecture

Browser -> Vercel Next.js (first-party AAL2 session, same-origin BFF, effective
record capabilities) -> Supabase/PostgreSQL (RLS, audited RPCs, ownership,
outboxes) and selected Railway FastAPI domain APIs. No new authentication or
permission system is created.

Confirmed performance evidence from pg_stat_statements at audit:
- office_department_capability_changes via PostgREST: 434 calls at ~65.4 ms
  mean execution time (aggregate past calls, not per-request end-to-end p95).
- selected office_auth_sessions queries had 473 calls at ~82.6 ms mean.
- 6,739 department verdict calls at ~2.3 ms mean.
These aggregates are historical. They do **not** prove any specific UI latency.

Implemented improvements:
1. Independent catalogue, ownership, profile and override reads begin in one
   Promise.all, eliminating two network dependency barriers in the capability
   snapshot without caching stale user privileges.
2. The department-catalogue SQL response uses a set-based batch decision instead
   of calling the department-verdict procedure once per permission. CI compares
   all batch results against every individual verdict across synthetic roles.
3. A dedicated two-query /api/office-my-departments returns only current actor's
   owned/primary departments. It never returns the transfer registry or staff
   directory to navigation clients.
4. Trust Center resolves the user's company device once and six separate
   permission outcomes concurrently (no permission shortcut).
5. Support-case overview reuses the authenticated actor and resolves optional
   case-management and refund-request capability flags concurrently.
6. FastAPI maintains one shared PostgreSQL rate-limit mutation per request,
   with server-selected risk classes and secret-free slow-request logging.

## Rate limiting and defense in depth

The existing canonical FastAPI app used a cross-replica, database-backed
fixed-window limiter before mutations. It does NOT need an incompatible second
limiter on the same path. New default budgets, per peer/identity/tier within
one 60-second window (values configurable on Railway):

- OFFICE_AUTH_MUTATION_RATE_LIMIT = 24
- OFFICE_SENSITIVE_MUTATION_RATE_LIMIT = 40
- OFFICE_MUTATION_RATE_LIMIT = 120
- OFFICE_RATE_LIMIT_WINDOW_SECONDS = 60
- OFFICE_SLOW_REQUEST_LOG_MS = 900

Production retains OFFICE_RATE_LIMIT_MODE=database and
OFFICE_REQUIRE_SHARED_RATE_LIMIT=true by default, with fail-closed 503 if the
shared limiter is unavailable. Auth paths, finance/tax/regulated paths and
ordinary mutation paths receive separate counters. Responses expose only
X-RateLimit-*, Retry-After and Server-Timing, not personal data. This is an
outer defense: Office auth, OTP, account recovery, role control and banking/
payment limits still need their own specific lower budgets and audit checks.

Vercel BFF does NOT automatically inherit Railway rate limiting. Extending
shared account-tier limits to all Next.js mutation routes requires an
independent actor-keyed, distributed implementation at its actual edge/database
boundary, with test evidence. Do not falsely mark it as completed here.

## Production acceptance and performance SLOs

Proposed targets (not yet observed production metrics):
- Navigation own-departments p95 <= 250 ms on a warm connection; investigate
  p95 > 500 ms rather than retrying an inaccessible department list.
- Permission snapshot p95 <= 300 ms; log and trace all dependent DB calls.
- Authorised case/board GET p95 <= 700 ms with a warm backend; test actual
  Railway upstream latency and payload size before setting contractual SLOs.
- Routine POST API p95 <= 500 ms excluding deliberate long-running work.
- 429 status always includes Retry-After. No unauthenticated mutation, cross-
  scope department route, or device-unauthorised action succeeds.

Follow-up engineering controls: structured per-route telemetry for p50/p95/p99,
Postgres EXPLAIN (ANALYZE,BUFFERS) on the verified slow statements, bounded
pagination for large support/board lists, reduce overfetch, provider timeouts,
outbox queues with idempotency keys and dead-letter review, request-level
correlation IDs and circuit-breaker policies. Do not claim these as built.

## Release checklist

- [x] Ownership/role source audit; no direct privilege reassignment.
- [x] Multi-owned department routes and dedicated Customer Success flow in code.
- [x] Scoped read-only Postgres migration and synthetic authority equivalence CI.
- [x] Parallelised authorization checks in code, no client token caching.
- [x] Three-tier shared FastAPI rate limiter with synthetic 429 tests.
- [ ] All GitHub quality and database CI pass for exact release commit.
- [ ] Apply reviewed migration on correct production Supabase project.
- [ ] Deploy matching Next.js and Railway code, verify source SHAs.
- [ ] Perform real Jaya/Manohar signed-in acceptance testing on each assigned
      department including mobile navigation and a trusted managed device.
- [ ] Verify both worker and Next.js boundary behavior at actual p95/p99.
- [ ] Inventory unassigned departments and implement real approved workflows.

Do not classify unassigned or device-blocked workspaces as broken permissions,
and never bypass a company-managed device requirement to make a menu display.
