export const corporateRoles = [
  "DIRECTOR", "CORPORATE_ADMIN", "COMPANY_SECRETARY", "CA_AUDITOR", "CA", "AUDITOR",
  "LEGAL_REVIEWER", "FINANCE_REVIEWER", "COMPLIANCE_REVIEWER", "READ_ONLY_ADVISOR", "SYSTEM_ADMIN",
] as const;
export type CorporateRole = (typeof corporateRoles)[number];

export const capabilities = [
  "meeting.create", "meeting.view", "meeting.edit", "meeting.finalize", "agenda.manage", "minutes.draft", "minutes.review", "minutes.approve", "minutes.export", "resolution.create", "resolution.vote", "resolution.finalize",
  "document.upload", "document.view", "document.download", "document.publish", "document.archive",
  "compliance.view", "compliance.manage", "compliance.verify", "registration.view", "registration.manage",
  "disclosure.review", "disclosure.approve", "disclosure.publish", "audit.view", "access.manage", "security.manage",
  "automation.view", "automation.manage", "automation.run", "finance.view", "finance.manage", "finance.import", "finance.reconcile",
  "asset.view", "asset.manage", "decision.view", "decision.act", "data.import", "data.export", "integration.view", "integration.manage",
  "calendar.view", "readiness.view",
] as const;
export type Capability = (typeof capabilities)[number];

const corporateAdminCapabilities = capabilities.filter((item) => !["minutes.approve", "resolution.finalize", "disclosure.approve", "disclosure.publish"].includes(item));
const financeCapabilities: readonly Capability[] = ["finance.view", "finance.manage", "finance.import", "finance.reconcile", "document.view", "document.download", "compliance.view", "registration.view", "calendar.view", "decision.view"];
const complianceCapabilities: readonly Capability[] = ["compliance.view", "compliance.manage", "compliance.verify", "document.view", "document.download", "registration.view", "calendar.view", "decision.view"];

const grants: Record<CorporateRole, readonly Capability[]> = {
  DIRECTOR: capabilities,
  SYSTEM_ADMIN: capabilities,
  CORPORATE_ADMIN: corporateAdminCapabilities,
  COMPANY_SECRETARY: ["meeting.create", "meeting.view", "meeting.edit", "agenda.manage", "minutes.draft", "minutes.review", "minutes.export", "resolution.create", "document.upload", "document.view", "document.download", "compliance.view", "compliance.manage", "compliance.verify", "registration.view", "registration.manage", "disclosure.review", "audit.view", "automation.view", "decision.view", "decision.act", "calendar.view", "readiness.view"],
  CA_AUDITOR: financeCapabilities,
  CA: financeCapabilities,
  AUDITOR: ["document.view", "document.download", "compliance.view", "registration.view", "audit.view", "finance.view", "calendar.view", "decision.view"],
  LEGAL_REVIEWER: ["meeting.view", "minutes.review", "document.view", "document.download", "disclosure.review", "audit.view", "decision.view", "calendar.view"],
  FINANCE_REVIEWER: financeCapabilities,
  COMPLIANCE_REVIEWER: complianceCapabilities,
  READ_ONLY_ADVISOR: ["document.view", "compliance.view", "registration.view", "finance.view", "asset.view", "calendar.view", "decision.view"],
};

export const sensitiveCapabilities = new Set<Capability>([
  "meeting.finalize", "minutes.approve", "resolution.finalize", "document.publish", "document.archive", "disclosure.approve", "disclosure.publish", "access.manage", "security.manage", "integration.manage", "data.export",
]);
export function hasCapability(role: CorporateRole, capability: Capability) { return grants[role].includes(capability); }
export function requiresAal2(capability: Capability) { return sensitiveCapabilities.has(capability); }
