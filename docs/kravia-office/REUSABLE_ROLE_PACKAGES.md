# KRAVIA Office — One Reusable Role & Onboarding System

## Design decision

No custom onboarding code or separate hard-coded role screen for Vamsi, Satish,
Jaya, or anyone hired later. Keep the existing **canonical** catalogues:

- \`office_department_catalog\` — 20 business functions.
- \`office_position_catalog\` — job titles and levels.
- \`office_access_profile_catalog\` and permission mappings — capabilities.
- \`office_job_assignments\` — each employee's **one primary** role.
- \`office_employee_functional_positions\` — **multiple additional** accountable
  duties. These are job context, never an authorization shortcut.
- Existing recruitment, signed documents, payroll, attendance, salary slips
  and payment-evidence engines — no new parallel versions.

The new \`office_role_packages\` table merely composes those sources into a
versioned, reusable package. An active package can be applied to *any verified
employee* through one atomic transaction calling the canonical
\`office_assign_job\` and \`office_assign_access_profile\` functions.

## Role package lifecycle

1. A current authorised department administrator opens
   **Office → Reusable role packages** with a first-party MFA session.
2. Select an existing primary department and position. Add job responsibilities,
   supplemental functional positions, department/project/repository-scoped
   access profiles, work-pattern metadata and onboarding evidence checklist.
3. **Save draft**: creates a new immutable numbered version. No employee changes.
4. **Publish**: makes that version the current one for its code; prior published
   versions are retired, but any previously applied snapshots remain untouched.
5. **Apply** to an already activated Office identity. The database rechecks
   all department authority, actor/recipient permissions and scoped profile
   rights, and writes existing job and access records in one transaction.
6. Each employee opens **Office → My roles & onboarding**. Items start as
   \`PENDING\`; a human submits actual document references and a separate
   authorised reviewer verifies them.
7. Payroll compensation, 5×6h attendance, 3× weekend premiums, bank settlement,
   issue of payslips and department ownership transfer remain independent,
   governed workflows. A role package never marks an item paid or signed.

Reapplying the same package version to the same employee returns the existing
application. A new version creates a new immutable employee-specific history.

## Three-person configuration (examples, not hard-coded presets)

The authorised Founder chooses package contents from current catalogues.

- **Founder / Full-stack developer:** no self-modifying Founder access through
  this workflow; the protected Founder identity is administered by governance.
- **Satish:** primary developer role and a supplemental Finance responsibility,
  with Finance access only when current Finance ownership and permission rules
  allow it. CEO/CFO statutory designations remain separate corporate records.
- **Jaya:** a primary sales or marketing job and additional marketing/sales/
  frontend functional duties, each with independently scoped rights. Corporate
  designation and qualification-restricted functions remain separately governed.

A supplemental position in Finance or Engineering **does not** convey a
department's write authority on its own. Scope must be explicitly assigned and
passes the existing permission engine. After a departmental handover, the former
owner cannot reapply or author packages in that department.

## Employee profile contract

The same API backs the Founder roster and employee self-service:
\`GET /api/office-role-packages\`. Non-administrators receive only their own
applications, tasks, verified employee ID (when recorded) and functional duties;
they never receive the other employees' directory or package catalogue.

\`/office/role-packages\` is limited to authorised access administrators.
\`/office/my-role\` is available to employees through their existing Office
identity. Photos are represented with initials until a legitimate, approved
photo is stored in the canonical identity system; no placeholder is asserted as
a real portrait. Recruitment and appointment evidence links point to existing
protected Office sections, not fabricated applications.

## Responsibilities, access and payroll must remain distinct

| Concept | Canonical authority | Package behaviour |
| --- | --- | --- |
| Login / MFA | First-party Office identity | Requires pre-existing active user |
| Primary job | \`office_assign_job\` | Calls the original RPC |
| Secondary duties | \`office_employee_functional_positions\` | Stores human-readable assignments |
| Scoped capabilities | \`office_assign_access_profile\` | Calls the original RPC with no expiry |
| Department ownership | Owner-accepted handover | Not changed |
| Director/CS legal appointments | Signed corporate approvals | Not changed |
| Recruitment/offer | Recruitment OS | Not fabricated |
| Appointment documents | Document Studio and signed evidence | Checklist asks for verification |
| 30-hour work schedule | Worktime policy and attendance | Package stores reference metadata only |
| Gross salary / OT | Payroll OS approved salary structure/rules | Not changed |
| Payslip issuance / bank payment | Locked payroll and verified settlement | Not changed |

## Release safety and verification

- All package and task tables use RLS and have no browser API permissions.
- Mutations require a first-party Office MFA session and same-origin POST.
- Transfer-authority checks happen **before** assigning a role, not afterward.
- Existing \`OWNER\` job protection, owner-only profiles and independent
  statutory/payroll approvals remain in place.
- An applied package snapshot is hashed and cannot be silently edited.
- Required checklist items cannot be waived, and employees cannot approve their
  own submitted evidence.
- The isolated PostgreSQL CI test exercises template create, publish, apply,
  repeat apply, checklist review, immutable history and former-owner DENY.
- Release requires CI green and isolated database migration verified before
  applying migration or deploying updated application code.

## Non-goals

This feature does **not** automatically create the real Satish/Jaya identities,
backdate documents, fill August historical attendance, approve 3× weekend
compensation, move money or prove salaries paid. Those require their own
verified human/business evidence and, where applicable, Board decisions.
