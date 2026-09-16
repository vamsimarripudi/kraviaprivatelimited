# KRAVIA Office — Access Governance

## Authority model

KRAVIA Office uses an explicit delegated hierarchy rather than open registration or ad-hoc metadata roles.

1. **OWNER** — protected bootstrap authority. The normal application cannot create a second OWNER, remove the OWNER role, suspend the OWNER identity or transfer ownership authority.
2. **ADMIN** — appointed only by OWNER. ADMIN is an identity/access-administration role; it does not automatically grant Finance, GST, Legal, HR, document-vault, product or company-record access.
3. **Delegated roles** — ADMIN may onboard and manage `FINANCE`, `CA`, `CS`, `LEGAL`, `HR`, `OPERATIONS`, `AUDITOR` and `PRODUCT_ADMIN` within policy. OWNER may also perform those actions.
4. **DIRECTOR** — owner-managed privileged role. ADMIN cannot appoint, remove, suspend or modify an OWNER, DIRECTOR or another ADMIN.

Every admitted user must have an `ACTIVE` identity record, at least one active/non-expired role and an AAL2 TOTP session before entering a protected workspace.

## Onboarding

`/office/access` is the controlled access console.

- OWNER can invite an ADMIN or other non-OWNER role.
- ADMIN can invite only delegated roles.
- Public self-signup remains disabled.
- Invitation acceptance is server-side through `/office/invite/confirm` using the Supabase invite token hash.
- An accepted invite opens `/office/activate`, where the user must set a strong password and enroll/verify TOTP MFA.
- Account activation does not expand the role set supplied by the authorised inviter.
- The first access review is scheduled for 90 days after onboarding.

Production Supabase Auth must use a custom invitation email template that points to:

```text
{{ .SiteURL }}/office/invite/confirm?token_hash={{ .TokenHash }}&type=invite
```

`https://kraviaprivatelimited.com/office/invite/confirm` and the canonical site URL must be allowed by the hosted Auth URL configuration. Configure production SMTP before relying on invitation/recovery email delivery.

## Role and department administration

Role grants record the granting actor, reason, optional expiry and timestamps. Expired roles are omitted from both new JWTs and the trusted server's authoritative current-role lookup.

Department codes are controlled: Executive, Administration, Finance, Tax & GST, Secretarial, Legal, People & HR, Operations, Audit and Product.

ADMIN cannot:

- grant or revoke OWNER, DIRECTOR or ADMIN;
- modify its own access;
- modify another ADMIN or DIRECTOR;
- suspend/revoke the protected OWNER;
- gain Finance/Legal/HR/etc. merely because it is an ADMIN.

## Separation of duties

`AUDITOR` cannot coexist with `OWNER`, `DIRECTOR`, `ADMIN` or `FINANCE`. This rule exists in both application policy and a database trigger. CA and AUDITOR may coexist because a professional may perform accounting/tax review and independent audit only where the company's engagement model and professional rules permit; KRAVIA should still use separate identities when independence requires it.

High-risk finance execution keeps its existing maker-checker controls. Role administration does not bypass those controls.

## Suspension, revocation and stale JWTs

Changing admission or roles increments `authorization_version`. The Next.js Office BFF uses the trusted server-only Supabase secret key to re-read the authoritative identity and active roles, so a stale JWT alone does not preserve browser workspace access after suspension or role removal.

FastAPI remains a second authorization boundary. Before production lock, the Railway runtime must also be protected from direct stale-token use (private/gateway network boundary or equivalent authoritative session check) rather than relying only on JWT expiry.

A `REVOKED` identity cannot be reactivated through the ordinary status action; re-entry requires a new controlled onboarding decision.

## Access review and recovery

- Access review is due every 90 days after approval; `CHANGES_REQUIRED` shortens the next review to seven days.
- Reviewers cannot review their own access.
- OWNER reviews privileged identities; ADMIN may review only delegated non-privileged identities.
- Pending invitations can be revoked within the same authority boundary.
- An authorised administrator may reset another managed user's TOTP factor. Deleting a verified Supabase factor terminates that user's Auth sessions; the user must sign in and enroll MFA again.
- OWNER MFA recovery is deliberately not an ordinary ADMIN/self-service operation. It is a break-glass identity-provider procedure with separate evidence.

## Audit

`office_access_audit` records invitations, role changes, department changes, suspension/revocation, access reviews and MFA reset events. A database trigger prevents UPDATE and DELETE, making these application audit rows append-only.

Audit data is private. No passwords, JWTs, refresh tokens, invite token hashes, TOTP secrets or Supabase secret keys are written to the audit table.

## Deployment secrets

The browser-facing Next.js server requires:

```text
OFFICE_SUPABASE_URL=https://xjtazosozxmudkbxqhjl.supabase.co
OFFICE_SUPABASE_PUBLISHABLE_KEY=<modern publishable key>
OFFICE_SUPABASE_SECRET_KEY=<modern secret key; server only>
```

`OFFICE_SUPABASE_SECRET_KEY` must never use a browser-exposed environment prefix and must not be committed to Git. Rotate it through Supabase/Vercel if exposure is suspected.
