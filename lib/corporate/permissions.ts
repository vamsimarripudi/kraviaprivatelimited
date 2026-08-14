export const corporateRoles = [
  "DIRECTOR",
  "CORPORATE_ADMIN",
  "COMPANY_SECRETARY",
  "CA_AUDITOR",
  "CA",
  "AUDITOR",
  "LEGAL_REVIEWER",
  "FINANCE_REVIEWER",
  "COMPLIANCE_REVIEWER",
  "READ_ONLY_ADVISOR",
  "SYSTEM_ADMIN",
] as const;

export type CorporateRole = (typeof corporateRoles)[number];

export const capabilities = [
  "meeting.create", "meeting.view", "meeting.edit", "meeting.finalize",
  "agenda.manage", "minutes.draft", "minutes.review", "minutes.approve", "minutes.export",
  "resolution.create", "resolution.vote", "resolution.finalize",
  "document.upload", "document.view", "document.download", "document.publish", "document.archive",
  "compliance.view", "compliance.manage", "compliance.verify",
  "registration.view", "registration.manage", "disclosure.review", "disclosure.approve",
  "disclosure.publish", "audit.view", "access.manage", "security.manage",
] as const;

export type Capability = (typeof capabilities)[number];

const grants: Record<CorporateRole, readonly Capability[]> = {
  DIRECTOR: capabilities,
  SYSTEM_ADMIN: capabilities,
  CORPORATE_ADMIN: capabilities.filter((item) => item !== "minutes.approve" && item !== "resolution.finalize"),
  COMPANY_SECRETARY: ["meeting.create", "meeting.view", "meeting.edit", "agenda.manage", "minutes.draft", "minutes.review", "minutes.export", "resolution.create", "document.upload", "document.view", "document.download", "compliance.view", "compliance.manage", "compliance.verify", "registration.view", "registration.manage", "disclosure.review", "audit.view"],
  CA_AUDITOR: ["document.view", "document.download", "compliance.view", "compliance.manage", "compliance.verify", "registration.view"],
  CA: ["document.view", "document.download", "compliance.view", "compliance.manage", "compliance.verify", "registration.view"],
  AUDITOR: ["document.view", "document.download", "compliance.view", "registration.view", "audit.view"],
  LEGAL_REVIEWER: ["meeting.view", "minutes.review", "document.view", "document.download", "disclosure.review", "audit.view"],
  FINANCE_REVIEWER: ["document.view", "document.download", "compliance.view", "registration.view"],
  COMPLIANCE_REVIEWER: ["document.view", "document.download", "compliance.view", "compliance.manage", "compliance.verify", "registration.view"],
  READ_ONLY_ADVISOR: ["document.view", "compliance.view", "registration.view"],
};

export const sensitiveCapabilities = new Set<Capability>([
  "meeting.finalize", "minutes.approve", "resolution.finalize", "document.publish",
  "document.archive", "disclosure.approve", "disclosure.publish", "access.manage", "security.manage",
]);

export function hasCapability(role: CorporateRole, capability: Capability) {
  return grants[role].includes(capability);
}

export function requiresAal2(capability: Capability) {
  return sensitiveCapabilities.has(capability);
}
