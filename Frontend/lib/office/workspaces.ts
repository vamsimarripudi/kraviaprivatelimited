export const officeRoles = [
  "OWNER",
  "DIRECTOR",
  "ADMIN",
  "MEMBER",
  "FINANCE",
  "CA",
  "CS",
  "LEGAL",
  "HR",
  "OPERATIONS",
  "AUDITOR",
  "PRODUCT_ADMIN",
] as const;

export type OfficeRole = (typeof officeRoles)[number];
export type WorkspaceKind = "office" | "finance";
export type WorkspaceSection = {
  title: string;
  eyebrow: string;
  description: string;
  roles: readonly OfficeRole[];
  group: string;
};

const executive: readonly OfficeRole[] = ["OWNER", "DIRECTOR"];
const officeWorkspaceRoles: readonly OfficeRole[] = ["OWNER", "DIRECTOR", "ADMIN", "MEMBER", "CS", "LEGAL", "HR", "OPERATIONS", "PRODUCT_ADMIN"];
const officeDocumentRoles: readonly OfficeRole[] = ["OWNER", "DIRECTOR", "CS", "LEGAL", "HR", "OPERATIONS", "PRODUCT_ADMIN"];
const governance: readonly OfficeRole[] = ["OWNER", "DIRECTOR", "CS", "LEGAL"];
const compliance: readonly OfficeRole[] = ["OWNER", "DIRECTOR", "CS", "LEGAL", "CA", "AUDITOR"];
const financeCore: readonly OfficeRole[] = ["OWNER", "DIRECTOR", "FINANCE", "CA", "AUDITOR"];
const financeWrite: readonly OfficeRole[] = ["OWNER", "DIRECTOR", "FINANCE", "CA"];
const accessAdministration: readonly OfficeRole[] = ["OWNER", "ADMIN"];
const everyAdmittedRole: readonly OfficeRole[] = officeRoles;

