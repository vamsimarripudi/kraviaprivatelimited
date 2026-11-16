# KRAVIA Office 6 — Client-side live business workflows

## Scope (16 November 2026)
This release **preserves** the assigned-department client navigation already
merged to main. It adds a common client-only refresh hook to **66 existing,
API-backed business modules**, across Office and Finance, without modifying
server routes, the database, secrets, permissions or any employee assignments.

## Mechanism
1. Existing authorized Office notification SSE changes invalidate visible module
   data. The notification payload does not disclose private business records.
2. A single small hook per **mounted** component reuses its already authorized
   GET API. No API fetch is started for an unmounted department or hidden tab.
3. Fallback refresh intervals are 30–180 seconds according to module cost.
   Bursty invalidation events are throttled; one request at a time per module.
4. While forms, dialogs or mutations are active, refresh is suspended so
   unsaved data is not replaced. Finance views update source arrays without
   reopening approval dialogs or resetting financial drafts.
5. Existing real loading/empty/error/permission-denied UI is preserved.
   No fake business metrics, fixture rows, success records or placeholder data
   are introduced.

## Six intentionally separate clients
- workforce-live-overview: already has its own 15-second live workforce loop.
- office-settings-hub: local user appearance/preferences, not a shared record.
- office-document-otp: approval challenge/OTP lifecycle cannot be auto-reset.
- office-employee-intake: sensitive onboarding data and file uploads.
- office-emergency-contacts: audited privileged reveal state must not be
  unexpectedly cleared by a refresh.
- office-hr-attendance-import: multi-step file import/validation drafts.

## Realtime truth and scaling
This is **near-live client revalidation**, not guaranteed push for every table
mutation. Only changes already signaled by the existing notification service
are immediate; other sources refresh on their bounded intervals and tab focus.
Guaranteeing event-by-event sync, offline replay or exact sequencing for every
company record would require a backend change, specifically excluded by the
client-only directive.

Network cost scales with open/mounted authorized views rather than 20
departments times every signed-in user. Authorization is still enforced by
the existing first-party APIs and database controls; hiding a section in React
does not grant or revoke access.

## Validation
The regression test verifies all 72 dynamically imported Office component
types: 66 integrated and six protected/locally-managed exceptions. All 56
currently declared Office sections retain an explicit route implementation.
Lint, typecheck, unit tests and deployment checks must pass before merge.
Integration testing against authenticated company roles is still required
before asserting every external operation is fully production-ready.
