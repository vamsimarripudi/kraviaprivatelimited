# KRAVIA Office — Department Access & API Architecture Audit

Status: code changes prepared for review on 17 November 2026. This document
describes observed state and implementation. CI success is not a claim that
all external integrations or business operations are ready.

## Current recorded company departments

The database contains 20 active department codes. Ten have named current
owners, and ten have no recorded owner.

| Department | Owner found at audit | Existing route(s) / current limitation |
|---|---|---|
| Administration | Unassigned | Owner-only company controls; no separate department module |
| Audit | Unassigned | Office Audit (Founder scope); no generic department-owned module |
| Customer Success | Jaya M | NEW /office/customer-success (customer-only Trust Center) |
| Platform / DevOps | Unassigned | /office/integrations and /office/domains |
| Engineering | Unassigned | /office/engineering |
| Executive | Manohar | /office/decisions, /office/strategy, /office/intelligence |
| Finance | Manohar | Finance workspace, payroll, budget, corporate cards |
| IT | Unassigned | Personal /office/it service desk; no separate department route |
| Legal | Jaya M | Contracts, privacy, customer trust and legal compliance |
| Marketing | Unassigned | No dedicated operational section yet |
| Operations | Jaya M | Assets and facilities; procurement tasks are separately routed |
| People & HR | Manohar | Recruitment, people and worktime |
| Procurement | Unassigned | /office/vendors |
| Product | Manohar | /office/products, /office/portfolio |
| Quality | Unassigned | /office/quality |
| Sales | Unassigned | /office/crm and /office/customers (customer master) |
| Secretarial | Jaya M | Board/governance, registrations, compliance, documents and custody |
| Security | Jaya M | Security overview, resilience and AI governance |
| Customer Support | Jaya M | /office/support for governed cases and separate refund requests |
| Tax & GST | Unassigned | Finance GST; no independent Office department section |

**CS always means Company Secretary in KRAVIA Office.** Customer Support is
a separate departmental code SUPPORT; Customer Success is CUSTOMER_SUCCESS.

### Verified causes of Jaya's access problem

1. The client navigation used just the single active department, hiding the
   other five owned departments even though the source list contained them.
2. The permanent-department ownership verdict granted write permissions to
   department heads but its safe-read whitelist omitted important reads:
   support.case.read, customer.trust.read, secretarial.board.read,
   registration.read, compliance.rules.read, operations.asset.read, facilities.room.read and
   security.overview.read. A workspace with write but no read fails before
   showing the actual cases or documents.
3. Jaya's active first-party account had roles ADMIN, CS, LEGAL and
   OPERATIONS, with OPERATIONS as her primary department and *no active
   access-profile assignments*. The fix does not manufacture access profiles,
   change roles or transfer department ownership.
4. No company-managed Jaya device was present in the audited device registry.
   Permissions requiring a managed device remain gated by the existing
   OFFICE_DEVICE_ENFORCEMENT policy and actual trusted-device binding.

### Applied in source (pending controlled release)

- Navigation now uses the *full, current* list of assigned department codes,
  and still excludes all unassigned departments.
- A new private GET /api/office-departments?view=navigation fetches only active
  department labels and ownership for the authenticated actor, not transfer
  history or employee addresses. Full ownership/handover API stays unchanged.
- A 30-second floor applies to incidental tab-focus navigation refresh only;
  explicit department change events invalidate immediately. All business API
  reads remain no-store and permission-scoped.
- Secretarial Registrations now has an explicit capability mapping instead of being hidden even after authorization. Facilities permission ownership is aligned with its existing Operations page (previously mapped to unassigned Administration); sensitive visitor/facilities actions still require their normal managed-device and independent approval checks.
- Legal Contracts receives only the existing low-risk legal.obligation.read baseline, and Security's Resilience/AI consoles receive only resilience.read and ai.tool.read. All sensitive Security/AI reviews and mutation permissions remain separate; a company-managed device is still required where configured.
- Customer Success has an actual customer-only Trust Center workspace, while
  Sales retains customer master; the customer view does not return vendor
  assurance details or financial operations.
- Owner-read permissions now cover the exact low-risk list above, only for
  the *active current owner* of the relevant department; explicit DENY and
  device restrictions still execute independently. No FINANCE or sensitive
  PEOPLE reads were added, no cross-department owner privileges were granted.
- Support GET reuses the authenticated actor when evaluating permissions,
  checks capabilities in parallel, strips extra customer/product data and
  reports noncritical directory failures instead of hiding case records.
- Customer Trust checks six capabilities concurrently and looks up the bound
  trusted device only once for this read. Supplier/customer supplementary
  catalog calls can time out at 6.5 seconds, Support references at 5.5 seconds.
  Critical core records still fail clearly when genuinely unavailable.
- Public intake is lazy-opened from Support, rather than adding its own
  request to every initial Support page load.

