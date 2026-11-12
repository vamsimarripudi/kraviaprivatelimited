/**
 * KRAVIA Office employee-lifecycle email inventory.
 *
 * Exact 81-event catalog from the approved implementation scope. IMPORTANT:
 * These are PROPOSED event IDs and template copy, not committed backend events
 * or production delivery permissions. Do not dispatch from this catalog alone.
 *
 * Existing denotes a closely matching legacy template, not an active mapping.
 * New events require a canonical committed event, authorised recipient,
 * verification/approval gate, versioned HTML/text renderer and outbox.
 */
export type OfficeMailPriority = "P0" | "P1" | "P2";
export type OfficeMailBaseline = "Existing" | "New";
export type OfficeMailDefinition = Readonly<{
  id: string;
  intent: string;
  triggerProposal: string;
  recipientProposal: string;
  baseline: OfficeMailBaseline;
  priority: OfficeMailPriority;
  subject: string;
}>;

export const OFFICE_LIFECYCLE_CATALOG: readonly OfficeMailDefinition[] = Object.freeze([
  { id: "AUTH-01", intent: "Office invitation", triggerProposal: "Approved invite created", recipientProposal: "Invitee", baseline: "Existing", priority: "P0", subject: "You are invited to KRAVIA Office" },
  { id: "AUTH-02", intent: "Invitation reminder", triggerProposal: "Still PENDING near expiry; one opt-in reminder", recipientProposal: "Invitee", baseline: "New", priority: "P1", subject: "Reminder: Your KRAVIA Office invitation expires soon" },
  { id: "AUTH-03", intent: "Invitation expired", triggerProposal: "Invite moved to EXPIRED", recipientProposal: "Invitee and authorised inviter", baseline: "New", priority: "P1", subject: "Your KRAVIA Office invitation has expired" },
  { id: "AUTH-04", intent: "Registration accepted", triggerProposal: "Registration completed, identity ACTIVE", recipientProposal: "Employee", baseline: "New", priority: "P0", subject: "Your KRAVIA Office account is registered" },
  { id: "AUTH-05", intent: "Corporate email sign-in code", triggerProposal: "Password session requests email OTP, eligible account only", recipientProposal: "Account holder", baseline: "Existing", priority: "P0", subject: "Your KRAVIA Office verification code" },
  { id: "AUTH-06", intent: "New device approval", triggerProposal: "Unrecognised device requires independent decision", recipientProposal: "Authorised reviewer", baseline: "Existing", priority: "P0", subject: "Review a new KRAVIA Office device sign-in" },
  { id: "AUTH-07", intent: "Device approved or declined", triggerProposal: "Review decision recorded", recipientProposal: "Account holder", baseline: "New", priority: "P1", subject: "KRAVIA Office device review update" },
  { id: "AUTH-08", intent: "Password reset link issued", triggerProposal: "Explicit authorised recovery or verified self-service request", recipientProposal: "Account holder", baseline: "New", priority: "P0", subject: "Reset your KRAVIA Office password" },
  { id: "AUTH-09", intent: "Password changed", triggerProposal: "Confirmed password update", recipientProposal: "Account holder", baseline: "New", priority: "P0", subject: "Your KRAVIA Office password was changed" },
  { id: "AUTH-10", intent: "Suspicious sign-in or account lock", triggerProposal: "Verified security event", recipientProposal: "Account holder and security reviewer", baseline: "New", priority: "P1", subject: "Security alert for your KRAVIA Office account" },
  { id: "AUTH-11", intent: "Sessions revoked / access suspended", triggerProposal: "Authorised revocation committed", recipientProposal: "Affected employee", baseline: "New", priority: "P0", subject: "KRAVIA Office access status updated" },
  { id: "AUTH-12", intent: "Authenticator enrollment / factor change", triggerProposal: "Verified MFA enrollment or approved factor reset", recipientProposal: "Account holder", baseline: "New", priority: "P1", subject: "Your KRAVIA Office sign-in protection changed" },
  { id: "HIRE-01", intent: "Application received", triggerProposal: "Application recorded by recruitment system", recipientProposal: "Candidate", baseline: "New", priority: "P1", subject: "Application received — KRAVIA" },
  { id: "HIRE-02", intent: "Interview scheduled", triggerProposal: "Interview record scheduled/approved", recipientProposal: "Candidate and interviewers", baseline: "New", priority: "P1", subject: "Interview details — KRAVIA" },
  { id: "HIRE-03", intent: "Interview rescheduled", triggerProposal: "Confirmed revised interview time", recipientProposal: "Candidate and interviewers", baseline: "New", priority: "P1", subject: "Updated interview schedule — KRAVIA" },
  { id: "HIRE-04", intent: "Interview cancelled", triggerProposal: "Interview cancellation recorded", recipientProposal: "Candidate and interviewers", baseline: "New", priority: "P1", subject: "Update to your KRAVIA interview" },
  { id: "HIRE-05", intent: "Recruitment documents requested", triggerProposal: "Approved document request created", recipientProposal: "Candidate", baseline: "New", priority: "P0", subject: "Document request for your KRAVIA application" },
  { id: "HIRE-06", intent: "Recruitment document needs correction", triggerProposal: "Document reviewer rejects or requests new evidence", recipientProposal: "Candidate", baseline: "New", priority: "P1", subject: "Action required: Your KRAVIA document" },
  { id: "HIRE-07", intent: "Offer awaiting director approval", triggerProposal: "Offer enters governed review state", recipientProposal: "Authorised director/reviewer", baseline: "New", priority: "P0", subject: "Approval required: KRAVIA offer" },
  { id: "HIRE-08", intent: "Approved offer available", triggerProposal: "Approved document signed/published with candidate access", recipientProposal: "Candidate", baseline: "New", priority: "P0", subject: "Your KRAVIA offer letter is ready" },
  { id: "HIRE-09", intent: "Offer accepted", triggerProposal: "Acceptance is actually recorded and verified", recipientProposal: "Candidate and approved hiring owner", baseline: "New", priority: "P0", subject: "KRAVIA offer acceptance confirmed" },
  { id: "HIRE-10", intent: "Offer declined, withdrawn or expired", triggerProposal: "Canonical status recorded", recipientProposal: "Candidate as appropriate; hiring owner", baseline: "New", priority: "P1", subject: "Update on your KRAVIA offer" },
  { id: "ONB-01", intent: "Welcome aboard", triggerProposal: "Active employee identity + accepted employment + director-approved joining", recipientProposal: "Employee", baseline: "New", priority: "P0", subject: "Welcome aboard KRAVIA, {{employee_first_name}}" },
  { id: "ONB-02", intent: "Private onboarding checklist", triggerProposal: "Onboarding workflow starts, assigned tasks exist", recipientProposal: "Employee", baseline: "New", priority: "P0", subject: "Your KRAVIA joining checklist" },
  { id: "ONB-03", intent: "Appointment letter ready", triggerProposal: "Signed approved appointment document stored", recipientProposal: "Employee", baseline: "New", priority: "P0", subject: "Your KRAVIA appointment letter is available" },
  { id: "ONB-04", intent: "E-sign requested", triggerProposal: "Document requires signature; permitted signing link issued", recipientProposal: "Signatory", baseline: "New", priority: "P0", subject: "Signature requested: KRAVIA appointment documents" },
  { id: "ONB-05", intent: "Evidence submitted / returned", triggerProposal: "Checklist evidence reaches reviewer or is returned", recipientProposal: "Employee or authorised reviewer", baseline: "New", priority: "P0", subject: "KRAVIA onboarding document review update" },
  { id: "ONB-06", intent: "First-day instructions", triggerProposal: "Actual joining date and work arrangement confirmed", recipientProposal: "Employee", baseline: "New", priority: "P0", subject: "Your first day at KRAVIA" },
  { id: "ONB-07", intent: "Equipment and account readiness", triggerProposal: "Verified device/asset assignment or provisioning change", recipientProposal: "Employee", baseline: "New", priority: "P1", subject: "Your KRAVIA work setup is ready" },
  { id: "ONB-08", intent: "Policy acknowledgement requested", triggerProposal: "Versioned policy assigned in Office", recipientProposal: "Employee", baseline: "New", priority: "P0", subject: "Please acknowledge your KRAVIA policies" },
  { id: "ONB-09", intent: "Assigned responsibilities available", triggerProposal: "Role package actually applied and scoped permissions verified", recipientProposal: "Employee", baseline: "New", priority: "P0", subject: "Your KRAVIA roles and responsibilities" },
  { id: "ONB-10", intent: "Onboarding complete", triggerProposal: "All required checklist items verified and governance approved", recipientProposal: "Employee and hiring manager", baseline: "New", priority: "P0", subject: "KRAVIA onboarding completed" },
  { id: "ONB-11", intent: "First-week check-in", triggerProposal: "7th calendar day after actual joining, if employed", recipientProposal: "Employee and manager", baseline: "New", priority: "P2", subject: "Your first-week check-in at KRAVIA" },
  { id: "ONB-12", intent: "First-month check-in", triggerProposal: "30th day after actual joining, if employed", recipientProposal: "Employee and manager", baseline: "New", priority: "P2", subject: "Your first-month check-in at KRAVIA" },
  { id: "ROLE-01", intent: "Position or functional duty assigned", triggerProposal: "Canonical role package applied / job changed", recipientProposal: "Employee", baseline: "New", priority: "P0", subject: "Your KRAVIA responsibilities have been updated" },
  { id: "ROLE-02", intent: "Permission granted or revoked", triggerProposal: "Verified access-profile or scoped permission change", recipientProposal: "Employee", baseline: "New", priority: "P0", subject: "KRAVIA Office access permissions changed" },
  { id: "ROLE-03", intent: "Reporting line changed", triggerProposal: "Approved manager mapping changed", recipientProposal: "Employee, old/new manager where appropriate", baseline: "New", priority: "P1", subject: "Your reporting structure at KRAVIA" },
  { id: "ROLE-04", intent: "Department handover proposed", triggerProposal: "Governed transfer proposal committed", recipientProposal: "Proposed receiving head", baseline: "New", priority: "P1", subject: "Department ownership transfer awaiting acceptance" },
  { id: "ROLE-05", intent: "Department handover accepted", triggerProposal: "Receiving head accepts; former owner write rights checked", recipientProposal: "New head and former head", baseline: "New", priority: "P0", subject: "Department ownership transfer completed" },
  { id: "ROLE-06", intent: "Transfer rejected or expired", triggerProposal: "Governed transfer status recorded", recipientProposal: "Requester and recipient", baseline: "New", priority: "P1", subject: "KRAVIA department transfer update" },
  { id: "ROLE-07", intent: "Privileged access review requested", triggerProposal: "Access-review record created", recipientProposal: "Independent authorised reviewer", baseline: "New", priority: "P1", subject: "Access review required — KRAVIA Office" },
  { id: "ROLE-08", intent: "Access review decision", triggerProposal: "Approved or changes-required decision committed", recipientProposal: "Employee and access owner", baseline: "New", priority: "P1", subject: "KRAVIA access review decision" },
  { id: "ROLE-09", intent: "Package version assigned", triggerProposal: "New role-package version applied to employee", recipientProposal: "Employee", baseline: "New", priority: "P1", subject: "Your KRAVIA role package has been updated" },
  { id: "TIME-01", intent: "Work schedule assigned or revised", triggerProposal: "Approved work schedule/version effective", recipientProposal: "Employee", baseline: "New", priority: "P1", subject: "Your KRAVIA work schedule" },
  { id: "TIME-02", intent: "Missing attendance reminder", triggerProposal: "Scheduled reminder; no approved/open check-in by cutoff", recipientProposal: "Employee", baseline: "New", priority: "P2", subject: "Please review your KRAVIA attendance" },
  { id: "TIME-03", intent: "Attendance correction submitted", triggerProposal: "Verified correction awaiting separate reviewer", recipientProposal: "Independent authorised reviewer", baseline: "New", priority: "P1", subject: "Attendance correction awaiting review" },
  { id: "TIME-04", intent: "Attendance correction decision", triggerProposal: "Approved or rejected correction committed", recipientProposal: "Employee", baseline: "New", priority: "P1", subject: "Your attendance correction was reviewed" },
  { id: "TIME-05", intent: "Overtime review requested", triggerProposal: "Weekday/weekend/night extra work evidence submitted", recipientProposal: "Independent authorised reviewer", baseline: "New", priority: "P1", subject: "Overtime request awaiting review" },
  { id: "TIME-06", intent: "Overtime approved / rejected", triggerProposal: "Recorded reviewer decision, approved policy in force", recipientProposal: "Employee", baseline: "New", priority: "P1", subject: "Your KRAVIA overtime request was reviewed" },
  { id: "TIME-07", intent: "Flex Day eligible", triggerProposal: "Five distinct approved six-hour weekdays, approved Flex policy", recipientProposal: "Employee", baseline: "New", priority: "P1", subject: "Your KRAVIA Flex Day eligibility" },
  { id: "TIME-08", intent: "Flex Day request decision", triggerProposal: "Independent decision committed", recipientProposal: "Employee", baseline: "New", priority: "P1", subject: "Your KRAVIA Flex Day request update" },
  { id: "TIME-09", intent: "Leave request / decision", triggerProposal: "Real request or reviewer decision recorded", recipientProposal: "Approver or employee", baseline: "New", priority: "P1", subject: "KRAVIA leave request update" },
  { id: "TIME-10", intent: "Payroll attendance cutoff", triggerProposal: "Upcoming verified period cutoff", recipientProposal: "Employee and permitted approver", baseline: "New", priority: "P1", subject: "Attendance review closes soon" },
  { id: "PAY-01", intent: "Compensation draft for review", triggerProposal: "Effective-dated compensation proposal submitted", recipientProposal: "Independent reviewer/director", baseline: "New", priority: "P0", subject: "Compensation proposal requires approval" },
  { id: "PAY-02", intent: "Compensation approved / rejected", triggerProposal: "Governed final decision committed", recipientProposal: "Affected employee", baseline: "New", priority: "P0", subject: "Your KRAVIA compensation record was updated" },
  { id: "PAY-03", intent: "Payroll period opened", triggerProposal: "Actual period created", recipientProposal: "Finance preparer", baseline: "New", priority: "P1", subject: "KRAVIA payroll period is open" },
  { id: "PAY-04", intent: "Payroll review required", triggerProposal: "Locked review request sent to independent approver", recipientProposal: "Payroll reviewer/director", baseline: "New", priority: "P0", subject: "KRAVIA payroll approval required" },
  { id: "PAY-05", intent: "Payroll approved", triggerProposal: "All required approvals completed and results locked", recipientProposal: "Finance preparer", baseline: "New", priority: "P0", subject: "KRAVIA payroll run approved" },
  { id: "PAY-06", intent: "Salary slip issued", triggerProposal: "Immutable approved payroll payslip exists", recipientProposal: "Employee", baseline: "New", priority: "P0", subject: "Your KRAVIA payslip for {{pay_period}} is ready" },
  { id: "PAY-07", intent: "Payment batch prepared", triggerProposal: "Batch only PREPARED; not bank-confirmed", recipientProposal: "Finance preparer/reviewer", baseline: "New", priority: "P1", subject: "KRAVIA salary batch prepared — not yet paid" },
  { id: "PAY-08", intent: "Salary credit verified", triggerProposal: "Independent bank settlement verification covers full net salary", recipientProposal: "Employee", baseline: "New", priority: "P0", subject: "KRAVIA salary payment confirmed — {{pay_period}}" },
  { id: "PAY-09", intent: "Partial payment / balance outstanding", triggerProposal: "Verified credit is less than net; remaining amount owed", recipientProposal: "Employee and authorised Finance", baseline: "New", priority: "P0", subject: "Important: Outstanding KRAVIA salary balance" },
  { id: "PAY-10", intent: "Unpaid salary overdue", triggerProposal: "Pay date passed with independently unverified balance", recipientProposal: "Employee and escalation approver", baseline: "New", priority: "P0", subject: "Salary payment follow-up for {{pay_period}}" },
  { id: "PAY-11", intent: "Corrected payslip issued", triggerProposal: "New approved correction/adjustment and new immutable issue", recipientProposal: "Employee", baseline: "New", priority: "P1", subject: "Updated KRAVIA payslip available" },
  { id: "PAY-12", intent: "Annual wage or statutory statement ready", triggerProposal: "Approved statement exists in private Office vault", recipientProposal: "Employee", baseline: "New", priority: "P2", subject: "Your annual KRAVIA payroll statement is available" },
  { id: "DEV-01", intent: "Training assigned", triggerProposal: "Governed training assignment recorded", recipientProposal: "Employee", baseline: "New", priority: "P1", subject: "Training assigned in KRAVIA Office" },
  { id: "DEV-02", intent: "Training due reminder", triggerProposal: "Approved due date approaching and incomplete", recipientProposal: "Employee and assigned lead", baseline: "New", priority: "P2", subject: "KRAVIA training due soon" },
  { id: "DEV-03", intent: "Training evidence accepted / rejected", triggerProposal: "Reviewer records result", recipientProposal: "Employee", baseline: "New", priority: "P2", subject: "Training completion review update" },
  { id: "DEV-04", intent: "Performance review scheduled", triggerProposal: "Governed review record created", recipientProposal: "Employee and reviewer", baseline: "New", priority: "P2", subject: "Your KRAVIA performance review" },
  { id: "DEV-05", intent: "Review outcome available", triggerProposal: "Review finalised and released to employee", recipientProposal: "Employee", baseline: "New", priority: "P2", subject: "Your KRAVIA development review is ready" },
  { id: "DEV-06", intent: "Development plan assigned", triggerProposal: "Approved development plan published", recipientProposal: "Employee", baseline: "New", priority: "P2", subject: "Your KRAVIA development plan" },
  { id: "DEV-07", intent: "Task or approval assigned", triggerProposal: "Authorised Office request/task assigned", recipientProposal: "Assignee", baseline: "New", priority: "P1", subject: "Action assigned in KRAVIA Office" },
  { id: "DEV-08", intent: "Controlled policy/document published", triggerProposal: "Versioned document released to recipient's scope", recipientProposal: "Eligible staff", baseline: "New", priority: "P1", subject: "KRAVIA policy or document update" },
  { id: "EXIT-01", intent: "Exit workflow initiated", triggerProposal: "Approved departure/offboarding request started", recipientProposal: "Authorised director/people reviewer", baseline: "New", priority: "P1", subject: "KRAVIA employee offboarding review" },
  { id: "EXIT-02", intent: "Exit acknowledged", triggerProposal: "Confirmed notice and final-day details recorded", recipientProposal: "Employee", baseline: "New", priority: "P1", subject: "Your KRAVIA exit process" },
  { id: "EXIT-03", intent: "Asset return requested", triggerProposal: "Assets actually registered to employee", recipientProposal: "Employee", baseline: "New", priority: "P1", subject: "KRAVIA equipment return checklist" },
  { id: "EXIT-04", intent: "Office access withdrawn", triggerProposal: "Governed access revocation committed", recipientProposal: "Employee and Security", baseline: "New", priority: "P0", subject: "KRAVIA Office access removed" },
  { id: "EXIT-05", intent: "Final settlement under review", triggerProposal: "Payroll settlement case created", recipientProposal: "Employee and authorised Finance", baseline: "New", priority: "P1", subject: "KRAVIA final settlement under review" },
  { id: "EXIT-06", intent: "Final settlement verified", triggerProposal: "Independent bank credits fully reconciled", recipientProposal: "Employee", baseline: "New", priority: "P1", subject: "KRAVIA final settlement confirmed" },
  { id: "EXIT-07", intent: "Relieving/experience document available", triggerProposal: "Signed, approved document stored", recipientProposal: "Former employee", baseline: "New", priority: "P1", subject: "Your KRAVIA employment document is ready" },
  { id: "EXIT-08", intent: "Offboarding completed", triggerProposal: "People, assets and access steps complete", recipientProposal: "Employee, authorised director", baseline: "New", priority: "P2", subject: "KRAVIA exit process completed" },
]);

