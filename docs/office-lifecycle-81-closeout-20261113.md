# KRAVIA Office: 81-event notification implementation and final-release ledger

Updated: 13 November 2026. This is a **source-verified development report**, not a production or real-provider delivery certificate.

## Coverage

| Environment | Verified source mappings | Dispatch |
| --- | ---: | --- |
| Current production/main baseline (migration 030) | 59 of 81 | All new lifecycle policies disabled |
| Prior developer PR #145 (migrations 031–034) | 74 of 81 | Disabled |
| Consolidated draft PR #150 (migrations 031–042) | **81 of 81** | **Disabled by default** |

All 81 lifecycle event codes have an owned source route in the consolidated development branch. This means **not** that 81 messages have been sent, nor that every external eSign and HR business prerequisite is configured. Source readiness, operational readiness, policy activation, provider submission and inbox delivery are distinct states.

## Final seven implementations

| Event | Source of truth | Recipient and worker |
| --- | --- | --- |
| ONB-04 | Approved HR_APPOINTMENT document with actual ESIGN provider reference, recorded expiry and SIGNING state | Active corporate account; separate gated external worker; no signing tokens emailed |
| EXIT-02 | Approved employee offboarding request and recorded employment departure date | Independently verified explicit former-employee personal email consent |
| EXIT-04 | Completed revocation of identity, active sessions and workforce access | Same consent-bound former-employee worker, never disabled Office mailbox |
| EXIT-05 | Case opened using locked payroll and approved offboarding | Same consent-bound external worker |
| EXIT-06 | Independent Owner case verification and full independently verified bank credits | Same consent-bound external worker |
| EXIT-07 | Approved and signed HR_RELIEVING/HR_EXPERIENCE document with verified PDF and actual delivery evidence | No unsecured attachments; separate verified consent |
| EXIT-08 | Independent Owner final completion after payroll, asset, access, employment and document checks | Same consent-bound external worker |

Migration 041 assigns these seven codes EXTERNAL_NOTICE_WORKER ownership and marks their proof mappings ready. Its private outbox is restricted to the server worker, validates each proof source/recipient and consent at claim and again before delivery, uses idempotent source identity, and quarantines uncertain Brevo responses instead of retrying. Migration 042 fixes the real Document Studio SIGNING state: provider-issued links no longer incorrectly mark the document as DELIVERED. Existing credential senders remain isolated and cannot be duplicated through generic lifecycle mail. Candidate notifications use a separate verified-consent worker.

## Owner and HR operational controls

- Workforce Lifecycle includes a governed Exit Governance panel for genuine employee contact evidence, independent Owner review/rejection, revocation, settlement case creation, independently reconciled Owner verification and final exit signoff. It refuses actions when prerequisites are absent.
- Document Studio includes provider-issued HR eSign request recording (not fake signing URL generation), bounded expiry and existing signed-PDF malware scan pipeline.
- Owner's Lifecycle Mail governance shows the correct internal / candidate / external worker and separate private outcome counts. Owner must explicitly enable individual policies; two runtime dispatch flags are independently required for external notices.
- No migration or test contacts employees, generates signatures, pays salaries, transfers money, changes existing production employee status or sends mail.

## CI and deployment decision

- CI proves source mapping and controlled data flows using disposable PostgreSQL 17, backend and frontend tests, Office browser E2E and search/secret gates. A workflow check must be green at the **latest exact head SHA**; prior success does not prove later commits.
- **Do not merge/deploy this branch just to raise a count.** Execute forward-only migrations after a read-only production schema preflight and verify all policies disabled, current outbox empty, and source contracts match. Never rewrite migrations already recorded in production.
- Real consent documents, genuine bank evidence, official HR document templates (HR_APPOINTMENT, HR_RELIEVING, HR_EXPERIENCE) and a configured actual signing provider are real-world prerequisites. Do not invent them. No link or employee personal email is inferred.
- Product acceptance must exercise one genuine AAL2 signatory and leaver workflow with permissions, independent approvals, mobile screens, provider response handling, revocation, and no-repeat behavior. Do this before enabling any notifications.
- Respect the owner's one-final-Vercel-release directive. Actual kravia1 Vercel build permission and rate-limit status must be verified before the one final production deployment. The earlier Vercel build-limit signal is an external release blocker, not an excuse to bypass checks.

**Engineering completion:** development-source mappings 81/81, pending latest holistic CI and secure operational release acceptance. **Production activation:** not performed. **Real mail delivered:** none through these migrations. **Production deployment:** not performed.
