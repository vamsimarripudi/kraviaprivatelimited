# KRAVIA OFFICE 5.0 — Implementation and QA checklist

Baseline: `vamsimarripudi/kraviaprivatelimited`, `main` at `7fda55c835a3b5d8e121b1a745c608bb431599e6` after merged PR #155. Branch: `feature/kravia-office-5-implementation-20261114`. No production deployment authorized.

Design references: revised Office 281 pages; authentication addendum 76 pages; Connect 93 pages; K-Vault 32 pages. Space search found only a parent KRAVIA command Space and its small public project pages; full PDF content was retrieved from the user's Library and attached files instead.

**Status definitions:** `Built` means code exists on feature branch, **not** tested or production ready. `Bridge` means a functional entry into a current canonical workflow, not the final dedicated design. `Pending` means complete standalone implementation/UX and proof still required. Neither new feature may be called complete while migration rehearsal or integration tests are missing.

## Existing Office registry (55 registered screens)

| Route | Current implementation | Office 5.0 validation |
|---|---|---|
| `/office/dashboard` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/my-role` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/info` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/notifications` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/tasks` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/calendar` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/requests` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/approvals` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/manager` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/department-ownership` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/decisions` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/strategy` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/intelligence` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/products` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/portfolio` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/customers` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/crm` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/engineering` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/governance` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/compliance` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/registrations` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/knowledge` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/documents` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/contracts` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/vendors` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/recruitment` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/people` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/emergency` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/development` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/travel` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/cards` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/payroll` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/worktime` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/budget` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/assets` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/devices` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/it` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/facilities` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/support` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/role-packages` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/access` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/data` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/privacy` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/ethics` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/resilience` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/ai` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/quality` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/trust` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/security` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/integrations` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/domains` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/custody` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/readiness` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/audit` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/office/settings` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |

## Existing Finance registry (24 registered screens)

| Route | Current implementation | Office 5.0 validation |
|---|---|---|
| `/finance/dashboard` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/finance/my-role` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/finance/worktime` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/finance/info` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/finance/customers` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/finance/billing` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/finance/payroll` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/finance/budget` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/finance/gst` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/finance/accounting` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/finance/banking` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/finance/payments` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/finance/expenses` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/finance/reconciliation` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/finance/ownership` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/finance/documents` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/finance/compliance` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/finance/cards` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/finance/insurance` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/finance/ethics` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/finance/emergency` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/finance/ai` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/finance/audit` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |
| `/finance/settings` | Existing canonical workflow retained; shared 5.0 shell | [ ] Per-route desktop/mobile/a11y/permissions regression |

## Connect atlas (38 proposed route designs)

