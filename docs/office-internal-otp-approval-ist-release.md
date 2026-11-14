# KRAVIA Office — first-party document OTP approval and IST clock

## Product semantics

This feature is a **first-party OTP-verified document approval**, not an Indian CCA-licensed certificate-based digital signature and not a cryptographic alteration of the original PDF. Existing provider-issued eSign and signed-PDF evidence remain independent flows.

Only a signed-in, AAL2 Office user expressly named as the **EMPLOYEE document subject** may approve the selected, already independently approved and generated PDF; for non-employee documents only the actual owner may use the flow. No owner/HR proxy signing for someone else's employment agreement.

Workflow: Document Studio / My roles & onboarding → real assigned PDF → eSign · Approve with OTP → masked corporate email and immutable issued employee reference → explicit Send code → Brevo confirms provider acceptance → six-digit code entered → explicit browser geolocation permission → fresh coordinates with reported accuracy → atomic database commit → green **APPROVED · EMAIL OTP** receipt. The exact PDF SHA-256, real account, employee ID, real identity name and server timestamp are bound to each approval. No OTP, key or fake GPS appears in the client payload or receipt. Browser-reported location is *not* independently GPS-attested.

## Data and security guarantees

- Session must be active AAL2 with matching first-party corporate email. No document approval by an anonymous or unassigned actor.
- A single-use 7-minute OTP is generated with Node.js secure randomness and stored only as HMAC-SHA256 using a dedicated server secret; no plaintext code is persisted.
- New challenge requests have an enforced 60-second cooldown and 5/hour cap; verification has 5 total attempts. Denials and invalid codes never generate a success receipt.
- Delivery is Brevo transactional only, with accepted/rejected/unknown outcomes separated. **UNKNOWN** is never automatically resent.
- A fresh, browser-permitted coordinate reading (with documented accuracy and captured_at) is required; location denial, stale reading, missing permanent employee reference, invalid OTP or changed document SHA leaves the document **unapproved**. No location is inferred from IP.
- Approval receipt is private, separately RLS-protected, bound to a document render/hash and signer, and records server-side IST-displayable instant. The original PDF is not marked cryptographically SIGNED.
- Office/Finance routes allow `geolocation=(self)`, while the public site retains `geolocation=()`. Consent remains under the browser/device control.
- No real employee records, HR/legal templates, document instances, messages, coordinates or completed approvals are created during code release or CI.

## Environment readiness — before the **one** approved production release

The Next.js Frontend runtime needs `OFFICE_DOCUMENT_OTP_HMAC_SECRET` set securely to at least 32 high-entropy characters; this must not enter source control or logs. Existing `BREVO_API_KEY` must be present in the **Frontend server runtime** (not `NEXT_PUBLIC_*`); `BREVO_SENDER_EMAIL`, if provided, must equal `hello@kraviaprivatelimited.com`. Existing authenticated Office cookies, service-role database connectivity, and valid company email must work. Keep existing lifecycle mail dispatch policies and external workers disabled.

Apply and audit the forward-only `Database/supabase/migrations/202611140001_office_document_email_otp_approval.sql` to the correct KRAVIA Office Supabase database **before** releasing the frontend, after verifying it is not already recorded and existing mail remains disabled. The isolated PostgreSQL17 CI suite validates all auth/privacy/OTP/location gates with synthetic rollback fixtures.

No valid HR appointment template, document or employee ID may be fabricated for a demonstration. Publish genuine approved HR template content through its existing independent approval flow and assign a real document, after appropriate HR/legal review.

## Acceptance and release gates

1. GitHub CI at the exact head SHA: PostgreSQL integration, frontend lint/typecheck/test/build, backend quality, local browser E2E, secret/search gates. No preview build or production merge while coding is incomplete.
2. Ensure OTP secret and Brevo available only as server-side configuration. Confirm the existing company sender account is authorized.
3. Validate that email OTP is sent only to the actual signed-in recipient with provider acceptance, wrong code/expired code/other employee fails, and geolocation denied produces no green stamp.
4. Confirm accurate, consented device-reported coordinates and accuracy, immutable issued employee ID, server-stamped approval time formatted as IST, and SHA-bound approval are displayed. Compare the reported coordinates to the actual device's location manually; never assert independently attested GPS.
5. Check topbar on 320/390/768/desktop widths, light/dark mode: no layout height changes (desktop 58px, mobile 56px), live time • date • IST, and no horizontal overflow.
6. Authorize and perform **one final Vercel production release** after verified migrations and acceptance. Branch `office-otp-ist-final-20261114` is non-production and `Frontend/vercel.json` disables preview builds for simple non-main branches. Do not deploy without Vercel team access and positive readiness.

**Current task scope:** code and isolated tests only. Production database writes, real emails and production Vercel deployment are not implicitly authorized by CI.
