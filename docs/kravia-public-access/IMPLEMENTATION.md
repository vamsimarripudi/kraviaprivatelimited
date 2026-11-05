# KRAVIA Public Accounts, Resource Library & Newsletter — Implementation Specification
Date: 2026-11-05 · Owner: KRAVIA PRIVATE LIMITED · Version: 1.0

## Audit and boundary decisions
- KRAVIA Office login/registration is private and invite-only. Visitors must never use Office roles, cookies, routes or database for registration.
- Existing `/api/corporate/documents/[id]/download` is retired (410); Office document workflows are private. Do **not** re-enable the legacy route.
- The public site currently has no approved public files in `Frontend/public/` beyond brand assets; the Newsroom media kit is editorial text, not a publication repository.
- Website consent data already uses a **pseudonymous and isolated** Neon project. Its migration expressly forbids storing identity data. Keep it untouched.
- The KRAVIA website has 26 public legal policies. Legal/Trust materials, statutory disclosures, accessibility and privacy forms must remain publicly accessible without login.
- KRAVIA existing backend sends transactional mail via a verified Brevo `hello@kraviaprivatelimited.com` sender, and its six enterprise layouts are deterministic.
- Never convert an Office identity into a public visitor, import Office staff, or grant public accounts any Office scope.

## Public-facing product requirements
1. Landing page links to a public Resource Library, which shows only approved, explicitly published resources.
2. Visitors can read resource descriptions without an account.
3. Pressing **Download** starts a separate public email verification flow if there is no verified public session. Existing users sign in with a short-lived, single-use email code; first-time users register using the same verified flow.
4. On successful verification, create an httpOnly session and return to the original internal download path. Reject external or protocol-relative redirect targets.
5. Files are served only from a trusted server route after database session verification; never publish restricted bytes under `public/` or link to an unprotected file URL.
6. A server-maintained allowlist/Office publication workflow controls file status, MIME type, revision and approved size.
7. The Office owner can upload and explicitly publish/retire resource files, but this role never grants the public account Office authority.
8. Registration collects only email and optional display name. Consent to newsletters is an **off-by-default** checkbox, separate from accepting necessary service notices.
9. A newsletter opt-in request triggers a single-use confirmation link; only confirmed, active consent enables newsletters. Provide public unsubscribe and account preference controls.
10. Download receipts or access notifications are transactional, not marketing; never auto-subscribe after a download or inquiry.
11. No campaign sends without approved copy, explicit recipient eligibility, idempotency, unsubscribe and send quotas. Service-email recipients and campaign subscribers are distinct.
12. Public users can inspect email, download history and newsletter choice, revoke sessions/sign out, and request account deletion through a safe, authenticated process.

## End-to-end journeys
- **New visitor:** landing → resources → gated download → register/email code → verified session → download → optional newsletter confirmation (only when explicitly selected).
- **Returning visitor:** resource → sign in → email code → download, with prior newsletter preferences unchanged.
- **Confirmed subscriber:** opt-in → confirmation link → ACTIVE → eligible for approved campaigns → unsubscribe at any time.
- **Unsubscribe:** link opens confirmation page (GET does not mutate) → POST confirms withdrawal → suppress future marketing. Revocation must not prevent service notices.
- **Owner publishing:** Office OWNER + MFA → upload non-confidential resource → validate MIME/size/hash → review draft → explicit publish → public catalogue.
- **Failure:** absent DB, absent sender, invalid token, send error, unpublished resource, exhausted quota → fail closed; no leaked resource bytes or misleading delivery success.

## Database model
Dedicated Neon project: `kravia-public-access` (not Office and not the anonymous privacy-preference database).
- `public_access.accounts`: verified personal identity (email unique), display name, active/suspended/deleted status.
- `public_access.email_challenges`: per-challenge HMAC code digest, expiry, attempts, requested purpose, consumed timestamp.
- `public_access.request_windows`: hashed anti-abuse quota; never store raw IP or arbitrary browser identity.
- `public_access.sessions`: hashed bearer cookie, owner, expiry, revocation.
- `public_access.newsletters`: PENDING/ACTIVE/UNSUBSCRIBED, consent version/source, confirmation digest, withdrawal token digest.
- `public_access.newsletter_events`: immutable audit of consent and withdrawal decisions.
- `public_access.resources`: versioned controlled file content, MIME allowlist, checksum, size, draft/published/retired state, owner reviewer.
- `public_access.download_events`: account, approved resource, timestamp; no raw IP collection.
- `public_access.campaigns`, `campaign_deliveries`: approval gate, audience snapshot, idempotent sent/suppressed records.
SQL source: `Database/public-access-neon/migrations/202611050001_public_access.sql`.

