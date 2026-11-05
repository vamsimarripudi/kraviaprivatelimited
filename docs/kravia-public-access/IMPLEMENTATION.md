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