export const officeSections = {
  dashboard: {
    title: "My work",
    eyebrow: "KRAVIA OFFICE",
    description: "Your role-scoped company workspace, pending work, approvals, requests and governed operational modules.",
    roles: everyAdmittedRole,
    group: "My Work",
  },
  notifications: {
    title: "Notifications",
    eyebrow: "ATTENTION CENTER",
    description: "Personal workflow, task and security signals with explicit read and dismissal state.",
    roles: everyAdmittedRole,
    group: "My Work",
  },
  tasks: {
    title: "Company inbox",
    eyebrow: "ACTIONABLE WORK",
    description: "Assigned tasks, blockers and execution work kept separate from approvals and authority decisions.",
    roles: everyAdmittedRole,
    group: "My Work",
  },
  calendar: {
    title: "Company calendar",
    eyebrow: "OPERATIONAL TIMELINE",
    description: "Scoped internal events plus authorised projections of real tasks, compliance deadlines, board meetings, contracts and subscription dates.",
    roles: everyAdmittedRole,
    group: "My Work",
  },
  requests: {
    title: "Requests",
    eyebrow: "WORKFLOW CENTER",
    description: "Create and track governed requests for people, access, engineering, finance, legal, operations, product and customer work.",
    roles: everyAdmittedRole,
    group: "My Work",
  },
  approvals: {
    title: "Approvals",
    eyebrow: "DECISION QUEUE",
    description: "Requests currently assigned to you for review. Approval authority is evaluated independently from job title.",
    roles: everyAdmittedRole,
    group: "My Work",
  },
  manager: {
    title: "Manager workspace",
    eyebrow: "TEAM OPERATIONS",
    description: "Reporting-line work, team requests and delegated approvals. Users without a team assignment receive no manager authority.",
    roles: everyAdmittedRole,
    group: "Lead",
  },
  decisions: {
    title: "Executive decisions",
    eyebrow: "EXECUTIVE ACTION",
    description: "Controlled reviews, reserved approvals and decision queues assigned to executive authority.",
    roles: executive,
    group: "Lead",
  },
  products: {
    title: "Products",
    eyebrow: "PRODUCT OPERATIONS",
    description: "KRAVIA products, operating owners and controlled lifecycle records.",
    roles: ["OWNER", "DIRECTOR", "OPERATIONS", "PRODUCT_ADMIN"],
    group: "Operate",
  },
  customers: {
    title: "Customers",
    eyebrow: "COMMERCIAL OPERATIONS",
    description: "Canonical customer identities and commercial context without exposing financial controls to unrelated roles.",
    roles: ["OWNER", "DIRECTOR", "OPERATIONS", "PRODUCT_ADMIN"],
    group: "Operate",
  },
  governance: {
    title: "Governance",
    eyebrow: "BOARD & CORPORATE",
    description: "Meetings, resolutions, authorities, CTC records and corporate governance evidence.",
    roles: governance,
    group: "Govern",
  },
  compliance: {
    title: "Compliance",
    eyebrow: "REVIEW-LED CONTROL",
    description: "Evidence-backed obligations and professional review. The system never assumes statutory compliance.",
    roles: compliance,
    group: "Govern",
  },
  registrations: {
    title: "Registrations",
    eyebrow: "COMPANY REGISTRY",
    description: "Company registrations, renewals, masked identifiers and supporting evidence.",
    roles: compliance,
    group: "Govern",
  },
  documents: {
    title: "Document vault",
    eyebrow: "PRIVATE EVIDENCE",
    description: "Versioned, hashed and access-controlled corporate records.",
    roles: officeDocumentRoles,
    group: "Records",
  },
  contracts: {
    title: "Contracts",
    eyebrow: "CONTROLLED AGREEMENTS",
    description: "Agreements, counterparties, dates, ownership and signed evidence.",
    roles: ["OWNER", "DIRECTOR", "LEGAL", "OPERATIONS"],
    group: "Records",
  },
  vendors: {
    title: "Vendors",
    eyebrow: "PROCUREMENT",
    description: "Vendor master data and procurement records with controlled evidence.",
    roles: ["OWNER", "DIRECTOR", "OPERATIONS"],
    group: "Records",
  },
  people: {
    title: "People",
    eyebrow: "HR & PEOPLE",
    description: "Internal people records available only to explicitly assigned HR/executive roles.",
    roles: ["OWNER", "DIRECTOR", "HR"],
    group: "Office",
  },
  assets: {
    title: "Assets",
    eyebrow: "COMPANY ASSETS",
    description: "Corporate assets, subscriptions, renewals and assigned ownership.",
    roles: ["OWNER", "DIRECTOR", "OPERATIONS"],
    group: "Office",
  },
  support: {
    title: "Support operations",
    eyebrow: "CUSTOMER OPERATIONS",
    description: "Controlled customer cases, ownership and status transitions.",
    roles: ["OWNER", "DIRECTOR", "OPERATIONS", "PRODUCT_ADMIN"],
    group: "Office",
  },
  access: {
    title: "Access administration",
    eyebrow: "IDENTITY & AUTHORIZATION",
    description: "Owner-controlled administrator appointment, invite-only onboarding, workforce access, devices, reviews and auditable privilege changes.",
    roles: accessAdministration,
    group: "Assure",
  },
  data: {
    title: "Data movement",
    eyebrow: "CONTROLLED IMPORT / EXPORT",
    description: "Staged data movement with validation and approval before canonical records change.",
    roles: ["OWNER", "DIRECTOR", "OPERATIONS", "PRODUCT_ADMIN"],
    group: "Assure",
  },
  privacy: {
    title: "Privacy governance",
    eyebrow: "DATA GOVERNANCE",
    description: "Retention, privacy requests, legal holds and governed data handling.",
    roles: ["OWNER", "DIRECTOR", "LEGAL"],
    group: "Assure",
  },
  security: {
    title: "Security",
    eyebrow: "RESTRICTED ADMINISTRATION",
    description: "Security-control administration reserved for executive authority; access administrators do not inherit security authority automatically.",
    roles: executive,
    group: "Assure",
  },
  integrations: {
    title: "Integrations",
    eyebrow: "CONTROLLED PROVIDERS",
    description: "Provider health, approved embeds and secret references without exposing credentials.",
    roles: ["OWNER", "DIRECTOR", "OPERATIONS", "PRODUCT_ADMIN"],
    group: "Assure",
  },
  readiness: {
    title: "Readiness",
    eyebrow: "PRODUCTION CONTROL",
    description: "Verified configuration and evidence only; never a fabricated compliance score.",
    roles: executive,
    group: "Assure",
  },
  audit: {
    title: "Audit trail",
    eyebrow: "APPEND-ORIENTED EVIDENCE",
    description: "Material business actions, workflow decisions and access events available to authorised reviewers.",
    roles: ["OWNER", "DIRECTOR", "CS", "LEGAL", "AUDITOR"],
    group: "Assure",
  },
  settings: {
    title: "Office settings",
    eyebrow: "IDENTITY & CONTROL",
    description: "Workspace identity, MFA posture and controlled Office configuration.",
    roles: ["OWNER", "DIRECTOR", "ADMIN", "MEMBER"],
    group: "Assure",
  },
} as const satisfies Record<string, WorkspaceSection>;