## Email matrix
Existing six types: Office OTP, Office device approval, public request received, public request updated, internal intake notice, corporate welcome.
New lifecycle types to implement:
- public account verification
- public account welcome
- resource access/receipt
- newsletter confirmation
- newsletter welcome
- newsletter issue/digest (approved-only; clear source, useful content, footer unsubscribe)
- newsletter unsubscribed
- account security/change notice
- support or feedback acknowledgment
- newsletter preference change
All share verified official KRAVIA header and icon assets (36px, self-hosted) and privacy/contact links, but **differ by purpose and hierarchy**. Plain-text fallbacks required. OTP must not include marketing content.

## Threat model and quality gates
- No public signup in Office; every sensitive API must verify its own server-side identity.
- Enforce CSRF/origin check on mutations and on resource administration.
- One-time code must expire after 10 minutes, maximum 5 attempts, IP/email request quotas, generic errors to prevent enumeration, hashed-at-rest secrets only.
- Cookie Secure in production, httpOnly, sameSite=lax, no query-token auto-login and no open redirects.
- File validation: PDFs, plain text, CSV, ZIP only; strict MIME and size max 2 MiB; no HTML, JS, SVG or executable payloads; no rendering untrusted content inside website DOM.
- Resource API must return `Cache-Control: private, no-store`, `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`.
- Consent recorded with timestamp, source and notice version; link-scanner-safe opt-in/opt-out, unsubscribe visible in every marketing message, GPC respected where applicable.
- Marketing send process checks `ACTIVE` consent immediately before sending; stop on withdrawal, require owner approval and explicit sending limits.
- Monitor OTP abuse, endpoint 4xx/5xx, failed emails, download auditable counts, bounces/unsubscribes; no code, login token or raw user content in logs.
- Automated tests: migration integrity, build/typecheck, code replay, rate limiting, token revocation, unsub suppression, MIME allowlist and access-denied download.
- No production launch until configuration is verified, external mail round-trip succeeds and both mobile and desktop email rendering pass.

## Configuration checklist
- Provision dedicated public-access Neon database and apply the committed migration.
- Configure Vercel server-only pooled URL `KRAVIA_PUBLIC_ACCESS_DATABASE_URL` (never `NEXT_PUBLIC_*`).
- Configure a public-portal HMAC secret on both Vercel and Railway, or a domain-separated secret derived from their existing signed internal route contract. Do not place Brevo credentials in the browser.
- Verify production `hello@` sender and newsletter authorization, SPF/DKIM/DMARC, and mail event audit.
- Approve a real resource before making the public Download action visible. **Do not** add fictional downloads or unapproved corporate records.
- Keep production campaigns disabled until written approval of copy and target audience.

## India privacy
DPDP Rules, 2025 were notified with phased commencement. Design for plain-language notice, specified purpose, explicit consent and easy withdrawal. Legal review should confirm retention/age handling, grievance procedures and any cross-border policy before enabling international campaigns.


## Implementation increment — November 5, 2026

### Resource publishing and transactional email
- `/office/resource-publishing` is restricted to authenticated Office OWNER with AAL2. Resources start in DRAFT; publishing and retiring require explicit owner actions.
- `/api/office-public-resources/[slug]/preview` returns the **stored bytes**, not a rendered approximation, as a non-cacheable private download; it validates size and SHA-256 and requires Office OWNER/AAL2.
- Public `/api/public-resources/[slug]/download` rechecks authenticated visitor identity, PUBLISHED status, byte count and SHA-256 before recording a download and delivering the file.
- On first successful access to a resource, the trusted backend attempts one idempotent transactional DOWNLOAD_RECEIPT email. Repeated downloads do not create newsletter consent or additional receipts.
- All public access mail uses verified KRAVIA branding and the self-hosted 36px social icons, with distinct layouts and plain-text alternatives. OTP, acknowledgements, newsletter confirmation and notices are separate purpose-bound templates.

### Newsletter operations
- `/office/newsletters` is the owner-only, AAL2-protected campaign console. Campaign DRAFT creation, explicit APPROVE, CANCEL, and SEND_BATCH are separate actions; the website never auto-creates or auto-sends a marketing campaign from registration or downloads.
- Campaign recipients are snapshotted from ACTIVE subscriptions belonging to ACTIVE accounts when sending begins. The sender independently re-checks opt-in state immediately before every call to Brevo and suppresses anyone who has unsubscribed.
- Batches contain up to ten recipients. A rolling 24-hour cap targets **no more than 80** confirmed campaign deliveries; this is an operational cap, not a substitute for sender-wide provider throttling or a transactional reservation limit.
- A delivery transitions from PENDING to UNKNOWN before the external call, making crashes and timeouts **non-retryable without manual reconciliation**. Successful submissions become SUBMITTED; withdrawn subscribers become SUPPRESSED. Unknown does not mean delivered or definitely failed.
- An HMAC-signed, stateless unsubscribe token tied to the account is valid across issues, so issuing another campaign does not invalidate unsubscribe links in older newsletters. GET shows a decision page; only an explicit same-origin POST withdraws consent.
- Enabling deliveries additionally requires the server-side `KRAVIA_NEWSLETTER_SENDING_ENABLED=true` setting. This setting must remain off before transport round-trip tests, legal review, approved copy, verified domain identity and owner sign-off.
- Signed mail handoff now binds idempotency ledger entries to an HMAC digest of the **exact payload**, not just recipient and email kind, preventing an event identifier from silently matching different content.

