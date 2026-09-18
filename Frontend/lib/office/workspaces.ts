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
  dashboard: { title: "My work", eyebrow: "KRAVIA OFFICE", description: "Your role-scoped company workspace, pending work, approvals, requests and governed operational modules.", roles: everyAdmittedRole, group: "My Work" },
  notifications: { title: "Notifications", eyebrow: "ATTENTION CENTER", description: "Personal workflow, task and security signals with explicit read and dismissal state.", roles: everyAdmittedRole, group: "My Work" },
  tasks: { title: "Company inbox", eyebrow: "ACTIONABLE WORK", description: "Assigned tasks, blockers and execution work kept separate from approvals and authority decisions.", roles: everyAdmittedRole, group: "My Work" },
  calendar: { title: "Company calendar", eyebrow: "OPERATIONAL TIMELINE", description: "Scoped internal events plus authorised projections of real tasks, compliance deadlines, board meetings, contracts and subscription dates.", roles: everyAdmittedRole, group: "My Work" },
  requests: { title: "Requests", eyebrow: "WORKFLOW CENTER", description: "Create and track governed requests for people, access, engineering, finance, legal, operations, product and customer work.", roles: everyAdmittedRole, group: "My Work" },
  approvals: { title: "Approvals", eyebrow: "DECISION QUEUE", description: "Requests currently assigned to you for review. Approval authority is evaluated independently from job title.", roles: everyAdmittedRole, group: "My Work" },
  manager: { title: "Manager workspace", eyebrow: "TEAM OPERATIONS", description: "Reporting-line work, team requests and delegated approvals. Users without a team assignment receive no manager authority.", roles: everyAdmittedRole, group: "Lead" },
  decisions: { title: "Risk, decisions & change", eyebrow: "ENTERPRISE CONTROL", description: "Scoped risk treatment, decision evidence and controlled organisational change with independent review and immutable history.", roles: officeWorkspaceRoles, group: "Lead" },
  strategy: { title: "Strategy & OKRs", eyebrow: "OBJECTIVES · OUTCOMES", description: "Governed strategy cycles, aligned objectives and human-reported key results with evidence-backed achievement and no passive activity scoring.", roles: officeWorkspaceRoles, group: "Lead" },
  intelligence: { title: "KRAVIA Intelligence", eyebrow: "EXECUTIVE BRIEF", description: "Read-only executive intelligence assembled from canonical company records. It surfaces exceptions and attention items without executing company actions.", roles: executive, group: "Lead" },
  products: { title: "Products", eyebrow: "PRODUCT OPERATIONS", description: "Canonical KRAVIA product identities and controlled creation. Visibility follows the capability engine, not a broad role title.", roles: officeWorkspaceRoles, group: "Operate" },
  portfolio: { title: "Projects & portfolio", eyebrow: "PROJECT EXECUTION", description: "Governed projects, workstreams, milestones, dependencies and team metadata with human-reported health and evidence-backed completion.", roles: officeWorkspaceRoles, group: "Operate" },
  customers: { title: "Customers", eyebrow: "COMMERCIAL OPERATIONS", description: "Canonical customer identities and commercial context without exposing financial controls to unrelated roles.", roles: officeWorkspaceRoles, group: "Operate" },
  crm: { title: "Sales CRM", eyebrow: "REVENUE PIPELINE", description: "Permission-scoped leads, opportunities and commercial activity linked to canonical customers and products without bypassing contracting or billing controls.", roles: ["OWNER", "DIRECTOR", "MEMBER", "OPERATIONS", "PRODUCT_ADMIN"], group: "Operate" },
  engineering: { title: "Engineering", eyebrow: "ENGINEERING CONTROL", description: "Permission-scoped services, deployments and incidents. Provider references are visible only inside assigned project or repository authority, and production execution remains governed.", roles: ["OWNER", "DIRECTOR", "MEMBER", "OPERATIONS"], group: "Operate" },
  governance: { title: "Governance", eyebrow: "BOARD & CORPORATE", description: "Meetings, agendas, minutes, resolutions, actions and controlled company-secretarial follow-up.", roles: governance, group: "Govern" },
  compliance: { title: "Compliance", eyebrow: "REVIEW-LED CONTROL", description: "Evidence-backed applicability, obligations and professional review. The system never assumes statutory compliance.", roles: compliance, group: "Govern" },
  registrations: { title: "Registrations", eyebrow: "COMPANY REGISTRY", description: "Company registrations, renewals, masked identifiers and supporting evidence.", roles: compliance, group: "Govern" },
  knowledge: { title: "Policy & knowledge", eyebrow: "POLICY · ANNOUNCEMENTS · SOPs", description: "Audience-scoped company policies, acknowledgements, announcements, SOPs, runbooks and internal knowledge with immutable published versions.", roles: officeWorkspaceRoles, group: "Records" },
  documents: { title: "Document vault", eyebrow: "PRIVATE EVIDENCE", description: "Versioned, hashed and access-controlled corporate records.", roles: officeDocumentRoles, group: "Records" },
  contracts: { title: "Contracts", eyebrow: "CONTROLLED AGREEMENTS", description: "Agreements, counterparties, dates, ownership and signed evidence.", roles: ["OWNER", "DIRECTOR", "LEGAL", "OPERATIONS"], group: "Records" },
  vendors: { title: "Procurement & vendors", eyebrow: "PROCUREMENT", description: "Sourcing, quote comparison, approval, purchase-order, receipt and vendor-renewal work without bypassing payment controls.", roles: ["OWNER", "DIRECTOR", "OPERATIONS"], group: "Records" },
  recruitment: { title: "Recruitment", eyebrow: "HIRING & PRE-ONBOARDING", description: "Governed headcount, candidates, interviews, offer approvals and pre-onboarding evidence.", roles: ["OWNER", "DIRECTOR", "HR"], group: "Office" },
  people: { title: "People", eyebrow: "HR & PEOPLE", description: "Internal people records available only to explicitly assigned HR/executive roles.", roles: ["OWNER", "DIRECTOR", "HR"], group: "Office" },
  emergency: { title: "Emergency contacts", eyebrow: "PRIVATE SAFETY RECORD", description: "Employees maintain their own emergency contacts; explicit HR/safety authority can reveal details with an audited access event.", roles: officeWorkspaceRoles, group: "Office" },
  development: { title: "People development", eyebrow: "SKILLS · TRAINING · PERFORMANCE", description: "Self-service skills and training plus scoped manager/HR performance and workforce planning. Passive activity is never converted into an automatic performance score.", roles: officeWorkspaceRoles, group: "Office" },
  travel: { title: "Travel & expenses", eyebrow: "BUSINESS TRAVEL", description: "Business travel requests, maker-checker approvals, booking evidence and receipt-backed reimbursement claims without hidden bank execution.", roles: officeWorkspaceRoles, group: "Office" },
  cards: { title: "Corporate cards", eyebrow: "MASKED CARD CONTROL", description: "Assigned corporate-card metadata and spend requests with no PAN/CVV/PIN storage and no issuer-side execution from KRAVIA.", roles: officeWorkspaceRoles, group: "Office" },
  payroll: { title: "Payroll OS", eyebrow: "COMPENSATION & PAYROLL", description: "Effective-dated compensation, reviewed attendance snapshots, payroll calculations, approvals and salary-batch preparation without automatic bank execution.", roles: ["OWNER", "DIRECTOR", "HR"], group: "Office" },
  budget: { title: "Budgets", eyebrow: "BUDGET · COMMITMENTS", description: "Approved company and department budgets, commitments and available capacity. This workspace never executes payment.", roles: officeWorkspaceRoles, group: "Office" },
  assets: { title: "Assets", eyebrow: "COMPANY ASSETS", description: "Corporate assets, subscriptions, renewals and assigned ownership.", roles: ["OWNER", "DIRECTOR", "OPERATIONS"], group: "Office" },
  devices: { title: "Identity & devices", eyebrow: "DIGITAL ID · DEVICE TRUST", description: "Digital employee identity, company-device posture and controlled physical-access credentials, including future NFC cards and office zones.", roles: officeWorkspaceRoles, group: "Office" },
  it: { title: "IT service desk", eyebrow: "IT · SOFTWARE · ACCESS", description: "Employee technology requests, device support and governed software-licence assignments without granting unrelated system authority.", roles: officeWorkspaceRoles, group: "Office" },
  facilities: { title: "Physical office", eyebrow: "ROOMS · VISITORS · FACILITIES", description: "Room booking, visitor approvals, temporary credentials and facility incidents governed by the same company identity and access model.", roles: officeWorkspaceRoles, group: "Office" },
  support: { title: "Support operations", eyebrow: "CUSTOMER OPERATIONS", description: "Controlled customer cases, ownership, status transitions and approval-led remedies.", roles: officeWorkspaceRoles, group: "Office" },
  access: { title: "Access administration", eyebrow: "IDENTITY & AUTHORIZATION", description: "Owner-controlled administrator appointment, invite-only onboarding, workforce access, devices, reviews and auditable privilege changes.", roles: accessAdministration, group: "Assure" },
  data: { title: "Data movement", eyebrow: "CONTROLLED IMPORT / EXPORT", description: "Scoped data-movement requests with independent approval before any execution or canonical record change.", roles: officeWorkspaceRoles, group: "Assure" },
  privacy: { title: "Privacy governance", eyebrow: "DATA GOVERNANCE", description: "Privacy cases, reviewed retention evidence, legal holds and governed data handling without automatic legal conclusions.", roles: officeWorkspaceRoles, group: "Assure" },
  ethics: { title: "Ethics channel", eyebrow: "CONFIDENTIAL REPORTING", description: "Confidential ethics and whistleblowing reports separated from normal manager/HR visibility, with explicit investigator authority and independent closure review.", roles: officeWorkspaceRoles, group: "Assure" },
  resilience: { title: "Resilience & continuity", eyebrow: "BCP · DR · EMERGENCY · INSURANCE", description: "Business continuity, disaster recovery tests, emergency incidents and insurance evidence with independent review and no fabricated recovery or payment claims.", roles: officeWorkspaceRoles, group: "Assure" },
  ai: { title: "AI governance", eyebrow: "APPROVED AI USE", description: "Approved AI providers, data-classification boundaries, scoped use cases, expiry, human review and usage metadata without storing raw prompts or outputs.", roles: officeWorkspaceRoles, group: "Assure" },
  quality: { title: "Quality & CAPA", eyebrow: "PROCESS QUALITY", description: "Controlled process revisions, self-service nonconformance reporting, containment, corrective/preventive actions and independent effectiveness review.", roles: officeWorkspaceRoles, group: "Assure" },
  trust: { title: "Trust Center", eyebrow: "VENDOR ASSURANCE · CUSTOMER TRUST", description: "Vendor security/privacy/legal due diligence and customer security/compliance evidence requests with independent review and evidence-based delivery.", roles: officeWorkspaceRoles, group: "Assure" },
  security: { title: "Security", eyebrow: "SECURITY OBSERVABILITY", description: "Authentication, device, access and incident evidence requires explicit security capability; access administrators do not inherit security authority automatically.", roles: ["OWNER", "DIRECTOR", "MEMBER", "OPERATIONS"], group: "Assure" },
  integrations: { title: "Integrations", eyebrow: "CONTROLLED PROVIDERS", description: "Provider health, approved embeds and secret references without exposing credentials.", roles: ["OWNER", "DIRECTOR", "OPERATIONS", "PRODUCT_ADMIN"], group: "Assure" },
  domains: { title: "Domains & certificates", eyebrow: "DOMAIN · DNS · TLS", description: "Corporate domains, renewal ownership, hashed DNS change control and TLS certificate lifecycle without storing provider secrets or private keys.", roles: officeWorkspaceRoles, group: "Assure" },
  custody: { title: "Secure custody", eyebrow: "ORIGINALS · DSC · RESTRICTED MEDIA", description: "Physical-original and restricted-token custody, checkout, return evidence and independent verification without storing PINs, private keys or token secrets.", roles: officeWorkspaceRoles, group: "Assure" },
  readiness: { title: "Readiness", eyebrow: "PRODUCTION CONTROL", description: "Verified configuration and evidence only; never a fabricated compliance score.", roles: executive, group: "Assure" },
  audit: { title: "Audit trail", eyebrow: "APPEND-ORIENTED EVIDENCE", description: "Material business actions, workflow decisions and access events available to authorised reviewers.", roles: ["OWNER", "DIRECTOR", "CS", "LEGAL", "AUDITOR"], group: "Assure" },
  settings: { title: "Office settings", eyebrow: "IDENTITY & CONTROL", description: "Workspace identity, MFA posture and controlled Office configuration.", roles: ["OWNER", "DIRECTOR", "ADMIN", "MEMBER"], group: "Assure" },
} as const satisfies Record<string, WorkspaceSection>;

