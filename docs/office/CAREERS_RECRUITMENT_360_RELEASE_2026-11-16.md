# KRAVIA Careers-to-Employee — Controlled Release
Date: 16 November 2026
Repository: vamsimarripudi/kraviaprivatelimited

## Scope and route map
Public /careers shows only approved, active and unexpired vacancies.
Public /careers/[slug] shows the role, exact publication date, requirements, scope and application link.
Public /careers/[slug]/apply provides an accessible secure form, optional PDF resume and separate recruitment privacy and communication choices.
Public /careers/application/verify uses single-use links expiring in 30 minutes.
Public /careers/application provides a candidate-only dashboard for interviews, requests, delivered offers and controlled upload of requested documents.
Internal /office/recruitment includes approved publication management, application import, malware scanning, consent decisions, interview/offer systems and verified employee handoff.

## Data migrations
1. 20261116154500_careers_public_candidate_pipeline.sql - publications, applications, verification tokens, communications, applicant actions and rate limits, private storage and explicit Data API privileges.
2. 20261116154600_careers_hr_adoption.sql - atomic HR adoption of email-verified applicants with authentic actor and department permissions.
3. 20261116154700_careers_documents_and_handoff.sql - candidate document quarantine, independent scanning, signed offer acceptance, approved pre-onboarding and final employee identity linkage.

All public-applicant PII is server-only. No candidate, compensation, bank or private document grants exist for anonymous or ordinary authenticated browser roles.

## Actual operational sequence
1. HR drafts a headcount requisition; approvers decide. HR synchronizes only approved requisitions to OPEN.
2. Authorized HR publishes one or more approved openings. No budgets or internal notes appear publicly. Closing/expiring a job removes it from public discovery.
3. Applicant submits name, email, optional role-relevant information, private PDF resume and privacy choices.
4. Applicant confirms email through short-lived one-time link. Reverification is available by reference/email. Unverified applications cannot be imported into the canonical ATS.
5. Authorized HR adopts the applicant with a single idempotent, actor-attributed database function. Duplicates require explicit review.
6. HR performs malware scanning with digest and byte-size attestation and moves clean resumes or candidate-requested documents into private approved storage.
7. Separate authorized HR reviewers confirm applicant mail-consent evidence. The existing Brevo-backed candidate mail worker respects Owner-enabled event policies and verified consent.
8. HR schedules/reschedules interviews and documents feedback; the candidate can confirm attendance or request an alternative through the candidate-only portal.
9. HR drafts an offer, Finance/Owner independently approve it, and Document Studio generates, signs and delivers the official document.
10. Candidate acknowledges a genuinely delivered signed offer. This is not e-signature or automatic employee enrollment.
11. Authorized HR validates signed document evidence. One atomic transaction creates a PRE_ONBOARDING_ACCESS request and links it to the candidate and offer.
12. Existing governed Office invitation and onboarding tools perform authenticated invitation, registration, actual employment verification, bank/HR independent checks, employee ID and role assignment. No step impersonates an employee.
13. Final link to HIRED requires the approved onboarding request, candidate email matching authenticated employee, correct department, real joining date, independently verified private intake and bank, and issued immutable employee ID.
14. IAM role assignment, attendance and payroll remain independent, approved actions; their execution is never inferred from hiring or code deployment.

## Communication and controls
Direct verification, application receipt and access emails use authenticated Brevo server calls and retain delivery outcome records. A provider accepted event is not inbox-delivered evidence. UNKNOWN outcomes must be reconciled and are not retried blindly. Existing HIRE lifecycle emails for interviews, document requests, offers and closure require their pre-existing Owner-controlled policies; enable them only after sender authentication, consent, source readiness, worker ownership and real delivery verification. No speculative candidates, offers or notifications are created by migration or deploy.

## Production secrets
Existing OFFICE_SUPABASE_URL and OFFICE_SUPABASE_SECRET_KEY: server-only.
KRAVIA_CAREERS_BREVO_API_KEY or BREVO_API_KEY: authorized Brevo server key.
KRAVIA_CAREERS_FROM_EMAIL: optional sender under kraviaprivatelimited.com, verified in Brevo.
KRAVIA_CAREERS_RATE_SECRET: random 32+-character HMAC salt, with existing KRAVIA_PUBLIC_INTAKE_WEBHOOK_SECRET as fallback.
Existing Office authenticated security-scanner runtime and private candidate-documents bucket.

If configuration is absent or a trusted service is unavailable, the route must fail closed instead of inventing application acceptance, verified identity, approved offers, clean documents or delivered email.

## Acceptance checklist
- Public listing hidden when requisition not approved or open, paused, expired or closed.
- CSRF, abusive requests, unknown references and reused/expired tokens rejected without enumeration.
- Candidate email verification and scoped session; no candidate can read other candidate records, salaries or private reviewer notes.
- Resume and requested documents kept in private quarantine until signed malware scan attestation.
- HR and department-specific RLS/permission checks; no direct applicant transition to ONBOARDING/HIRED.
- Interview change, cancellation, candidate responses and feedback are traceable.
- Only delivered approved and signed offer shown to applicant; acknowledgement is not legal e-sign or appointment.
- Signed HR verification creates exactly one pre-onboarding approval and handoff.
- Employee matching requires actual identity, email/department, start date, verified bank/intake, immutable ID.
- Email errors are explicit. HIRE lifecycle event policy remains Owner-controlled.
- Final main commit, migrations, production Vercel SHA and real authenticated HR browser smoke verified independently.

This implementation does not create fabricated vacancies, candidate identities, salaries, signed documents, consent approvals, actual payments or employee accounts.