| Route | Current status | Remaining proof / work |
|---|---|---|
| `/office/chat` | Built | [ ] Real API, states, responsive QA, authorization and full wireframe interaction coverage |
| `/office/chat/dm/[id]` | Built | [ ] Real API, states, responsive QA, authorization and full wireframe interaction coverage |
| `/office/chat/groups/[slug]` | Pending | [ ] Real API, states, responsive QA, authorization and full wireframe interaction coverage |
| `/office/chat/channels/[slug]` | Pending | [ ] Real API, states, responsive QA, authorization and full wireframe interaction coverage |
| `/office/chat/mentions` | Pending | [ ] Real API, states, responsive QA, authorization and full wireframe interaction coverage |
| `/office/chat/threads/[id]` | Pending | [ ] Real API, states, responsive QA, authorization and full wireframe interaction coverage |
| `/office/chat/directory` | Built | [ ] Real API, states, responsive QA, authorization and full wireframe interaction coverage |
| `/office/chat/saved` | Pending | [ ] Real API, states, responsive QA, authorization and full wireframe interaction coverage |
| `/office/chat/files` | Pending | [ ] Real API, states, responsive QA, authorization and full wireframe interaction coverage |
| `/office/chat/search` | Pending | [ ] Real API, states, responsive QA, authorization and full wireframe interaction coverage |
| `/office/chat/announcements` | Pending | [ ] Real API, states, responsive QA, authorization and full wireframe interaction coverage |
| `/office/chat/activity` | Bridge | [ ] Real API, states, responsive QA, authorization and full wireframe interaction coverage |
| `/office/chat/ai` | Pending | [ ] Real API, states, responsive QA, authorization and full wireframe interaction coverage |
| `/office/chat/support` | Bridge | [ ] Real API, states, responsive QA, authorization and full wireframe interaction coverage |
| `/office/chat/support/new` | Pending | [ ] Real API, states, responsive QA, authorization and full wireframe interaction coverage |
| `/office/chat/support/mine` | Pending | [ ] Real API, states, responsive QA, authorization and full wireframe interaction coverage |
| `/office/chat/support/assigned` | Pending | [ ] Real API, states, responsive QA, authorization and full wireframe interaction coverage |
| `/office/chat/support/team` | Pending | [ ] Real API, states, responsive QA, authorization and full wireframe interaction coverage |
| `/office/chat/support/tickets/[id]` | Pending | [ ] Real API, states, responsive QA, authorization and full wireframe interaction coverage |
| `/office/chat/support/escalations` | Pending | [ ] Real API, states, responsive QA, authorization and full wireframe interaction coverage |
| `/office/chat/support/escalations/[id]` | Pending | [ ] Real API, states, responsive QA, authorization and full wireframe interaction coverage |
| `/office/chat/support/sla` | Pending | [ ] Real API, states, responsive QA, authorization and full wireframe interaction coverage |
| `/office/chat/support/knowledge` | Pending | [ ] Real API, states, responsive QA, authorization and full wireframe interaction coverage |
| `/office/chat/support/knowledge/[slug]` | Pending | [ ] Real API, states, responsive QA, authorization and full wireframe interaction coverage |
| `/office/chat/support/analytics` | Pending | [ ] Real API, states, responsive QA, authorization and full wireframe interaction coverage |
| `/office/chat/support/macros` | Pending | [ ] Real API, states, responsive QA, authorization and full wireframe interaction coverage |
| `/office/chat/support/customers` | Pending | [ ] Real API, states, responsive QA, authorization and full wireframe interaction coverage |
| `/office/chat/approvals` | Bridge | [ ] Real API, states, responsive QA, authorization and full wireframe interaction coverage |
| `/office/chat/approvals/[id]` | Pending | [ ] Real API, states, responsive QA, authorization and full wireframe interaction coverage |
| `/office/chat/settings` | Pending | [ ] Real API, states, responsive QA, authorization and full wireframe interaction coverage |
| `/office/chat/admin` | Pending | [ ] Real API, states, responsive QA, authorization and full wireframe interaction coverage |
| `/office/chat/admin/channels` | Pending | [ ] Real API, states, responsive QA, authorization and full wireframe interaction coverage |
| `/office/chat/admin/queues` | Pending | [ ] Real API, states, responsive QA, authorization and full wireframe interaction coverage |
| `/office/chat/admin/sla` | Pending | [ ] Real API, states, responsive QA, authorization and full wireframe interaction coverage |
| `/office/chat/admin/retention` | Pending | [ ] Real API, states, responsive QA, authorization and full wireframe interaction coverage |
| `/office/chat/admin/integrations` | Pending | [ ] Real API, states, responsive QA, authorization and full wireframe interaction coverage |
| `/office/chat/admin/permissions` | Pending | [ ] Real API, states, responsive QA, authorization and full wireframe interaction coverage |
| `/office/chat/wireframe-lab` | Design-only, must stay non-production | [ ] Real API, states, responsive QA, authorization and full wireframe interaction coverage |

**Connect controls:** 41 overlay specimens + 8 mobile variants: [ ] each default/hover/focus/loading/success/error/retry/403/expired/offline state. [ ] permission-aware attachments, quarantine and malware scanning. [ ] private/groups/channels/threads and durable read/presence/notifications. [ ] escalation/SLA integrated with canonical IT and Customer Support. [ ] formal approval boundary and independent MFA. [ ] controlled outbound sender. [ ] reduced-motion, screen-reader and keyboard navigation.

## K-Vault atlas (12 proposed routes)

| Route | Current status | Remaining proof / work |
|---|---|---|
| `/office/k-vault` | Source-backed | [ ] Scope and source authorization, record-level grants, independent verification, mobile and audit acceptance |
| `/office/k-vault/company` | Source-backed | [ ] Scope and source authorization, record-level grants, independent verification, mobile and audit acceptance |
| `/office/k-vault/categories` | Source-backed | [ ] Scope and source authorization, record-level grants, independent verification, mobile and audit acceptance |
| `/office/k-vault/categories/[slug]` | Source-backed partial | [ ] Scope and source authorization, record-level grants, independent verification, mobile and audit acceptance |
| `/office/k-vault/records/[id]` | Source-backed partial | [ ] Scope and source authorization, record-level grants, independent verification, mobile and audit acceptance |
| `/office/k-vault/documents` | Source-backed | [ ] Scope and source authorization, record-level grants, independent verification, mobile and audit acceptance |
| `/office/k-vault/documents/[id]` | Source-backed partial | [ ] Scope and source authorization, record-level grants, independent verification, mobile and audit acceptance |
| `/office/k-vault/requests` | Source-backed | [ ] Scope and source authorization, record-level grants, independent verification, mobile and audit acceptance |
| `/office/k-vault/access` | Canonical workflow bridge | [ ] Scope and source authorization, record-level grants, independent verification, mobile and audit acceptance |
| `/office/k-vault/reviews` | Canonical workflow bridge | [ ] Scope and source authorization, record-level grants, independent verification, mobile and audit acceptance |
| `/office/k-vault/activity` | Canonical workflow bridge | [ ] Scope and source authorization, record-level grants, independent verification, mobile and audit acceptance |
| `/office/k-vault/settings` | Canonical workflow bridge | [ ] Scope and source authorization, record-level grants, independent verification, mobile and audit acceptance |