export const financeSections = {
  dashboard: { title: "Finance overview", eyebrow: "KRAVIA FINANCE", description: "Finance, GST, accounting and reconciliation work for authorised finance professionals.", roles: financeCore, group: "Overview" },
  customers: { title: "Customer master", eyebrow: "CANONICAL BILLING IDENTITY", description: "Canonical customer identities used by invoices, receipts, tax and reconciliation. Customer creation remains backend-authorised.", roles: financeCore, group: "Revenue" },
  billing: { title: "Billing", eyebrow: "INVOICING", description: "Issued invoices, customer balances, receipts and controlled commercial evidence.", roles: financeCore, group: "Revenue" },
  payroll: { title: "Payroll", eyebrow: "PAYROLL REVIEW & TREASURY", description: "Review payroll calculations, evidence and salary-batch preparation without treating batch creation as bank execution.", roles: financeCore, group: "Treasury" },
  budget: { title: "Budgets", eyebrow: "BUDGET · COMMITMENTS", description: "Budget cycles, allocations, independently reviewed adjustments, commitments and immutable actual-spend references.", roles: financeCore, group: "Treasury" },
  gst: { title: "GST & tax", eyebrow: "TAX WORKSPACE", description: "Invoice-derived output GST working registers, period review and filing-evidence boundaries without inventing input credit, payable tax or portal status.", roles: financeCore, group: "Tax" },
  accounting: { title: "Accounting", eyebrow: "BOOKS & JOURNALS", description: "Double-entry trial balance plus enforced accounting/tax period locks with maker-checker reopening and auditable close-control evidence.", roles: financeCore, group: "Books" },
  banking: { title: "Banking", eyebrow: "BANK & CASH", description: "Masked bank references and externally sourced transaction evidence with explicit provenance and no bank-side payment execution.", roles: financeCore, group: "Treasury" },
  payments: { title: "Payments", eyebrow: "TREASURY EXECUTION", description: "Payout instructions staged separately from independent approval and explicit provider execution, with disabled/sandbox/live readiness visible before action.", roles: financeWrite, group: "Treasury" },
  expenses: { title: "Expenses", eyebrow: "COMPANY SPEND", description: "Company expense obligations, allocation evidence and contribution calls without changing legal ownership.", roles: financeWrite, group: "Treasury" },
  reconciliation: { title: "Reconciliation", eyebrow: "CONTROL & MATCHING", description: "Deterministic credit-to-payment matching plus explicit unmatched and review-required queues; ambiguous records remain human-reviewed.", roles: financeCore, group: "Books" },
  ownership: { title: "Ownership & funding", eyebrow: "EQUITY CONTROL", description: "Append-only ownership evidence and shareholder/director funding kept strictly separate from expenses and revenue.", roles: ["OWNER", "DIRECTOR", "FINANCE"], group: "Corporate Finance" },
  documents: { title: "Finance documents", eyebrow: "FINANCIAL EVIDENCE", description: "Role-scoped finance and tax evidence from the controlled document vault.", roles: financeCore, group: "Evidence" },
  compliance: { title: "Financial compliance", eyebrow: "PROFESSIONAL REVIEW", description: "Tax and finance obligations that require evidence and professional review.", roles: financeCore, group: "Evidence" },
  cards: { title: "Corporate cards", eyebrow: "SPEND CONTROL", description: "Masked company-card registry, limits, category policy, employee spend requests and issuer/receipt evidence without storing card secrets.", roles: financeCore, group: "Payables" },
  insurance: { title: "Insurance", eyebrow: "RISK TRANSFER", description: "Company insurance policies and claims with independent review, insurer references and payment evidence.", roles: financeCore, group: "Evidence" },
  ethics: { title: "Ethics channel", eyebrow: "CONFIDENTIAL REPORTING", description: "Confidential ethics reporting remains separated from ordinary finance, HR and management visibility. Explicit ethics profiles are required for investigation work.", roles: financeCore, group: "Evidence" },
  emergency: { title: "Emergency contacts", eyebrow: "PRIVATE SAFETY RECORD", description: "Private self-service emergency contacts with non-bypass HR/safety access and audited privileged reveal.", roles: financeCore, group: "Evidence" },
  ai: { title: "AI governance", eyebrow: "APPROVED AI USE", description: "Approved AI tools and scoped finance use cases with explicit data boundaries, expiry and human-review requirements.", roles: financeCore, group: "Evidence" },
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
