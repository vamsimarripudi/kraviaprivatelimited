# Authorization

Access is invitation/admin provisioned only. The role model is DIRECTOR, CORPORATE_ADMIN, COMPANY_SECRETARY, CA, AUDITOR, LEGAL_REVIEWER, FINANCE_REVIEWER, COMPLIANCE_REVIEWER, READ_ONLY_ADVISOR and SYSTEM_ADMIN. The legacy `CA_AUDITOR` role remains supported for migration compatibility.

Permissions are evaluated as role + capability + resource assignment + classification + expiry. CA/Auditor access must be assigned to relevant resource metadata; it does not imply Board access. Assignments can expire and must be revoked during offboarding. A user cannot self-upgrade.

High-risk capabilities (finalising minutes/resolutions, publication, archiving, access/security administration) require AAL2. Supabase MFA must be enabled and real re-authentication policy configured before production release.
