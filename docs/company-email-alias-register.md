# KRAVIA Google Workspace aliases and website contact registry

**Status:** PROPOSED — nothing in this register certifies that an alias has been provisioned, can receive mail, or is approved for public publication.
**Primary mailbox:** `hello@kraviaprivatelimited.com`
**Domain:** `kraviaprivatelimited.com`
**Proposed aliases:** exactly 30 (the current Google Workspace per-user alias limit).

## Single registry

| # | Alias | Department | Purpose | Website / route | Publication class |
|---:|---|---|---|---|---|
| 1 | `contact@kraviaprivatelimited.com` | Corporate & business | General corporate enquiries | /contact | PUBLIC_AFTER_VERIFICATION |
| 2 | `partnerships@kraviaprivatelimited.com` | Corporate & business | Product or distribution partnerships | /contact (partnership route) | PUBLIC_AFTER_VERIFICATION |
| 3 | `enterprise@kraviaprivatelimited.com` | Corporate & business | Enterprise-level product discussions | Internal intake | INTERNAL_ONLY |
| 4 | `investors@kraviaprivatelimited.com` | Corporate & business | Investor and capital enquiries | Private corporate operations | INTERNAL_ONLY |
| 5 | `operations@kraviaprivatelimited.com` | Corporate & business | Company operations coordination | Internal | INTERNAL_ONLY |
| 6 | `products@kraviaprivatelimited.com` | Products & engineering | Product portfolio enquiries | /products and /contact | PUBLIC_AFTER_VERIFICATION |
| 7 | `technology@kraviaprivatelimited.com` | Products & engineering | Technology and architecture correspondence | Internal | INTERNAL_ONLY |
| 8 | `engineering@kraviaprivatelimited.com` | Products & engineering | Engineering coordination | Internal | INTERNAL_ONLY |
| 9 | `integrations@kraviaprivatelimited.com` | Products & engineering | Product integration discussions | Internal | INTERNAL_ONLY |
| 10 | `research@kraviaprivatelimited.com` | Products & engineering | Product research correspondence | Internal | INTERNAL_ONLY |
| 11 | `demos@kraviaprivatelimited.com` | Products & engineering | Product demonstration requests | /contact product route | PUBLIC_AFTER_VERIFICATION |
| 12 | `feedback@kraviaprivatelimited.com` | Products & engineering | Feedback on KRAVIA corporate product portfolio | /contact or /support | PUBLIC_AFTER_VERIFICATION |
| 13 | `support@kraviaprivatelimited.com` | Customer operations | KRAVIA company-level support | /support | PUBLIC_AFTER_VERIFICATION |
| 14 | `onboarding@kraviaprivatelimited.com` | Customer operations | Institutional onboarding coordination | Internal; do not replace product-domain contacts | INTERNAL_ONLY |
| 15 | `customer-success@kraviaprivatelimited.com` | Customer operations | Customer relationship and adoption | Internal; do not replace product-domain contacts | INTERNAL_ONLY |
| 16 | `security@kraviaprivatelimited.com` | Legal, security & trust | Security correspondence | /trust/security-reporting is the required restricted intake; do not list email publicly | RESTRICTED |
| 17 | `privacy@kraviaprivatelimited.com` | Legal, security & trust | Personal data and privacy requests | /trust private request workflow; do not publish before restricted access review | RESTRICTED |
| 18 | `grievance@kraviaprivatelimited.com` | Legal, security & trust | Grievance handling | /trust grievance request workflow; do not publish before restricted access review | RESTRICTED |
| 19 | `legal@kraviaprivatelimited.com` | Legal, security & trust | Legal correspondence | /legal, subject to contact activation | PUBLIC_AFTER_VERIFICATION |
| 20 | `compliance@kraviaprivatelimited.com` | Legal, security & trust | Internal compliance coordination | Internal | INTERNAL_ONLY |
| 21 | `accessibility@kraviaprivatelimited.com` | Legal, security & trust | Accessibility questions | /trust/accessibility | PUBLIC_AFTER_VERIFICATION |
| 22 | `trust@kraviaprivatelimited.com` | Legal, security & trust | Trust and assurance questions | Internal | INTERNAL_ONLY |
| 23 | `accounts@kraviaprivatelimited.com` | Finance & procurement | Accounts and bookkeeping | Internal, financial access review required | INTERNAL_ONLY |
| 24 | `billing@kraviaprivatelimited.com` | Finance & procurement | Customer subscription and billing enquiries | /legal/billing and /support, after activation | PUBLIC_AFTER_VERIFICATION |
| 25 | `invoices@kraviaprivatelimited.com` | Finance & procurement | Invoice routing | Internal, financial access review required | INTERNAL_ONLY |
| 26 | `procurement@kraviaprivatelimited.com` | Finance & procurement | Vendors and purchasing | Internal | INTERNAL_ONLY |
| 27 | `careers@kraviaprivatelimited.com` | People & communications | Approved vacancies and hiring enquiries | /careers | PUBLIC_AFTER_VERIFICATION |
| 28 | `hr@kraviaprivatelimited.com` | People & communications | People/HR correspondence | Internal, separate restricted handling recommended | INTERNAL_ONLY |
| 29 | `press@kraviaprivatelimited.com` | People & communications | Newsroom and media enquiries | /newsroom | PUBLIC_AFTER_VERIFICATION |
| 30 | `marketing@kraviaprivatelimited.com` | People & communications | Corporate marketing coordination | Internal | INTERNAL_ONLY |