export const OFFICE_MAIL_CATEGORY_COUNTS: Readonly<Record<string, number>> = Object.freeze({
  AUTH: 12, HIRE: 10, ONB: 12, ROLE: 9, TIME: 10, PAY: 12, DEV: 8, EXIT: 8,
});

/** A deliberate release gate. No proposed catalog entry activates a provider send. */
export const OFFICE_LIFECYCLE_DISPATCH_ENABLED = false as const;

export function validateOfficeLifecycleCatalog(): void {
  if (OFFICE_LIFECYCLE_CATALOG.length !== 81) throw new Error("Expected 81 employee lifecycle email definitions");
  const actual = new Map<string, number>();
  const unique = new Set<string>();
  for (const entry of OFFICE_LIFECYCLE_CATALOG) {
    if (!/^(AUTH|HIRE|ONB|ROLE|TIME|PAY|DEV|EXIT)-\d{2}$/.test(entry.id)) {
      throw new Error("Invalid employee mail event ID: " + entry.id);
    }
    if (unique.has(entry.id)) throw new Error("Duplicate employee mail event ID: " + entry.id);
    unique.add(entry.id);
    const prefix = entry.id.split("-")[0]!;
    actual.set(prefix, (actual.get(prefix) || 0) + 1);
    if (!entry.intent || !entry.triggerProposal || !entry.recipientProposal || !entry.subject) {
      throw new Error("Incomplete employee mail definition: " + entry.id);
    }
  }
  for (const [prefix, expected] of Object.entries(OFFICE_MAIL_CATEGORY_COUNTS)) {
    if (actual.get(prefix) !== expected) throw new Error("Employee mail catalog mismatch in " + prefix);
  }
}
