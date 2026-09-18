import type { OfficeRole, WorkspaceKind } from "@/lib/office/workspaces";

export type OfficeNavigationCommand = {
  id: string;
  label: string;
  group: string;
  href: string;
  keywords: string;
};

// Navigation is a least-surprise hint only. Every record read and mutation is
// still authorized by the server-side permission engine in the domain handler.
// Keep this vocabulary synchronized with office_permission_catalog.
const requirements: Record<string, readonly string[]> = {
  "office:decisions": ["governance.risk.read", "governance.risk.manage", "governance.risk.review", "governance.decision.read", "governance.decision.record", "governance.change.read", "governance.change.manage", "governance.change.review"],
  "office:crm": ["sales.crm.read", "sales.crm.write"],
  "office:engineering": ["engineering.infrastructure.read", "engineering.repo.read", "engineering.issue.manage"],
  "office:products": ["product.roadmap.read", "product.roadmap.write", "product.release.request", "product.release.approve"],
  "office:recruitment": ["hiring.requisition.read", "hiring.requisition.manage", "hiring.candidate.manage", "hiring.interview.manage", "hiring.offer.prepare", "hiring.offer.review", "hiring.onboarding.manage"],
  "office:people": ["people.basic.read", "people.sensitive.read", "people.update", "hiring.candidate.read", "hiring.request.review"],
  "office:development": ["people.skills.read", "people.skills.declare", "people.skills.verify", "people.training.read", "people.training.manage", "people.training.assign", "people.performance.read", "people.performance.manage", "people.performance.review", "people.workforce_plan.read", "people.workforce_plan.manage", "people.workforce_plan.review"],
  "office:travel": ["travel.read", "travel.request", "travel.manager_review", "travel.finance_review", "travel.book", "travel.claim.submit", "travel.claim.review"],
  "office:payroll": ["payroll.compensation.read", "payroll.compensation.manage", "payroll.rules.read", "payroll.run.read", "payroll.run.prepare"],
  "office:documents": ["document.template.read", "document.template.manage", "document.template.publish", "document.instance.read", "document.instance.review", "document.render", "document.hr.create", "document.secretarial.create", "document.legal.create", "document.sales.create", "document.operations.create"],
  "office:contracts": ["legal.contract.review", "legal.contract.draft", "legal.contract.execute", "legal.obligation.read", "legal.obligation.manage", "legal.obligation.review"],
  "office:vendors": ["operations.vendor.create", "operations.vendor.approve", "operations.purchase.request", "operations.purchase.approve", "operations.procurement.read", "operations.procurement.prepare", "operations.po.issue", "operations.receipt.record", "operations.renewal.manage"],
  "office:assets": ["operations.asset.assign"],
  "office:devices": ["identity.card.read", "identity.card.manage", "device.posture.read", "device.posture.manage", "physical.access.read", "physical.access.manage"],
  "office:it": ["it.service.request", "it.service.read", "it.service.manage", "it.license.read", "it.license.manage"],
  "office:facilities": ["facilities.room.read", "facilities.room.book", "visitor.invite", "visitor.manage", "facilities.issue.report", "facilities.manage"],
  "office:support": ["support.case.read", "support.case.manage", "customer.refund.request", "customer.refund.approve"],
  "office:access": ["access.profile.assign", "access.permission.override", "access.audit.read", "access.user.invite", "access.device.approve"],
  "office:data": ["data.export.request", "data.import.request", "data.movement.approve"],
  "office:privacy": ["privacy.case.read", "privacy.case.manage", "privacy.retention.read"],
  "office:resilience": ["resilience.read", "resilience.plan.manage", "resilience.plan.review", "resilience.test.manage", "resilience.test.review", "resilience.incident.report", "resilience.incident.read", "resilience.incident.manage", "insurance.read", "insurance.manage", "insurance.review"],
  "office:security": ["security.overview.read", "security.change.review"],
  "office:integrations": ["integration.embed.view", "integration.embed.manage"],
  "office:governance": ["secretarial.board.read", "secretarial.board.manage", "secretarial.corporate.prepare", "secretarial.corporate.approve"],
  "office:compliance": ["compliance.rules.read", "compliance.rules.manage", "compliance.facts.manage", "compliance.applicability.review", "compliance.instance.manage"],
  "office:audit": ["audit.read", "access.audit.read"],
  "finance:dashboard": ["finance.read"],
  "finance:billing": ["finance.read", "finance.invoice.create"],
  "finance:payroll": ["payroll.run.read", "payroll.run.review", "payroll.payment.prepare", "payroll.rules.read", "payroll.compensation.read"],
  "finance:gst": ["finance.read", "tax.gst.prepare", "tax.gst.approve"],
  "finance:accounting": ["finance.read", "finance.journal.post"],
  "finance:banking": ["finance.read", "finance.bank.read"],
  "finance:payments": ["finance.payment.prepare", "finance.payment.approve"],
  "finance:expenses": ["finance.read", "finance.expense.request", "finance.expense.approve"],
  "finance:reconciliation": ["finance.read", "finance.journal.post", "finance.bank.read"],
  "finance:documents": ["finance.read", "document.template.read", "document.instance.read", "document.instance.review", "document.render", "document.finance.create"],
  "finance:compliance": ["finance.read", "tax.gst.prepare", "tax.gst.approve", "compliance.rules.read", "compliance.applicability.review", "compliance.instance.manage"],
  "finance:insurance": ["insurance.read", "insurance.manage", "insurance.review"],
  "finance:audit": ["finance.read", "audit.read"],
};

const directorReservedSections = new Set(["intelligence", "governance", "readiness"]);

export function requiredCapabilities(workspace: WorkspaceKind, section: string) {
  return requirements[`${workspace}:${section}`] ?? [];
}

export function capabilityCanAccessSection(
  workspace: WorkspaceKind,
  section: string,
  roles: readonly OfficeRole[],
  permissions: readonly string[],
) {
  if (roles.includes("OWNER")) return true;
  if (workspace === "office" && roles.includes("DIRECTOR") && directorReservedSections.has(section)) return true;
  const required = requiredCapabilities(workspace, section);
  if (!required.length) return true;
  const granted = new Set(permissions);
  return required.some((permission) => granted.has(permission));
}

export function navigationCommands(
  workspace: WorkspaceKind,
  entries: Array<[string, { title: string; group: string; description: string }]>,
): OfficeNavigationCommand[] {
  const base = workspace === "finance" ? "/finance" : "/office";
  return entries.map(([slug, section]) => ({
    id: `${workspace}:${slug}`,
    label: section.title,
    group: section.group,
    href: `${base}/${slug}`,
    keywords: `${section.title} ${section.group} ${section.description}`.toLowerCase(),
  }));
}
