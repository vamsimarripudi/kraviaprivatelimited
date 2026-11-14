# KRAVIA Office 5.0 — source-reconciled route and acceptance checklist
Date: 2026-11-14 (Asia/Kolkata) · Draft PR: https://github.com/vamsimarripudi/kraviaprivatelimited/pull/157

## Sources and immutable boundaries

- Source designs: `KRAVIA_Office_5_0_Complete_Approval_Wireframes_REVISED.pdf` (281 pages); `KRAVIA_Office_5_0_Authentication_Private_Screens_Addendum.pdf` (76 pages); `KRAVIA_Connect_Complete_Wireframes.pdf` (93 pages); `KRAVIA_K-Vault_Skeleton_Wireframes.pdf` (32 pages).
- Reference examples: Office atlas p. 9 adaptive work dashboard, Connect p. 4 communication home, K-Vault p. 5 overview; the 76-page auth addendum explicitly calls out QR approval vs device enrollment and security-documentation drift (p. 2).
- Backend sources: canonical FastAPI Office runtime, Supabase versioned migrations, first-party AAL2 sessions, effective-dated Office access profiles and scope-aware permission engine. No roles, production data or company facts have been fabricated.
- Repository base: `main` at `7fda55c835a3b5d8e121b1a745c608bb431599e6`, incorporating merged multi-role fix PR #155.
- Implementation branch: `feature/kravia-office-5-implementation-20261114`. Draft PR #157 remains unmerged. No production Vercel/Railway deployment, IAM changes, employee messages, invitations or production DB migrations are authorized.
- Test terminology: **Coded** means a route/component exists, not certified. **Bridge** means source-owned workflows are exposed without a dedicated Connect/Vault implementation. **Acceptance outstanding** means authenticated UI and role-matrix testing has not been demonstrated.

## Implementation status, verified against the branch

| Area | Source inventory | Implemented on branch | Remaining acceptance |
|---|---|---|---|
| Existing Office registry | 55 | 55 unchanged route definitions, 5.0 shared shell | Individual route interaction/keyboard/role QA at 360–1920px |
| Existing Finance registry | 24 | 24 unchanged route definitions, shared 5.0 CSS and Finance sign-in | Per-module layout, finance SoD, access and responsive regression |
| Existing secure access | 15 audit tracks | Existing password/email/MFA/QR/recovery logic preserved; shared layouts | Detailed 76-page addendum state validation, native Authenticator UX |
| Connect | 38 atlas route designs | Private DM/group/department chat, keyed message pagination and revision audit, scoped search/saved/mentions, reactions/pins, governed settings, permissions/channels/retention, IT and customer support case queues, source-bounded analytics and governance home | Remaining generic activity, macros, AI, approval list, integration lifecycle, push/presence/SLA policy editing; full 41 overlays and 8 mobile acceptance |
| K-Vault | 12 atlas routes | Permission-filtered source directory, governed grants and requests, current evidence downloads/previews, own audit log/overview; newly scoped and independently reviewed Registration Registry evidence queue | Other source categories' independent verification, evidence upload and version proposals, full grant/revocation and restricted-role QA |

## Existing Office routes — 55

All routes below continue to use their canonical implementation. 5.0 shell styling is applied. No completion claim is made for every specialized modal.

