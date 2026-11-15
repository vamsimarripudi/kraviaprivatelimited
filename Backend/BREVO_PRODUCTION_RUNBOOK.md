# KRAVIA Office — Brevo transactional email launch runbook

Status: code-side operational readiness; NOT confirmation of external account activation or inbox delivery.
Date: 15 November 2026. Approved company sender: hello@kraviaprivatelimited.com.

## Security and operating scope

- No manual, bulk, or retrospective employee email as part of provider setup.
- First-party Office auth sends invitation, OTP, password recovery, and device verification only after the legitimate verified action. Existing FIRST_PARTY_AUTH events must NEVER be duplicated by a generic lifecycle worker.
- Other emails require current source evidence, a real recipient, explicit Owner-approved per-event policy, effective date and independently approved worker switches. Candidate and former-employee notices also need independently verified consent.
- Brevo 201 + messageId means the provider accepted an email, not guaranteed inbox delivery. Provider-unknown outcomes must NEVER be blindly retried.
- Credentials, OTPs, recipient addresses and message contents must not appear in repository source, stdout, status endpoints or screenshot evidence.

## A. Authenticate Brevo sender and domain

1. Log in to https://app.brevo.com/ and complete device verification as the account owner.
2. Brevo > SMTP & API: generate or rotate a production API key. Place this in the trusted Railway API's BREVO_API_KEY variable. Never copy it to Vercel's NEXT_PUBLIC variables or client applications.
3. Brevo > Settings > Senders, Domains, IPs > Domains: check kraviaprivatelimited.com is verified and authenticated.
4. Check hello@kraviaprivatelimited.com is an active sender, with BREVO_SENDER_EMAIL set exactly to that address.
5. Follow Brevo's exact domain records for verification TXT, DKIM and DMARC. Do not overwrite Google Workspace MX records, do not add duplicate DMARC records, and preserve Workspace mail delivery.
6. Inspect account status, available transactional email credits and any rate or security restrictions.

Documentation:
- https://developers.brevo.com/docs/api-key-authentication
- https://developers.brevo.com/docs/getting-started-with-senders-and-domains
- https://help.brevo.com/hc/en-us/articles/12163873383186-Authenticate-your-domain-with-Brevo-Brevo-code-DKIM-DMARC
- https://developers.brevo.com/docs/send-a-transactional-email

## B. Run the no-send Brevo preflight

On the trusted Railway backend with provider environment variables installed:

    python -m backend.brevo_readiness --probe

The preflight issues only HTTPS GET:
- GET https://api.brevo.com/v3/account
- GET https://api.brevo.com/v3/senders
- GET https://api.brevo.com/v3/senders/domains/kraviaprivatelimited.com

It prints only safe booleans and sanitized failure codes. Configuration verification requires valid account response, active sender and domain verified/authenticated. The mailbox_delivery_verified field deliberately remains false because no email is sent by the preflight.

An authenticated Office OWNER can run this from KRAVIA Connect: Verify sender & domain. The private frontend gateway calls GET /api/v1/integrations/brevo/readiness?probe=true. Default GET performs no provider network requests.

## C. Set up private Railway mail-only worker

The existing general worker can be delayed by ClamAV startup self-tests. For independent email operations, create a private Railway service from the same GitHub repo:
- Root directory: Backend
- Dockerfile: Dockerfile.mail-worker
- No public domain; no HTTP health check
- Use the same trusted PostgreSQL DATABASE_URL and approved BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME.

Initial per-service variables:

    KRAVIA_MAIL_WORKER_ENABLED=false
    KRAVIA_EMPLOYEE_MAIL_DISPATCH_ENABLED=false
    KRAVIA_LIFECYCLE_MAIL_DISPATCH_ENABLED=false
    KRAVIA_CANDIDATE_MAIL_DISPATCH_ENABLED=false
    KRAVIA_EXTERNAL_LIFECYCLE_MAIL_DISPATCH_ENABLED=false
    KRAVIA_INVITATION_NOTICES_ENABLED=false
    KRAVIA_MAIL_WORKER_INTERVAL_SECONDS=60
    KRAVIA_MAIL_WORKER_BATCH_SIZE=10

The global worker flag alone never approves email. Enabling an individual worker also requires an independent allowed and effective event policy and current business/recipient evidence before SQL can claim any row.

To check that the default disabled state is safe, run:

    python -m backend.mail_worker --once

Expected status: DISABLED. In the active state, the worker logs only aggregate counts and sanitized error types. SQL claims occur before provider submission and use once-only state. Unknown provider outcomes are not replayed.

## D. Govern notification policies

- 81 lifecycle policies exist; all were disabled in production at the audit.
- The separate EMPLOYEE_ID_ISSUED policy was also disabled, without Owner approval.
- FIRST_PARTY_AUTH events belong to the existing identity process and must not be enabled as duplicate lifecycle sends.
- The Owner reviews and authorizes each future-only Office event through the governed Settings UI, with a documented reason and effective date.
- Candidate and former-employee mail require separate verified consent; never send former employees' notifications to revoked company mailboxes.
- Do NOT enable all 81 events at once, backfill historical notifications, or send synthetic employee invites.

## E. Verify an actual intended email

1. Verify the Brevo account, sender and domain using the no-send preflight.
2. Perform only one real, user-authorized identity or onboarding operation, such as the recipient requesting password recovery or an explicitly approved new invitation.
3. Match Brevo's transactional log and provider messageId with the actual Office delivery record.
4. Confirm inbox delivery with the intended recipient. A 201 acceptance by itself is not delivery proof.
5. Review bounces, blocks, deferred delivery and spam decisions. Add Brevo transactional webhooks later only behind a separately approved secure ingestion boundary; do not create an unauthenticated public webhook.
6. Audit the workflow source, delivery outcome, recipient consent and approvals, and do not resend ambiguous UNKNOWN submissions.

## Completion checklist

- [ ] Brevo account/new-device login verified by company operator
- [ ] API key verified via no-send request from Railway environment
- [ ] KRAVIA sender active and domain authenticated in Brevo
- [ ] Dedicated worker service configured, using approved secret manager and private deployment
- [ ] Company Owner has approved the exact email events, not a blanket bulk activation
- [ ] A future-only, legitimate request reached Brevo and returned messageId
- [ ] Intended recipient inbox delivery independently confirmed
- [ ] Unknown and rejected paths reviewed; no inadvertent sends or duplicates
- [ ] Owner approves expanded rollout after evidence review

The code implementation may be fully CI-tested while these external dependencies remain pending. Do not claim production completion without the provider and mailbox evidence.