### Environment and production acceptance
- Neon project is `kravia-public-access`, ID `round-butterfly-88885202`, database `kravia_public_access`. Store only its **pooled** connection URL as the server-only `KRAVIA_PUBLIC_ACCESS_DATABASE_URL` on the Vercel KRAVIA project. Do not reuse the separate `KRAVIA_WEBSITE_CONSENT_DATABASE_URL`.
- The signed Office mail relay needs the existing `KRAVIA_PUBLIC_INTAKE_WEBHOOK_SECRET` to match on Vercel and Railway, the existing private `OFFICE_API_ORIGIN`, and valid Brevo sender credentials on Railway. Never paste these into a chat or commit them.
- Additive backend migration `8c46b2a09d17` adds the mail-event content fingerprint. The Office backend remains separate from the Neon public account database.
- Public resources remain empty until an owner has reviewed and explicitly published real non-confidential materials. Public company policies, legal downloads, statutory records and privacy requests must not be gated.
- Before enabling `KRAVIA_NEWSLETTER_SENDING_ENABLED`, complete actual provider-to-Gmail email verification, a synthetic account creation and download, consent confirmation and withdrawal, staff-only publishing checks, dark-mode/mobile mail inspection and live suppression verification.


## Release verification update — 5 November 2026

- The integrated public account, download, newsletter preference and Office publishing code has passed repository CI. This does **not** establish production email round-trip success.
- The separate Neon public-access database contains one `DRAFT` text resource (`kravia-company-overview`). Its body explicitly says `REVIEW DRAFT`, so **do not publish it without human review and an approved final revision**. There are no published resources, visitor accounts, active newsletter subscriptions or campaigns at this review.
- The KRAVIA Vercel team `kravia1` remains inaccessible to the current integration (scope access 403); environment variables cannot be inspected or set through that connection. Do not infer that `KRAVIA_PUBLIC_ACCESS_DATABASE_URL` is installed merely because the GitHub deploy succeeds.
- The newsletter campaign sender intentionally defaults to disabled. Brevo's transactional API documentation describes transactional mail as non-promotional and states its custom-header support excludes standard mail headers. Prior to sending promotional newsletters, confirm that the provider account supports the chosen marketing transport and verify actual List-Unsubscribe / one-click behavior in delivered raw headers. Prefer a Brevo marketing-campaign route for promotional mail if required by provider policy. References: https://developers.brevo.com/reference/send-transac-email and https://help.brevo.com/hc/en-us/articles/19100260472850-FAQs-About-list-unsubscribe-and-list-help-headers-in-emails
- Batch sends reserve each recipient with `FOR UPDATE SKIP LOCKED`; both delivered submissions and unresolved reservations count toward the 80-attempt rolling-day limit. A campaign is marked `SENT` only with zero pending recipients and zero unresolved delivery outcomes. `UNKNOWN` outcomes must be reconciled against provider logs, never automatically retried.
- Preview images and approved email layout checks pass, but live Gmail/mobile appearance of all new lifecycle templates must still be confirmed using the verified KRAVIA sender before launch.

### Database-level regression — 5 November 2026
- During a rollback-only synthetic verification test, the original `public_access.complete_challenge` function failed with PostgreSQL's `column reference "email" is ambiguous`, caused by `ON CONFLICT(email)` inside a PL/pgSQL function returning a column named `email`.
- The dedicated Neon `kravia-public-access` function was corrected to use named constraints `accounts_email_key` and `newsletters_pkey`; the fix is versioned as `202611050002_challenge_conflict_fix.sql`.
- A repeat test passed: incorrect code rejected and counted, correct code accepted, one-time replay denied, opt-in stays PENDING, opt-out default creates no newsletter record, and synthetic records are rolled back. Verify the live website-to-Brevo email path separately.
- A new PostgreSQL 17 CI job applies both migrations to a temporary database and executes `tests/registration-smoke.sql`; file-only validation is not a substitute for this database execution test.