export const financeSections = {
  dashboard: { title: "Finance overview", eyebrow: "KRAVIA FINANCE", description: "Finance, GST, accounting and reconciliation work for authorised finance professionals.", roles: financeCore, group: "Overview" },
  billing: { title: "Billing", eyebrow: "INVOICING", description: "Issued invoices, customer balances, receipts and controlled commercial evidence.", roles: financeCore, group: "Revenue" },
  gst: { title: "GST & tax", eyebrow: "TAX WORKSPACE", description: "GST registration context, tax periods, working summaries and filing evidence.", roles: financeCore, group: "Tax" },
  accounting: { title: "Accounting", eyebrow: "BOOKS & JOURNALS", description: "Double-entry journals, trial balance and controlled period-close operations.", roles: financeCore, group: "Books" },
  banking: { title: "Banking", eyebrow: "BANK & CASH", description: "Bank references, imported transactions and controlled matching.", roles: financeCore, group: "Treasury" },
  payments: { title: "Payments", eyebrow: "TREASURY EXECUTION", description: "Payment instructions, provider events and maker-checker controlled execution.", roles: financeWrite, group: "Treasury" },
  expenses: { title: "Expenses", eyebrow: "COMPANY SPEND", description: "Company expense obligations, allocation evidence and contribution calls without changing legal ownership.", roles: financeWrite, group: "Treasury" },
  reconciliation: { title: "Reconciliation", eyebrow: "CONTROL & MATCHING", description: "Provider, bank and ledger reconciliation with explicit exception queues.", roles: financeCore, group: "Books" },
  ownership: { title: "Ownership & funding", eyebrow: "EQUITY CONTROL", description: "Append-only ownership evidence and shareholder/director funding kept strictly separate from expenses and revenue.", roles: ["OWNER", "DIRECTOR", "FINANCE"], group: "Corporate Finance" },
  documents: { title: "Finance documents", eyebrow: "FINANCIAL EVIDENCE", description: "Role-scoped finance and tax evidence from the controlled document vault.", roles: financeCore, group: "Evidence" },
  compliance: { title: "Financial compliance", eyebrow: "PROFESSIONAL REVIEW", description: "Tax and finance obligations that require evidence and professional review.", roles: financeCore, group: "Evidence" },
  audit: { title: "Financial audit", eyebrow: "ASSURANCE", description: "Finance audit records, inspection evidence and traceable source references.", roles: financeCore, group: "Evidence" },
} as const satisfies Record<string, WorkspaceSection>;

export type OfficeSection = keyof typeof officeSections;
export type FinanceSection = keyof typeof financeSections;

export const workspaceDefinitions = {
  office: { label: "KRAVIA OFFICE", basePath: "/office", loginPath: "/office/login", sections: officeSections, workspaceRoles: officeWorkspaceRoles },
  finance: { label: "KRAVIA FINANCE", basePath: "/finance", loginPath: "/finance/login", sections: financeSections, workspaceRoles: financeCore },
} as const;

export function isOfficeRole(value: unknown): value is OfficeRole {
  return typeof value === "string" && (officeRoles as readonly string[]).includes(value);
}

export function roleCanAccessSection(section: WorkspaceSection, roles: readonly OfficeRole[]) {
  return roles.some((role) => section.roles.includes(role));
}

export function roleCanAccessWorkspace(workspace: WorkspaceKind, roles: readonly OfficeRole[]) {
  const allowed = workspaceDefinitions[workspace].workspaceRoles as readonly OfficeRole[];
  return roles.some((role) => allowed.includes(role));
}

export function preferredWorkspace(roles: readonly OfficeRole[]): WorkspaceKind | null {
  if (roles.length === 1 && roles[0] === "ADMIN") return "office";
  if (roles.some((role) => ["FINANCE", "CA", "AUDITOR"].includes(role))) return "finance";
  if (roles.some((role) => ["OWNER", "DIRECTOR", "ADMIN", "MEMBER", "CS", "LEGAL", "HR", "OPERATIONS", "PRODUCT_ADMIN"].includes(role))) return "office";
  return null;
}

export function preferredLandingPath(roles: readonly OfficeRole[]) {
  if (roles.length === 1 && roles[0] === "ADMIN") return "/office/access";
  const workspace = preferredWorkspace(roles);
  return workspace === "finance" ? "/finance/dashboard" : workspace === "office" ? "/office/dashboard" : "/office/login";
}
