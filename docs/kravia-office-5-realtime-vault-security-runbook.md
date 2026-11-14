# KRAVIA Office 5.0 — Connect real-time and sealed Vault operations

Status: feature branch only; NOT production approved. The complete Office, Finance, Connect, Vault and native Authenticator design acceptance is a separate mandatory release gate.

## Hard deployment boundary

No Vercel preview, Railway/Vercel production deployment, main merge, production database migration, employee message or company permission change without separate Owner approval. Use only feature/kravia-office-5-implementation-20261114 and draft PR #157.

## Private Connect real-time service

- The first-party AAL2 Office identity is authoritative. Never issue a Supabase service key or private identity token to browser JavaScript.
- Migration 202611140020_office_chat_private_realtime.sql provides a browser-inaccessible, RLS-protected change ledger. Message, member, reaction, pin and attachment updates create event invalidations with NO message text or storage references.
- Migration 202611140021_office_chat_private_typing.sql provides a transient typing Boolean with a ten-second expiry and current-membership trigger.
- GET /api/office-chat/conversations/[id]/events provides a bounded 24-second private Server-Sent Events channel with authorization rechecked for every batch, bounded backpressure and an access-revoked closure.
- Browser clients refetch source-authorized message content after receiving an event. The existing private 15-second polling is the network fallback. The event stream is NOT the source of truth.
- Outstanding enterprise acceptance: authenticated multi-user/department-transfer rehearsal, reconnect and stale-token testing, concurrent SSE load tests, multi-instance failover and a measured service target. No performance or SLA guarantee is inferred from CI.

## Sealed K-Vault secret locker

- Migration 202611140022_office_vault_sealed_locker.sql provides the private office-vault-secrets bucket, immutable encrypted versions, separate source permissions, audited access and independent review.
- Each version uses a fresh random AES-256-GCM content key. A separate 32-byte server-held key wraps the content key, binding both encrypted layers to the document and version IDs as authenticated associated data.
- Configure OFFICE_VAULT_ACTIVE_KEY_ID and OFFICE_VAULT_KEYRING_JSON ONLY through trusted server-runtime secret management. The JSON object maps key IDs to true 32-byte base64 keys. Never store a key in source control, NEXT_PUBLIC variables, employee email or the browser. Preserve old key IDs while their versions remain encrypted; require a separate approved rewrapping process for rotation.
- The FastAPI endpoint POST /api/v1/security/file-scan verifies a bounded attachment through the private ClamAV daemon and returns an integrity-checked digest. Configure CLAMAV_HOST, CLAMAV_PORT in authorized backend infrastructure and verify with the existing EICAR self-test. Scanner unavailability leaves the file QUARANTINED; infected files are BLOCKED.
- The Next route POST /api/office-vault/secrets encrypts before private storage and records the immutable version. CLEAN scan does not authorize release. A separate reviewer holding the current vault.secret.review permission must approve with documented rationale; the uploader cannot self-approve.
- Preview and download require an active AAL2 identity, verified company-managed device, current source permissions and an unexpired per-document Vault action grant. The endpoint decrypts, verifies ciphertext/authentication and the SHA-256 digest, and records the access event before returning content with no-store headers.
- The browser list excludes encryption keys, wrapped keys, storage paths, private internal owner identifiers, and unrelated documents.
- The UI route /office/k-vault/secrets offers encrypted upload, immutable versions, scanner outcomes/retry, independent review, protected PDF/image preview, download, and scoped access requests. Input formats are PDF, JPEG, PNG, WebP, DOCX and XLSX up to 10 MiB.
- Operational blockers: approved non-production keyring, bucket, ClamAV and authenticated two-person test identities, backup/restore rehearsal, key-rotation drill, comprehensive security review. Isolated SQL tests and a successful Next build are not proof that physical storage/scanner integration has been tested.

## Production-release prerequisites

1. Restore a sanitized current Office database into a detached approved staging instance. Apply versioned migrations in order: all earlier chat/Vault dependencies, then 014, 015, 016. Never apply them to production under this task.
2. Verify clean scan, malicious rejection, scanner outage, authenticated file round-trip, attempted owner/classification tampering, expired/revoked grants, source reclassification, and device replacement.
3. Validate Founder, Director, Finance, HR, ordinary employee, delegated department owner, former owner and offboarded user access. Verify separation of duties and effective-date checks.
4. Test each approved Office/Finance/Connect/Vault module and overlay with current permission-scoped test data, including 360-1920px screens, keyboard/focus, contrast, reduced motion, mobile safe areas and iOS/Android native Authenticator.
5. Publish the exact final SHA, tests, migration rehearsal, scanner proof, visual evidence and rollback runbook for separate Owner sign-off. Only after approval may a one-time direct production release be considered.

Rollback means disabling feature entry points first and reverting application code without deleting the private bucket, ciphertext, key references or audit evidence. Never publish the bucket, erase prior keys or forge scan/approval records to unblock release.
