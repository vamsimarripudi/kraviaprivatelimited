# KRAVIA Office — activation / invitation release checklist

**State:** code proposed in a review PR. These instructions do not claim a production deployment.

## Ownership and workspaces

- Founder / CTO: Engineering, Product, Security, DevOps, QA, AI, Architecture and company-wide read-only oversight. Access administration remains a Founder control.
- Finance & People leader: Finance, Accounts, HR, Payroll, Sales, Growth, Procurement. Assign job and scoped access profiles in Office after registration.
- COO / Governance leader: Operations, Administration, Legal, Company Secretary workflow, Customer Support. A statutory Company Secretary title requires a legally valid appointment.
- Future department heads: use the existing employee position, access-profile and reporting-line workflow. Department ownership transfers require proposal and recipient acceptance. Positions and roles are not hardcoded to personal emails.

## Controlled activation

Backend migration **v29** adds `office_auth_users.workspace_status`, default `ACTIVE` so previously onboarded identities remain accessible. Once the migration is deployed, first-party invite registration creates `PENDING` employees when `OFFICE_WORKSPACE_APPROVAL_REQUIRED=true` (default in `APP_ENV=production`). Employees can sign in, complete MFA, view a processing page and request activation. Business API authorization rejects pending accounts. The Owner can approve only a `REQUESTED` identity, and only after at least one active scoped access profile has been assigned in the control plane.

**Rollout order:** staging database v29 migration → backend deployment → frontend deployment → smoke tests → release review. The frontend access console reads the new database column, so it must not be deployed before the migration. Do not mark staging or production live without read-back evidence.

## Invitation reliability

The private email invitation goes through Brevo with an HTML CTA and a plain-text link. Delivery submission is reported as `ACCEPTED`, `UNAVAILABLE`, `REJECTED` or `UNKNOWN` (provider accepted is not proof of final inbox delivery). The Owner can revoke a PENDING invitation or reissue, which atomically invalidates the old token. The UI retains a one-time copy fallback if provider delivery is unconfirmed.

Verify the runtime-only values: `OFFICE_API_ORIGIN` on the Vercel server, `APP_ENV=production`, first-party identity and database credentials on FastAPI, `BREVO_API_KEY`, and the verified sender `hello@kraviaprivatelimited.com`. Never expose these secret values in logs or client code.

## Acceptance verification

- Create a test invitation; confirm provider result and inbox CTA.
- Reissue and confirm the previous token cannot register; confirm expired and accepted tokens cannot be reused.
- Register a new test account; verify AAL2 sign-in succeeds while business API access is forbidden.
- Request workspace activation; assign role/job/access profiles; verify Founder-only approval and subsequent access.
- Verify Jaya can access only approved legal/CS/operations scopes, and a future Head receives only an explicitly assigned department. Verify non-Finance roles cannot access Finance APIs.
- Verify role-transfer revocation removes former operator write authority, while Owner monitoring remains read-only.
- Run complete CI, migration and security tests. Verify production configuration and actual delivery separately.

## Current production prerequisites

The linked GitHub PR does not establish whether the production Vercel project has a valid `OFFICE_API_ORIGIN` or whether a live KRAVIA FastAPI service is reachable. Do not assert the reported “Office invite offline” symptom is resolved until a real authenticated invite is accepted through the target production infrastructure.
