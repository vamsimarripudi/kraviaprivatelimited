# KRAVIA Office 6 — Client-only live workspace contract

## Scope
- No new server endpoints, database migrations, service roles, or credential changes.
- The React shell derives assigned departments using the existing authorized
  `GET /api/office-departments` response plus the identity's server-provided primary department.
- Only active ownership and existing section capability permissions can produce department tabs.
- A team member without ownership of a second department cannot be inferred to
  hold a second job assignment unless that assignment is exposed by the existing first-party API.
  Future multi-department staff membership needs an authorized data contract—not localStorage.

## Operating UI
- The sidebar is a department switcher, not a catalog of all company departments.
- Personal work remains visible; unassigned modules are omitted from sidebar,
  global navigation search, prefetch and dashboard shortcuts.
- Company Control is deliberately separated from operations and only shown for
  a Founder with the necessary existing capabilities.
- The frontend also suppresses unassigned client content on direct route visits,
  but the backend's existing API and database enforcement is the security boundary.

## Live-data approach
- Reuse the existing first-party notification SSE change events for invalidation.
- Revalidate the **active mounted module only**, never all 56 modules per interval.
- A 45-second visible-tab fallback handles changes that do not send notifications.
- Focus and tab visibility cause an opportunistic recheck; in-flight refreshes dedupe.
- Pause revalidation during active form dialogs or mutations; never clear drafts.
- Existing domain APIs remain authoritative; no generated fake records or placeholder values.
- The first integrated live modules: Work Hub, Recruitment, Payroll and IT Service.
- The department directory itself rechecks every 30 seconds while visible, plus on
  ownership acceptance and browser focus.
- Realtime push freshness is not guaranteed for every business table: other modules
  require individual subscription/refresh integration or an authorized event feed.

## Expansion and acceptance criteria
For each remaining domain module, verify a real GET source and working write
actions, scoped access, controlled retry, loading/empty states, visible-only polling,
audit events and notifications. Do not mark a section complete because its route renders.

Do not weaken existing per-record / device / maker-checker authorization to
make a client-side-only navigation feature seem fully secure.
