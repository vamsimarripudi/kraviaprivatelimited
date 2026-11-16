# KRAVIA Founder Laptop — Independent Security Recovery

This workflow **never self-approves or automatically re-trusts** a revoked device.

## Who does what

1. **Founder (Owner)** opens **KRAVIA Office → Company control → Identity & Devices**, finds the registered laptop and confirms the revoked/pending state. No admin rights are required just to view the device's own status.
2. **Independent reviewer** signs in with their own AAL2 Office account and an active Director or Admin role. They inspect the physical Windows laptop, verify BitLocker, screen lock, Microsoft Defender scan, updates, firewall, and the absence of compromise indicators. They also verify company device-management authority or the company asset register.
3. The reviewer opens **Independent Founder Device Recovery → Review security**, checks each item **only after actually verifying it**, provides a management/asset evidence reference and a written verification note (30–500 characters), and submits. The laptop remains REVOKED.
4. **A different independent Director or Admin** signs in using their own AAL2 account, reviews the recorded evidence and clicks **Approve reviewed device**, providing a meaningful signed reason. They may not be the device owner or the original reviewer. The review must be younger than 72 hours, more recent than the last revocation, and the latest posture.
5. **Founder** returns to the actual Windows laptop, refreshes **Identity & Devices**, then clicks **Bind this browser**. Browser binding is not permitted before independent approval.

With the current roles, **Manohar (Director)** and **Jaya M (Admin)** can fulfill the independent reviewer and approver roles, respectively, if they complete the actual assessment. The workflow does **not** assign additional roles or assume that either is a designated IT professional.

## Current compromised flag incident

The prior historic record reports COMPLIANT with compromise_detected=true. The PostgreSQL audit history is preserved. That contradictory input caused the device to be revoked, not infected by definition. The newer workflow rejects any fresh COMPLIANT assertion unless all security checks are explicitly true and compromise=false; the review requires a different human identity from the Owner.

**Do not erase the original audit record or directly flip trust_state in SQL.** Approval occurs only through the controlled two-person RPC, with both actions recorded in office_access_audit.

## Company asset vs BYOD

Company-managed is not synonymous with merely being used for work. Before attesting company-managed, verify an appropriate KRAVIA asset/management reference. If personally owned without an approved management arrangement, do not check company-managed and do not approve this flow. BYOD onboarding needs separate policy and controls; the current browser binding requires company-managed=true.

## Security invariants

- The API checks first-party Office authentication, active AAL2, origin and role. Postgres independently verifies reviewer/approver role, active identity, Owner target, device status, two different human reviewers, fresh detailed posture and approval reason.
- All RPCs are callable only through the trusted service role, and the review table enforces RLS. The service must never accept arbitrary actor IDs from the browser.
- The legacy office_approve_device RPC refuses to restore an Owner device. The registry remains REVOKED after recording a clean posture until the independent approval action succeeds.
- Revoked Digital IDs are separate from device trust and stay revoked; recovering a laptop never reissues credentials or physical access grants.
- No endpoint automatically scans Windows. The security reviewer must verify the laptop's actual system state before submitting their human attestation.

## Deployment and acceptance

1. Review and test the migration in isolated PostgreSQL (including reapply, invalid attestation, reviewer/approver separation, no self-approval and audit history).
2. Apply migration in a controlled production release before shipping the frontend that calls it. Verify new RPC execute grants and no browser grants.
3. Deploy the matching Next.js frontend, preserve role assignments, and test the route with three signed-in AAL2 roles and a synthetic revoked device first.
4. For the real laptop, require a legitimate independent Windows review and two authorised approvals, then the Founder binds their browser on that machine.
5. Confirm all actions recorded with the correct actor and that no revoked credential was reissued.

No production device or permission state should be modified by CI, a source commit, or preview deployment.