| Route | Code inventory | Acceptance |
|---|---|---|
| `/office/dashboard` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/my-role` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/info` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/notifications` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/tasks` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/calendar` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/requests` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/approvals` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/manager` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/department-ownership` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/decisions` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/strategy` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/intelligence` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/products` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/portfolio` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/customers` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/crm` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/engineering` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/governance` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/compliance` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/registrations` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/knowledge` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/documents` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/contracts` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/vendors` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/recruitment` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/people` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/emergency` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/development` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/travel` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/cards` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/payroll` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/worktime` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/budget` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/assets` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/devices` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/it` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/facilities` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/support` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/role-packages` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/access` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/data` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/privacy` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/ethics` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/resilience` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/ai` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/quality` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/trust` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/security` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/integrations` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/domains` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/custody` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/readiness` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/audit` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |
| `/office/settings` | Retained, styled through shared Office 5.0 shell | [ ] Authenticated desktop/tablet/mobile, low-privilege and keyboard QA |

## Existing Finance routes — 24

| Route | Code inventory | Acceptance |
|---|---|---|
| `/finance/dashboard` | Retained, styled through shared Finance 5.0 shell | [ ] Finance scope, separation of duties, responsive and error-recovery QA |
| `/finance/my-role` | Retained, styled through shared Finance 5.0 shell | [ ] Finance scope, separation of duties, responsive and error-recovery QA |
| `/finance/worktime` | Retained, styled through shared Finance 5.0 shell | [ ] Finance scope, separation of duties, responsive and error-recovery QA |
| `/finance/info` | Retained, styled through shared Finance 5.0 shell | [ ] Finance scope, separation of duties, responsive and error-recovery QA |
| `/finance/customers` | Retained, styled through shared Finance 5.0 shell | [ ] Finance scope, separation of duties, responsive and error-recovery QA |
| `/finance/billing` | Retained, styled through shared Finance 5.0 shell | [ ] Finance scope, separation of duties, responsive and error-recovery QA |
| `/finance/payroll` | Retained, styled through shared Finance 5.0 shell | [ ] Finance scope, separation of duties, responsive and error-recovery QA |
| `/finance/budget` | Retained, styled through shared Finance 5.0 shell | [ ] Finance scope, separation of duties, responsive and error-recovery QA |
| `/finance/gst` | Retained, styled through shared Finance 5.0 shell | [ ] Finance scope, separation of duties, responsive and error-recovery QA |
| `/finance/accounting` | Retained, styled through shared Finance 5.0 shell | [ ] Finance scope, separation of duties, responsive and error-recovery QA |
| `/finance/banking` | Retained, styled through shared Finance 5.0 shell | [ ] Finance scope, separation of duties, responsive and error-recovery QA |
| `/finance/payments` | Retained, styled through shared Finance 5.0 shell | [ ] Finance scope, separation of duties, responsive and error-recovery QA |
| `/finance/expenses` | Retained, styled through shared Finance 5.0 shell | [ ] Finance scope, separation of duties, responsive and error-recovery QA |
| `/finance/reconciliation` | Retained, styled through shared Finance 5.0 shell | [ ] Finance scope, separation of duties, responsive and error-recovery QA |
| `/finance/ownership` | Retained, styled through shared Finance 5.0 shell | [ ] Finance scope, separation of duties, responsive and error-recovery QA |
| `/finance/documents` | Retained, styled through shared Finance 5.0 shell | [ ] Finance scope, separation of duties, responsive and error-recovery QA |
| `/finance/compliance` | Retained, styled through shared Finance 5.0 shell | [ ] Finance scope, separation of duties, responsive and error-recovery QA |
| `/finance/cards` | Retained, styled through shared Finance 5.0 shell | [ ] Finance scope, separation of duties, responsive and error-recovery QA |
| `/finance/insurance` | Retained, styled through shared Finance 5.0 shell | [ ] Finance scope, separation of duties, responsive and error-recovery QA |
| `/finance/ethics` | Retained, styled through shared Finance 5.0 shell | [ ] Finance scope, separation of duties, responsive and error-recovery QA |
| `/finance/emergency` | Retained, styled through shared Finance 5.0 shell | [ ] Finance scope, separation of duties, responsive and error-recovery QA |
| `/finance/ai` | Retained, styled through shared Finance 5.0 shell | [ ] Finance scope, separation of duties, responsive and error-recovery QA |
| `/finance/audit` | Retained, styled through shared Finance 5.0 shell | [ ] Finance scope, separation of duties, responsive and error-recovery QA |
| `/finance/settings` | Retained, styled through shared Finance 5.0 shell | [ ] Finance scope, separation of duties, responsive and error-recovery QA |

## Connect atlas routes — 38

| Route | Current coding state | Outstanding |
|---|---|---|
| `/office/chat` | Dedicated component or source-backed interaction | [ ] Source-to-wireframe and authenticated authorization acceptance |
| `/office/chat/dm/[id]` | Dedicated component or source-backed interaction | [ ] Source-to-wireframe and authenticated authorization acceptance |
| `/office/chat/groups/[id]` | Dedicated component or source-backed interaction | [ ] Source-to-wireframe and authenticated authorization acceptance |
| `/office/chat/channels/[code]` | Dedicated component or source-backed interaction | [ ] Source-to-wireframe and authenticated authorization acceptance |
| `/office/chat/mentions` | Dedicated component or source-backed interaction | [ ] Source-to-wireframe and authenticated authorization acceptance |
| `/office/chat/threads/[id]` | Dedicated component or source-backed interaction | [ ] Source-to-wireframe and authenticated authorization acceptance |
| `/office/chat/directory` | Dedicated component or source-backed interaction | [ ] Source-to-wireframe and authenticated authorization acceptance |
| `/office/chat/saved` | Dedicated component or source-backed interaction | [ ] Source-to-wireframe and authenticated authorization acceptance |
| `/office/chat/files` | Dedicated component or source-backed interaction | [ ] Source-to-wireframe and authenticated authorization acceptance |
| `/office/chat/search` | Dedicated component or source-backed interaction | [ ] Source-to-wireframe and authenticated authorization acceptance |
| `/office/chat/announcements` | Dedicated component or source-backed interaction | [ ] Source-to-wireframe and authenticated authorization acceptance |
| `/office/chat/activity` | Canonical Office workflow bridge; dedicated 5.0 UX incomplete | [ ] Source-to-wireframe and authenticated authorization acceptance |
| `/office/chat/ai` | Canonical Office workflow bridge; dedicated 5.0 UX incomplete | [ ] Source-to-wireframe and authenticated authorization acceptance |
| `/office/chat/support` | Dedicated component or source-backed interaction | [ ] Source-to-wireframe and authenticated authorization acceptance |
| `/office/chat/support/new` | Dedicated component or source-backed interaction | [ ] Source-to-wireframe and authenticated authorization acceptance |
| `/office/chat/support/mine` | Dedicated component or source-backed interaction | [ ] Source-to-wireframe and authenticated authorization acceptance |
| `/office/chat/support/assigned` | Dedicated component or source-backed interaction | [ ] Source-to-wireframe and authenticated authorization acceptance |
| `/office/chat/support/team` | Dedicated component or source-backed interaction | [ ] Source-to-wireframe and authenticated authorization acceptance |
| `/office/chat/support/tickets/[id]` | Dedicated component or source-backed interaction | [ ] Source-to-wireframe and authenticated authorization acceptance |
| `/office/chat/support/escalations` | Dedicated component or source-backed interaction | [ ] Source-to-wireframe and authenticated authorization acceptance |
| `/office/chat/support/escalations/[id]` | Dedicated component or source-backed interaction | [ ] Source-to-wireframe and authenticated authorization acceptance |
| `/office/chat/support/sla` | Dedicated component or source-backed interaction | [ ] Source-to-wireframe and authenticated authorization acceptance |
| `/office/chat/support/knowledge` | Dedicated component or source-backed interaction | [ ] Source-to-wireframe and authenticated authorization acceptance |
| `/office/chat/support/knowledge/[id]` | Dedicated component or source-backed interaction | [ ] Source-to-wireframe and authenticated authorization acceptance |
| `/office/chat/support/analytics` | Source-bounded case aggregates and weekly demand visualization | [ ] Source-to-wireframe and authenticated authorization acceptance |
| `/office/chat/support/macros` | Canonical Office workflow bridge; dedicated 5.0 UX incomplete | [ ] Source-to-wireframe and authenticated authorization acceptance |
| `/office/chat/support/customers` | Scoped, two-pane Customer Support case inspector (no outward sends) | [ ] Source-to-wireframe and authenticated authorization acceptance |
| `/office/chat/approvals` | Canonical Office workflow bridge; dedicated 5.0 UX still outstanding | [ ] Source-to-wireframe and authenticated authorization acceptance |
| `/office/chat/approvals/[id]` | Dedicated component or source-backed interaction | [ ] Source-to-wireframe and authenticated authorization acceptance |
| `/office/chat/settings` | Dedicated server-scoped preferences and device-local appearance controls | [ ] Source-to-wireframe and authenticated authorization acceptance |
| `/office/chat/admin` | Read-only source-backed communication governance home | [ ] Source-to-wireframe and authenticated authorization acceptance |
| `/office/chat/admin/channels` | Canonical Office workflow bridge; dedicated 5.0 UX incomplete | [ ] Source-to-wireframe and authenticated authorization acceptance |
| `/office/chat/admin/queues` | Source-limited IT and Customer Support queue ownership table | [ ] Source-to-wireframe and authenticated authorization acceptance |
| `/office/chat/admin/sla` | Source-only deadlines with no synthetic SLA timer | [ ] Source-to-wireframe and authenticated authorization acceptance |
| `/office/chat/admin/retention` | Canonical Office workflow bridge; dedicated 5.0 UX incomplete | [ ] Source-to-wireframe and authenticated authorization acceptance |
| `/office/chat/admin/integrations` | Canonical Office workflow bridge; dedicated 5.0 UX incomplete | [ ] Source-to-wireframe and authenticated authorization acceptance |
| `/office/chat/admin/permissions` | Canonical Office workflow bridge; dedicated 5.0 UX incomplete | [ ] Source-to-wireframe and authenticated authorization acceptance |
| `/office/chat/wireframe-lab` | Internal design specimen intentionally not a production route | [ ] Source-to-wireframe and authenticated authorization acceptance |

### Connect cross-cutting acceptance

- [x] Active Office AAL2 actor and direct membership read checks in new API.
- [x] Effective department filtering on conversation list, unread counts, search, saved items and mentions.
- [x] Local-isolated SQL migration suites for DM, group, department, threads, mentions, saved and IT escalation flows (tests are not production migrations).
- [x] Scanner-confirmed chat attachments rely on the existing FastAPI file-scan endpoint and private bucket, but runtime scanner availability requires authenticated integration proof.
- [x] New approval actions reuse canonical Office request/decision RPCs; chat does not substitute for approvals.
- [x] New Connect home reads unread counts, assigned IT work, approvals and escalations from current authorized sources without fake zeroes.
- [ ] All 41 overlay specimens and 8 mobile modal states visually checked; no cropped popups.
- [ ] Full WebSocket/realtime presence, message push/in-app notification delivery and retention controls.
- [ ] Customer Support-specific ticket-linked notes, macro governance, SLA escalation policies and multi-tenant customer privacy acceptance.
- [ ] Full group/channel administration, project channels and advanced message analytics.
- [ ] Authenticated browser checks for scopes, revoked membership, expired sessions, attachment IDOR and responsive screenshots.

## K-Vault atlas routes — 12

| Route | Current coding state | Outstanding |
|---|---|---|
| `/office/k-vault` | Source-backed overview / permission-filtered metrics | [ ] Specialized forms, live permission/grant and mobile acceptance |
| `/office/k-vault/company` | Registration source projection | [ ] Specialized forms, live permission/grant and mobile acceptance |
| `/office/k-vault/categories` | Permission-filtered directory | [ ] Specialized forms, live permission/grant and mobile acceptance |
| `/office/k-vault/categories/[slug]` | Canonical registration, document and custody projections; other categories bridge to authority | [ ] Specialized forms, live permission/grant and mobile acceptance |
| `/office/k-vault/records/[id]` | Registration lookup; current source and Vault grant required | [ ] Specialized forms, live permission/grant and mobile acceptance |
| `/office/k-vault/documents` | Granted Document Studio directory | [ ] Specialized forms, live permission/grant and mobile acceptance |
| `/office/k-vault/documents/[id]` | Versioned Document Studio references, secure preview/download | [ ] Specialized forms, live permission/grant and mobile acceptance |
| `/office/k-vault/requests` | Access requests, withdrawal, expiration | [ ] Specialized forms, live permission/grant and mobile acceptance |
| `/office/k-vault/access` | Independent reviewer, scoped grants and revocation | [ ] Specialized forms, live permission/grant and mobile acceptance |
| `/office/k-vault/reviews` | Independent Vault-granted registration evidence review using canonical source decision; other record types still source-owned | [ ] Specialized forms, live permission/grant and mobile acceptance |
| `/office/k-vault/activity` | Own-identity access audit events only | [ ] Specialized forms, live permission/grant and mobile acceptance |
| `/office/k-vault/settings` | Existing Office Settings source bridge | [ ] Specialized forms, live permission/grant and mobile acceptance |

### K-Vault controls

- [x] Source permissions are additive to independent Vault grants for sensitive record metadata and protected downloads/previews.
- [x] Independent source-qualified grant review, justification, expiry, revocation and withdrawal through service-role-only RPCs.
- [x] Masked identifiers, metadata-only directory, separate Secure Custody and Document Studio services; never store signing PINs, cryptographic keys or recovery phrases.
- [x] Employee-only Vault event feed filtered by authenticated actor ID; no organization-wide audit enumeration by default.
- [ ] Source-specific verified uploads, antivirus quarantine, version comparison and independent document sign-off flow.
- [ ] Reviewer/device and maker-checker acceptance with real restricted test identities.
- [ ] Evidence release and record-level grant expiry/revocation tests against the complete Office staging database.

## Authentication/private-state checklist — 15 flows

| Source flow | Current code boundary | Acceptance |
|---|---|---|
| Office sign-in | Unified branded Office/Finance access layout | [ ] 76-page addendum mapping, error/empty/loading/recovery, keyboard and 360–1920px QA |
| Finance sign-in | Unified branded Office/Finance access layout | [ ] 76-page addendum mapping, error/empty/loading/recovery, keyboard and 360–1920px QA |
| Email OTP | Existing verified-first-party flow preserved | [ ] 76-page addendum mapping, error/empty/loading/recovery, keyboard and 360–1920px QA |
| Password | Existing verified-first-party flow preserved | [ ] 76-page addendum mapping, error/empty/loading/recovery, keyboard and 360–1920px QA |
| TOTP MFA | Existing verified-first-party flow preserved | [ ] 76-page addendum mapping, error/empty/loading/recovery, keyboard and 360–1920px QA |
| Browser QR approval | Existing verified-first-party flow preserved | [ ] 76-page addendum mapping, error/empty/loading/recovery, keyboard and 360–1920px QA |
| Trusted device approval | Existing verified-first-party flow preserved | [ ] 76-page addendum mapping, error/empty/loading/recovery, keyboard and 360–1920px QA |
| Authenticator installation | Existing verified-first-party flow preserved | [ ] 76-page addendum mapping, error/empty/loading/recovery, keyboard and 360–1920px QA |
| Native app enrollment | Existing verified-first-party flow preserved | [ ] 76-page addendum mapping, error/empty/loading/recovery, keyboard and 360–1920px QA |
| Employee invitation | Existing verified-first-party flow preserved | [ ] 76-page addendum mapping, error/empty/loading/recovery, keyboard and 360–1920px QA |
| Registration & activation | Existing verified-first-party flow preserved | [ ] 76-page addendum mapping, error/empty/loading/recovery, keyboard and 360–1920px QA |
| Password reset | Existing verified-first-party flow preserved | [ ] 76-page addendum mapping, error/empty/loading/recovery, keyboard and 360–1920px QA |
| Founder recovery | Existing verified-first-party flow preserved | [ ] 76-page addendum mapping, error/empty/loading/recovery, keyboard and 360–1920px QA |
| Session expiration | Existing verified-first-party flow preserved | [ ] 76-page addendum mapping, error/empty/loading/recovery, keyboard and 360–1920px QA |
| Sessions/trusted device management | Existing verified-first-party flow preserved | [ ] 76-page addendum mapping, error/empty/loading/recovery, keyboard and 360–1920px QA |

## CI and release gates

- [x] Green CI existed on branch commit `35de78ce9750c327e486e0dc39fdbb91f6830ddb`: frontend, backend, Office browser E2E, isolated Connect/Vault/IT security, discovery.
- [ ] Recheck all gates after **latest branch changes**, including the 202611140009 unread snapshot and the updated dashboard/activity screens. Do not call them green without commit-matched check results.
- [ ] Rehearse the entire ordered Supabase migration chain against an isolated copy of the relevant canonical Office schema and private storage policies; unit test stubs alone are insufficient.
- [ ] AAL2 session security and role matrix: Owner, Director/Finance/HR/Member/Product Admin, delegated heads, ordinary employee, trainee, restricted adviser and no-onboarding employee.
- [ ] Browser E2E screenshots at 360, 390, 430, 768, 900, 1024, 1280, 1440 and 1920 px in light and dark modes; screenshot artifacts must represent real rendered application screens.
- [ ] Keyboard focus/return, validation semantics, screen-reader labels, reduced motion and WCAG 2.2 AA contrast checks for every critical state.
- [ ] Security review: source overrides, accidental title-to-permission mappings, IDOR, session expiration, employee transfer, finance/payroll and approval segregation.
- [ ] Full migration backup/rollback, release note, main merge, production migration and Vercel/Railway rollout **only after separate explicit approval**.

**Status:** implementation is active, not complete or deployable. This ledger distinguishes coded components from validated enterprise behavior. The original documents are a *design baseline*, not evidence that production screens are working.


## 14 November 2026 implementation addendum — code audited, release NOT approved

The feature branch has continued beyond the initial 35-commit checkpoint. New GitHub commits were made **only** to `feature/kravia-office-5-implementation-20261114`; PR #157 is still draft and not merged into main. Developer/owner restrictions explicitly prohibit Vercel previews, staging or production deployments, production Supabase migrations, IAM changes and outbound employee messaging at this stage.

### Connect changes now coded

- The prior code supports member-scoped direct/group/department messaging, current-department write guards, deduplicated message IDs, saved/mentions, private scanner-verified attachments, pins, reactions and immutable message revisions. Revoked department membership no longer authorizes indexed reads or message edits.
- Chat now provides a **50-message keyset-paginated** history endpoint with server-checked current membership for every page, timestamp and UUID cursor validation, bounded responses, persistent older-page scroll and re-fetch of recent messages. Pagination does not retroactively authorize revoked or deleted messages; authenticated browser verification remains outstanding.
- `/office/chat/settings` now combines the first-party actor-specific preference ledger (`office_chat_user_preferences`) with device-local theme, reduced animation and Connect-home display choices. Email digests and read-receipt sharing are *consents/preferences only*; neither delivery nor peer receipt publication is implemented or authorized.
- `/office/chat/admin` is a real read-only source-backed overview, and `/office/chat/admin/queues`, `/office/chat/admin/sla` use current Office IT and Customer Support records. Counts are always scoped and bounded (500 IT / 400 Customer Support); unavailable or forbidden sources display “—”, not fictional zeroes. Due dates use current source evidence, **not** invented SLA or escalation policy values.
- `/office/chat/support/customers` is a two-pane authorized customer case inspector. Event detail notes are not exposed as customer-visible text without independent classification. `/office/chat/support/analytics` aggregates permitted source records (period, active, urgent, due dates, median closure, eight weekly buckets) and explicitly warns about pagination limits. Neither route makes external sends, refunds or privilege changes.
- New source-only pure tests cover chat pagination, scoped queue and case analytics, personal preference parsing; browser regression extends anonymous/cross-origin denial to private chat history cursors and K-Vault evidence review endpoints.

### K-Vault changes now coded

- `/office/k-vault/reviews` separates **registration evidence verification** from **Vault access grant review**. The new `/api/office-vault/verification` returns only UNVERIFIED registrations visible under *both* a canonical source permission and an active Vault category/record grant. The queue excludes records created by the reviewer.
- POST decisions require an authenticated same-origin session, a fresh scoped-record grant, an independent reviewer, a recorded rationale and authoritative evidence reference for ACTIVE. Commit uses the existing Registration Registry's maker-checker workflow; the route does not store credentials or authorize release of protected files. Other categories' independent verification, signed document review and quarantine lifecycle remain outstanding.

### Acceptance and release boundary

- **Code committed does not mean 281-page Office / 76-page Auth / 93-page Connect / 32-page K-Vault acceptance is complete.** The shared 5.0 shell covers all 55 Office and 24 Finance route definitions, but specialized screen-by-screen interactions, overlays, mobile states, keyboard/focus/contrast and genuine multi-role behavior are not yet fully tested.
- Required before production authorization: complete isolated full-schema migration rehearsal (new chat/Vault migrations), verified scanner and private storage, real AAL2 role scenarios (including HR/Finance separation, restricted employee, Manohar access), revoked-grant and document-IDOR test identities, Authenticator native testing, responsive 360–1920 authenticated artifacts, WCAG 2.2 AA checks, release rollback runbook.
- The latest complete GH Actions check run **must** be attached to the exact final branch head before declaring green. Passing older commits is not evidence for later code. No Vercel preview, production deployment, database migration or main merge should occur until an explicit separate release instruction.