## Existing backend architecture (no unnecessary rebuild)

    Browser / mobile
        |
        | HTTPS + first-party session/AAL2
        v
    Vercel Next.js BFF (per-domain route handlers, dynamic role checks)
        |
        +--> Supabase PostgreSQL (authoritative Office permissions,
        |    department ownership, case/board/trust state, row-level controls,
        |    audit logs and maker-checker workflows)
        |
        +--> Railway FastAPI (legacy customers/products, finance,
             identity and document integration)
                 |
                 +--> SQLAlchemy pool / PostgreSQL
                 +--> Existing cross-replica mutation fixed-window limiter
                 +--> Background jobs (separate worker)

**Do not use a generic ADMIN or CS string as an API bypass.** The frontend
only presents an available workspace; the backend executes the effective
permission check, verifies current owner assignment and honours explicit
denials and managed-device requirements for high-risk operations.

## Existing rate limits and security (verified in source)

- Railway FastAPI already has a shared PostgreSQL mutation limiter, default
  OFFICE_MUTATION_RATE_LIMIT=120 per OFFICE_RATE_LIMIT_WINDOW_SECONDS=60.
- OFFICE_RATE_LIMIT_MODE=database in production; local fallback is restricted.
  In production, OFFICE_REQUIRE_SHARED_RATE_LIMIT defaults to true; if the
  authority is unavailable, mutations return 503 instead of bypassing limits.
- All rate-limited responses return HTTP 429 and Retry-After; the middleware
  reports X-RateLimit-Remaining/Limit/Source.
- It checks allowed hosts, cross-origin mutation restrictions, HTTP security
  headers and first-party authenticated sessions; FastAPI GZip and pool
  recycle/LIFO are already enabled.
- A per-response Server-Timing header measures FastAPI application time.
- **Do not introduce an additional per-process-only rate limiter in Vercel**
  or treat an unverified client-IP header as a secure user identity.
- If usage grows beyond the small in-house Office team, introduce a central
  Redis/Valkey token bucket keyed by authenticated actor+route/action with
  an independent unauthenticated IP budget. Use atomic Lua/Redis functions;
  put the limiter at the authenticated gateway and maintain the current
  fail-closed policy. Review proxy/forwarded-IP trust before enabling it.

## Performance evidence and targets

Live pg_stat_statements at audit:
- Existing first-party session lookup normalization had one query group
  averaging about 82.6ms across 473 calls (historical mean, **not** p95).
- Department permission-verdict RPC activity was a recurring per-request
  authorization cost; permission checks must not be removed to gain speed.
- A small shared_rate_limit_windows table (~16KB) is not itself evidence of
  rate-limit database pressure.

Deployment latency targets (aspirational, not measured achievements):
- Navigation ownership GET: p95 under 300ms at the BFF when backend healthy.
- Support core cases: p95 under 800ms, independent of optional legacy catalogs.
- Customer-trust and board core records: p95 under 1.2s without optional
  provider/catalog waits.
- Auth/OTP: rate limited, auditable, no cache of tokens or decisions.
- Background exports/large files: worker/queue with idempotency and status
  polling; never a long-running request on the Next.js main thread.
- Redis or message broker only after traffic measurements justify the new
  operations/infrastructure footprint.

To **prove** API performance in production, capture non-sensitive
request IDs, Server-Timing, response status and p50/p95/p99 (by path and
method) for at least a representative week. Compare before/after; do not
claim a specific millisecond reduction solely from fewer calls.

## Remaining functional and administrative gaps

- Department ownership exists for 10 of 20 departments. Unassigned functions
  must be formally staffed or assigned by current authority, not displayed
  to Jaya because of generic ADMIN status.
- Admin, Audit, IT and Tax have no dedicated department-specific module
  in OFFICE_DEPARTMENT_SECTIONS; some work exists through personal, Founder
  or Finance routes. Marketing has no operational route.
- Secretarial board minutes, filing and customer assurance reviews require
  actual records, maker-checker and real evidence. Empty states are honest:
  the code must never fabricate cases, customers or meetings.
- Jaya's managed-device enrollment remains a separate prerequisite for
  the sensitive permissions with requires_managed_device=true.
- External GST/Brevo/bank/eSign provider activation is not solved by the
  navigation/access patch; provider credentials and live verification are
  separately tracked.

## Release and acceptance contract

1. All TypeScript/unit/build and isolated PostgreSQL 17 permission tests green.
2. Review actual six-department navigation as Jaya, Customer Support GET/POST,
   customer-only Customer Success GET and restricted actions, Secretarial
   board read, device-denied paths and zero grants to unassigned areas.
3. Apply the single reviewed migration before deploying the dependent Next.js
   code; do not overwrite roles, ownership or active profiles.
4. Deploy only through the correct KRAVIA Vercel team and verify the main
   commit, mobile/desktop routes, errors, and permission denial in production.
5. Observe real p95 and 429/503 behavior before changing infrastructure.