**Vault safeguards:** [x] permission-filtered category index; [x] no raw secrets in new Vault records; [x] canonical registration/Document Studio/Secure Custody integrations; [ ] formal per-record/action grants, expiry/revoke, reviewer independence, audit; [ ] safe authenticated preview with scan/quarantine gating; [ ] upload and version proposals; [ ] no metadata enumeration test.

## Authentication/private screens (15 audit tracks)

| Flow | Work required |
|---|---|
| Office sign-in | Shared form branding applied; [ ] End-to-end proof; responsive 360–1920px; WCAG 2.2 AA |
| Finance sign-in | Shared form branding applied; [ ] End-to-end proof; responsive 360–1920px; WCAG 2.2 AA |
| Email OTP verification | Existing security flow retained; [ ] End-to-end proof; responsive 360–1920px; WCAG 2.2 AA |
| Password challenge | Existing security flow retained; [ ] End-to-end proof; responsive 360–1920px; WCAG 2.2 AA |
| MFA challenge | Existing security flow retained; [ ] End-to-end proof; responsive 360–1920px; WCAG 2.2 AA |
| Trusted device approval | Existing security flow retained; [ ] End-to-end proof; responsive 360–1920px; WCAG 2.2 AA |
| QR sign-in | Existing security flow retained; [ ] End-to-end proof; responsive 360–1920px; WCAG 2.2 AA |
| Invitation registration | Existing security flow retained; [ ] End-to-end proof; responsive 360–1920px; WCAG 2.2 AA |
| Account activation | Existing security flow retained; [ ] End-to-end proof; responsive 360–1920px; WCAG 2.2 AA |
| Password reset | Existing security flow retained; [ ] End-to-end proof; responsive 360–1920px; WCAG 2.2 AA |
| Founder recovery | Existing security flow retained; [ ] End-to-end proof; responsive 360–1920px; WCAG 2.2 AA |
| Session expiry | Existing security flow retained; [ ] End-to-end proof; responsive 360–1920px; WCAG 2.2 AA |
| Security alerts | Existing security flow retained; [ ] End-to-end proof; responsive 360–1920px; WCAG 2.2 AA |
| Authenticator activation | Existing security flow retained; [ ] End-to-end proof; responsive 360–1920px; WCAG 2.2 AA |
| Authenticator device management | Existing security flow retained; [ ] End-to-end proof; responsive 360–1920px; WCAG 2.2 AA |

## Gates & production restrictions

- [ ] Frontend lint / TypeScript / complete Vitest / Next production build.
- [ ] Backend Python pytest, compile, OpenAPI, quality gate.
- [ ] Versioned SQL migration review and **isolated PostgreSQL rehearsal**; production migration not run.
- [ ] Multi-role Director + Finance + HR + Member + Product Admin: Office landing works; HR/Finance actions still denied without explicit grants.
- [ ] Tenant/session/IDOR, revoked membership, stale-grant, direct URL, maker-checker and scoped data tests.
- [ ] Browser QA: 360, 390, 430, 768, 900, 1024, 1280, 1440, 1920; light/dark; keyboard/screen-reader; screenshot evidence.
- [ ] Full 41 Connect overlays and K-Vault states, official logo unchanged.
- [ ] Detailed security review for source Document Studio Owner override and high-risk source records; no claim of standalone Vault record-grant readiness.
- [ ] GitHub CI green, all failures classified.
- [ ] Separate explicit authorization **before** merge, production migration, Vercel or Railway changes, and deploy.

### Engineering changes so far

- `3e54b7ba...` shared Office/Finance shell geometry, mobile dock, Finance auth alignment.
- `0fa60f3d...` membership-gated DM persistence and Next.js APIs, migration pending rehearsal.
- `ff530259...` interactive employee directory and private DM timeline; canonical support/approval/activity bridges.
- `10939645...` 12-route K-Vault source-scoped entry, registrations/documents/custody and guarded references; remaining grant workflow pending.

This checklist is an audit ledger, not a certification of completeness.
