# KRAVIA Office — private verified employee onboarding

## Design and authority

The same first-party Office identity, people directory and employment registry are used across HR, Finance and self-service. A new intake does **not** create a login, employment date, salary, payment or legal appointment. Existing internal IDs `office_employment_registry.employment_id` and `employment_code` remain authoritative.

Self-service: `/office/my-role` → Personal details, education, bank and signed onboarding.
HR review: `/office/people` → HR employee intake & verification desk.
APIs: `/api/office-employee-intake`, `/upload`, `/photo`.

**IMPORTANT:** Never put full account details, PAN, Aadhaar, identity scans, private access tokens or raw signatures into emails, support logs, incident tickets or public URLs.

## Required production configuration

- Supabase migration `202611120003_verified_employee_intake_and_ids.sql` applied and verified; employee tables, events, unique reference IDs and private storage bucket present.
- Next.js environment `OFFICE_EMPLOYEE_DATA_ENCRYPTION_KEY`: a dedicated **32-byte cryptographically random secret encoded as standard base64**, generated in an authorised secret manager; not committed to GitHub. Keep previous versions available for decrypting historical records if future rotation is implemented. No plaintext/key fallback.
- KRAVIA's existing private scanner at `/api/v1/security/file-scan` reachable through `getOfficeRuntimeOrigin()`; its JWT and SHA-256/length confirmation must succeed. Uploads fail closed when unavailable.
- Only private `office-employee-intake` storage bucket, 10 MiB limit and approved JPEG/PNG/WebP/PDF content. No public object policy.
- Authenticated employee and governed HR/Finance user sessions require AAL2; self cannot approve self. All HR directory and file reads are permission-scope checked.
- The ID issuance RPC is service-role only and requires HR/Owner approval, **real effective employment start_date**, verified Finance bank evidence, documented digital signature, and a separate VERIFIED `APPOINTMENT_SIGNED` role-package onboarding task.
- Display IDs are random `KRV-EYY-<16HEX>`, unique and immutable. Original `KR-E-000001` style codes continue to refer to existing HR/payroll records.
- `office_employee_mail_outbox` uses PENDING/UNKNOWN/SENT states, and cannot treat queueing an email as delivery. **This schema does not send any email**; add a delivery processor with provider acknowledgements before claiming notifications are working. Do not retry unknown provider outcomes blindly.

## Privacy and data states

`DRAFT` → employee may save fields, upload scanned photo and certificate.
`SUBMITTED` → read-only pending HR/Finance evaluation.
`RETURNED` → employee may revise privately.
`VERIFIED` → HR independently verified; no employee mutation; legal signed documents remain in canonical document workflow.

The employee bank account is stored as AES-256-GCM server ciphertext. The UI/API return only the last four digits and verified-state metadata, never a raw number or ciphertext. Photos are authenticated, no-store responses from a private object reference. Uploaded certificate metadata includes a provider-verified hash and review status, not a fabricated verification.

## Release checklist

1. CI: lint, TS typecheck, build, security/schema tests and isolated PostgreSQL migration smoke tests.
2. Review the schema/RLS/function definition and apply migration to the correct verified Supabase project.
3. Validate revoked users and unrelated employees cannot access another person's intake or photo; ensure a former department owner cannot approve after handover.
4. Verify real scanner rejection, timeout, MIME mismatch and private object cleanup on failure.
5. Validate real HR workflow with independent approvers, real effective employment dates and supporting signed documents. Do not use synthetic production payroll or identity records.
6. Confirm key and backend environment health before collecting any bank details.
7. Confirm Vercel deployment actually finished and the production custom-domain release fingerprint matches the new commit.
8. Only after a real transactional provider delivery and an acknowledged provider receipt may email status become SENT.