## Routing rules

1. All listed aliases are intended to be created in Google Workspace on the existing `hello@kraviaprivatelimited.com` user, **not** as 30 paid accounts. Verify none already exists as a user, group, or alias before adding.
2. `PUBLIC_AFTER_VERIFICATION` means **not live** until the admin creates the alias, tests it from an unrelated mailbox, checks Gmail reply-from configuration, and approves public publication.
3. `RESTRICTED` means do not expose the alias in website markup or use it as a substitute for the existing private/restricted Trust reporting workflow. A shared hello inbox does not offer separate access control for privacy, grievances, HR, or security submissions.
4. `INTERNAL_ONLY` means do not add the address to public webpages, metadata, JSON-LD, sitemaps, SEO, or footers; use it for controlled internal correspondence after it exists.
5. Keep the existing `hello@kraviaprivatelimited.com` in the shared corporate identity/facts register and public footer as the working fallback until contacts are proven live.
6. The existing `/contact` enquiry form, `/support` case tracking, `/trust` privacy/grievance request forms, and `/trust/security-reporting` restricted security form remain the primary intake workflows. Alias addresses must not bypass consent, case-tracking, security triage, or retention controls.
7. VidyaLuma and other KRAVIA products have distinct public branding. Do not replace their product-domain contacts with these KRAVIA corporate addresses by default; use a reviewed, explicit cross-brand handoff if necessary.

## Recommended public website mapping (only after activation)

| KRAVIA route | Approved candidate aliases | Preserve |
|---|---|---|
| `/contact` | `contact@`, `partnerships@`, `products@`, `demos@` | Existing categorized enquiry form |
| `/products` | `products@` | Product positioning, brand-specific contact links |
| `/support` | `support@`, `feedback@` | Support case reference and tracking |
| `/newsroom` | `press@` | Controlled publishing/review process |
| `/careers` | `careers@` | Only approved open roles; no speculative vacancies |
| `/trust/accessibility` | `accessibility@` | Existing request workflow |
| `/legal` and relevant billing policy | `legal@`, `billing@` | Published legal text and approved request routes |
| `/trust` privacy/grievances and `/trust/security-reporting` | **No direct public alias from the shared inbox by default** | Private/restricted forms, triage and escalation |

## Google Workspace setup and release checklist

- [ ] In `admin.google.com` open Directory → Users → `hello@kraviaprivatelimited.com` → Add Alternate Emails.
- [ ] Check existing aliases and reserve remaining slots (30 aliases per user total).
- [ ] Add each approved alias under `kraviaprivatelimited.com`; Google Workspace automatically delivers alias mail to the user inbox.
- [ ] Send an independent external test to all 30 addresses; verify delivery, original recipient / routing and Gmail filters.
- [ ] Configure Gmail Settings → Accounts and Import → Send mail as for any address that should be used to reply.
- [ ] Apply Gmail filters/labels by receiving alias for operational triage. Labels are **not** access-control boundaries.
- [ ] Review restricted categories and assign dedicated authorized mailbox/group or private case workflow where confidentiality requires it.
- [ ] Only then update KRAVIA public UI and legal contact routes, keeping design and restricted forms unchanged; validate mailto links, frontend tests, legal references, and build.
- [ ] Do not deploy or merge unverified alias addresses to production.

Reference: Google Workspace Help — https://knowledge.workspace.google.com/admin/users/add-or-delete-an-alternate-email-address-email-alias
