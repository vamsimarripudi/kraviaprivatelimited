import type { OfficeRole, WorkspaceKind } from "@/lib/office/workspaces";

export type OfficeNavigationCommand = {
  id: string;
  label: string;
  group: string;
  href: string;
  keywords: string;
};

const requirements: Record<string, readonly string[]> = {
  "office:crm": ["sales.crm.read", "sales.crm.write"],
  "office:engineering": ["engineering.infrastructure.read", "engineering.repo.read", "engineering.issue.manage"],
  "office:products": ["product.roadmap.read", "product.roadmap.write"],
  "office:people": ["people.basic.read", "people.employment.admin"],
  "office:contracts": ["legal.contract.review", "legal.contract.draft", "legal.contract.execute"],
  "office:vendors": ["operations.procurement.prepare", "operations.procurement.approve"],
  "office:assets": ["operations.assets.admin"],
  "office:support": ["support.case.read", "support.case.update", "support.portal.read", "support.trust_request.manage"],
  "office:access": ["access.profile.manage", "access.profile.assign", "access.override.manage", "access.audit.read"],
  "office:data": ["data.export.request", "data.import.manage"],
  "office:integrations": ["integration.embed.view", "integration.embed.manage"],
  "office:governance": ["secretarial.records.read", "secretarial.board.manage", "secretarial.resolution.prepare", "secretarial.resolution.record"],
  "office:audit": ["access.audit.read"],
  "office:security": ["security.change.review", "security.secret.reference.read", "security.session.revoke"],
  "finance:dashboard": ["finance.read"],
  "finance:billing": ["finance.read"],
  "finance:gst": ["finance.read"],
  "finance:accounting": ["finance.read"],
  "finance:banking": ["finance.read"],
  "finance:payments": ["finance.payments.prepare", "finance.payments.approve"],
  "finance:expenses": ["finance.read", "finance.master.write"],
  "finance:reconciliation": ["finance.reconciliation.manage", "finance.read"],
  "finance:documents": ["finance.read"],
  "finance:compliance": ["finance.read"],
  "finance:audit": ["finance.read", "finance.reports.export"],
};

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
