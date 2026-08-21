export const corporateRoles = [
  "DIRECTOR", "CORPORATE_ADMIN", "COMPANY_SECRETARY", "CA_AUDITOR", "CA", "AUDITOR",
  "LEGAL_REVIEWER", "FINANCE_REVIEWER", "COMPLIANCE_REVIEWER", "READ_ONLY_ADVISOR", "SYSTEM_ADMIN",
  "CONTENT_EDITOR", "CORPORATE_REVIEWER", "PRODUCT_REVIEWER", "SECURITY_REVIEWER", "PRIVACY_REVIEWER", "PUBLISHER",
] as const;
export type CorporateRole = (typeof corporateRoles)[number];

export const capabilities = [
  "meeting.create", "meeting.view", "meeting.edit", "meeting.finalize", "agenda.manage", "minutes.draft", "minutes.review", "minutes.approve", "minutes.export", "resolution.create", "resolution.vote", "resolution.finalize",
  "document.upload", "document.view", "document.download", "document.publish", "document.archive",
  "compliance.view", "compliance.manage", "compliance.verify", "registration.view", "registration.manage",
  "disclosure.review", "disclosure.approve", "disclosure.publish", "audit.view", "access.manage", "security.manage",
  "automation.view", "automation.manage", "automation.run", "finance.view", "finance.manage", "finance.import", "finance.reconcile",
  "asset.view", "asset.manage", "decision.view", "decision.act", "data.import", "data.export", "integration.view", "integration.manage",
  "calendar.view", "readiness.view", "support.view", "support.manage", "support.trust.view", "support.trust.manage",
  "content.view", "content.create", "content.edit", "content.review", "content.approve", "content.publish", "content.archive", "content.seo.manage", "content.facts.manage",
] as const;
export type Capability = (typeof capabilities)[number];

const corporateAdminCapabilities = capabilities.filter((item) => !["minutes.approve", "resolution.finalize", "disclosure.approve", "disclosure.publish"].includes(item));
const financeCapabilities: readonly Capability[] = ["finance.view", "finance.manage", "finance.import", "finance.reconcile", "document.view", "document.download", "compliance.view", "registration.view", "calendar.view", "decision.view"];
const complianceCapabilities: readonly Capability[] = ["compliance.view", "compliance.manage", "compliance.verify", "document.view", "document.download", "registration.view", "calendar.view", "decision.view"];

const grants: Record<CorporateRole, readonly Capability[]> = {
  DIRECTOR: capabilities,
  SYSTEM_ADMIN: capabilities,
  CORPORATE_ADMIN: corporateAdminCapabilities,
  COMPANY_SECRETARY: ["meeting.create", "meeting.view", "meeting.edit", "agenda.manage", "minutes.draft", "minutes.review", "minutes.export", "resolution.create", "document.upload", "document.view", "document.download", "compliance.view", "compliance.manage", "compliance.verify", "registration.view", "registration.manage", "disclosure.review", "audit.view", "automation.view", "decision.view", "decision.act", "calendar.view", "readiness.view", "support.view", "content.view", "content.review", "content.facts.manage"],
  CA_AUDITOR: financeCapabilities,
  CA: financeCapabilities,
  AUDITOR: ["document.view", "document.download", "compliance.view", "registration.view", "audit.view", "finance.view", "calendar.view", "decision.view"],
  LEGAL_REVIEWER: ["meeting.view", "minutes.review", "document.view", "document.download", "disclosure.review", "audit.view", "decision.view", "calendar.view", "support.trust.view", "support.trust.manage", "content.view", "content.review"],
  FINANCE_REVIEWER: financeCapabilities,
  COMPLIANCE_REVIEWER: complianceCapabilities,
  READ_ONLY_ADVISOR: ["document.view", "compliance.view", "registration.view", "finance.view", "asset.view", "calendar.view", "decision.view"],
  CONTENT_EDITOR: ["content.view", "content.create", "content.edit", "content.seo.manage"],
  CORPORATE_REVIEWER: ["content.view", "content.review"],
  PRODUCT_REVIEWER: ["content.view", "content.review"],
  SECURITY_REVIEWER: ["content.view", "content.review", "support.trust.view", "support.trust.manage"],
  PRIVACY_REVIEWER: ["content.view", "content.review", "support.trust.view", "support.trust.manage"],
  PUBLISHER: ["content.view", "content.review", "content.approve", "content.publish", "content.archive", "content.seo.manage"],
};

export const sensitiveCapabilities = new Set<Capability>([
  "meeting.finalize", "minutes.approve", "resolution.finalize", "document.publish", "document.archive", "disclosure.approve", "disclosure.publish", "access.manage", "security.manage", "integration.manage", "data.export", "content.approve", "content.publish", "content.archive", "content.facts.manage",
]);
export function hasCapability(role: CorporateRole, capability: Capability) { return grants[role].includes(capability); }
/** Content review is domain-specific; generic review capability must not approve unrelated specialist content. */
export function canReviewContentDomain(role: CorporateRole, domain: "CONTENT" | "PRODUCT" | "TECHNOLOGY" | "SECURITY" | "PRIVACY" | "LEGAL" | "CORPORATE" | "DIRECTOR") {
  if (role === "DIRECTOR" || role === "SYSTEM_ADMIN") return true;
  if (role === "CORPORATE_ADMIN") return ["CONTENT", "PRODUCT", "TECHNOLOGY", "CORPORATE"].includes(domain);
  if (role === "COMPANY_SECRETARY" || role === "CORPORATE_REVIEWER") return ["CONTENT", "TECHNOLOGY", "CORPORATE"].includes(domain);
  if (role === "PRODUCT_REVIEWER") return domain === "PRODUCT";
  if (role === "SECURITY_REVIEWER") return domain === "SECURITY";
  if (role === "PRIVACY_REVIEWER") return domain === "PRIVACY";
  if (role === "LEGAL_REVIEWER") return domain === "LEGAL";
  if (role === "PUBLISHER") return domain === "CONTENT";
  return false;
}
export function requiresAal2(capability: Capability) { return sensitiveCapabilities.has(capability); }
