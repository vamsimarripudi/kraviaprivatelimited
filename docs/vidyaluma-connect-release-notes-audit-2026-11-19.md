# KRAVIA product release notes — VidyaLuma Connect source audit

Review date: 19 November 2026 (IST)
Source scope: first-party VidyaLuma repository and product documentation, reviewed against the main branch on 18–19 November 2026.
Publication destination: \`/products/release-notes#vidyaluma-connect-development\`
Classification: **Development**. The publication date is the date of this editorial note, not the date of a software launch.

## What Connect is

VidyaLuma Connect is a governed school communication layer inside VidyaLuma. It connects authenticated school users and membership-aware conversations with school announcements, broadcasts and controlled attachments. It is not a standalone social network, a replacement for the official school authority or an unrestricted parent-to-staff messenger.

## Evidence reviewed and supportable claims

| Domain | Evidence reviewed | Public wording |
| --- | --- | --- |
| Core | First-party Connect implementation guide, service, route contracts and focused test files | Ordered school conversations, scoped memberships and duplicate-safe messaging implemented in source |
| Web | School Connect page, API client and event transport | Web workspace source exists for conversation lists, search, composer, offline/error and reconnect states |
| Mobile | Role-gated React Native Connect panel | Mobile panel exists in code; deployment and physical-device testing are separate |
| Announcements | School announcement adapter and Connect broadcast contract | School updates and acknowledgements are designed for governed workflows |
| Attachments | Attachment intent, finalisation, private-storage validation | Private attachment controls exist; production storage activation is not proven by code |
| Security | Accepted secure-envelope decision and security boundary readiness document | Ciphertext-only envelope foundation exists behind explicit policy and client-activation gates |
| Readiness | Integration report and original source-audit ledger | Focused local tests exist, but deployed browser/device, storage, retention and rollback gates remain open |

The source materials distinguish committed implementation from school-facing availability. The release notes page therefore does not use **Launched**, **Generally available**, **End-to-end encrypted**, **Trusted by schools**, or other claims requiring new evidence.

## Open release-readiness gates

1. Authenticated end-to-end browser tests with realistic school roles; cross-school and revoked-member negative cases.
2. Configured private object storage upload, content verification, download revocation and retention tests.
3. Android/iOS device tests, offline/reconnect flows, multi-device continuity and access revocation.
4. Explicit approval of message edit windows, retention, export, moderation/safeguarding, parent scope and recovery policy.
5. Secure-envelope client key agreement, device recovery and lawful-access/safeguarding decisions before advertising E2EE.
6. Production configuration, migration and recovery drills, performance/load evidence, operational monitoring and rollback verification.
7. Product and entitlement review: published pricing, onboarding and which schools actually receive Connect.
8. Final editorial approval with public scope and support documentation.

## KRAVIA release-notes publication model

- Keep the structured, user-readable release-note registry in \`Frontend/lib/products/release-notes.ts\`. The page, filters and RSS read from the same registry.
- Each entry carries product, date, category, description, readiness wording and source-review metadata.
- **Development** describes reviewed implementation or design work. **Beta** requires verified beta deployment and an explicit eligibility statement. **General availability** requires the production release, monitoring and customer-facing availability to be verified.
- For future updates, add new dated entries rather than silently rewriting history. Correct genuinely erroneous information with a dated note or clear correction.
- Never auto-publish Git commits, issue titles, private URLs, credentials, student records, internal architecture details or unapproved features.
- Validate TypeScript, UI responsiveness, accessibility, SEO metadata, link destinations, search/filter behaviour and RSS output before merging.
- For external customers, the official product/pricing/trust pages remain the source for entitlements and currently enabled capabilities.

## Design adaptation

The referenced OpenAI release-notes pattern is used as structural inspiration: a chronological feed, product selector, search, update-type and sort controls, a stable permalink and optional RSS subscription. The page retains KRAVIA's own typography, colours, spacing and content; it does not copy OpenAI's brand assets or text.

This evidence record is a point-in-time audit, not live production certification.
