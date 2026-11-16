# KRAVIA Office: Client-side live work

Builds on the client-side assigned-department navigation already merged into
`main`. No new server routes, database migrations, secrets or role grants.

## Real workflows now equipped with visible-only revalidation
Work Hub; Recruitment; Payroll; IT Service; People Development; Budget;
Asset Lifecycle; Physical Office; Contracts; Portfolio; Customer Support;
Strategy; Knowledge Hub; Workforce Lifecycle; CRM; Company Inbox;
Attendance and Worktime; Organization Chart; Finance Command Center.

Every module already has an authenticated first-party GET source and its
existing authorized action workflows. On an authorized notification
invalidation event, each mounted module fetches its own current records.
Fallback: every 45 seconds for most modules, every 60 seconds for org chart,
and 90 seconds for the costlier finance command center, only in visible tabs.

- No fake records, decorative buttons or generated transaction results.
- No polling of unmounted departments or broad API fan-out.
- Suspend auto-refresh while an edit dialog or mutation is active.
- Backend permission checks and database row/record policy remain authoritative.
- Notification SSE carries only invalidation signals, never protected data.
- A section is not considered operational simply because its route exists.
- Only these 19 modules have been integrated with the shared live hook; other
  modules still need individual source/transaction/notification QA.

## Future scalability
For eventual high-volume use, replace interval fallbacks with a multiplexed
authenticated per-domain change feed; retain ETags, backoff, deduplication,
tenant and department scopes, and active-view subscription ownership.
Client-only change detection without a server event source cannot guarantee
instant updates for every database table.
