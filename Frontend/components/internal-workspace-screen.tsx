import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowRight, Bell, BriefcaseBusiness, Building2, ClipboardCheck, FileLock2, Files, Gauge, Landmark, LayoutDashboard, Scale, Settings, ShieldCheck, TriangleAlert, Users } from "lucide-react";
import type { OfficeIdentity } from "@/lib/office/auth-server";
import { getOfficeCapabilitySnapshot } from "@/lib/office/capability-server";
import {
  capabilityCanAccessSection,
  navigationCommands,
} from "@/lib/office/workspace-capabilities";
import {
  financeSections,
  officeSections,
  roleCanAccessSection,
  roleCanAccessWorkspace,
  workspaceDefinitions,
  type FinanceSection,
  type OfficeSection,
  type WorkspaceKind,
  type WorkspaceSection,
} from "@/lib/office/workspaces";
import { runtimeModuleSpec } from "@/lib/office/runtime-modules";
import { WorkspaceRuntimePanel } from "@/components/workspace-runtime-panel";
import { WorkspaceSignOutButton } from "@/components/workspace-sign-out-button";
import { OfficeCommandCenter } from "@/components/office-command-center";
import { OfficeCommandPalette } from "@/components/office-command-palette";
import { OfficePresenceControl } from "@/components/office-presence-control";


function ModuleLoading() {
  return <section className="office-module-loading" aria-busy="true"><span className="office-module-loading-icon" /><div><b>Loading module</b><small>Opening the requested workspace…</small></div></section>;
}

const OfficeNavLink = dynamic(() => import("@/components/office-nav-link").then((module) => module.OfficeNavLink), { loading: ModuleLoading });
const AccessGovernancePanel = dynamic(() => import("@/components/access-governance-panel").then((module) => module.AccessGovernancePanel), { loading: ModuleLoading });
const WorkforceAdministrationPanel = dynamic(() => import("@/components/workforce-administration-panel").then((module) => module.WorkforceAdministrationPanel), { loading: ModuleLoading });
const WorkforceLiveOverview = dynamic(() => import("@/components/workforce-live-overview").then((module) => module.WorkforceLiveOverview), { loading: ModuleLoading });
const OfficeWorkforceLifecycle = dynamic(() => import("@/components/office-workforce-lifecycle").then((module) => module.OfficeWorkforceLifecycle), { loading: ModuleLoading });
const OfficeActivityTimeline = dynamic(() => import("@/components/office-activity-timeline").then((module) => module.OfficeActivityTimeline), { loading: ModuleLoading });
const OfficeApplicabilityEngine = dynamic(() => import("@/components/office-applicability-engine").then((module) => module.OfficeApplicabilityEngine), { loading: ModuleLoading });
const OfficeAiGovernance = dynamic(() => import("@/components/office-ai-governance").then((module) => module.OfficeAiGovernance), { loading: ModuleLoading });
const OfficeAssetLifecycle = dynamic(() => import("@/components/office-asset-lifecycle").then((module) => module.OfficeAssetLifecycle), { loading: ModuleLoading });
const OfficeBoardWorkspace = dynamic(() => import("@/components/office-board-workspace").then((module) => module.OfficeBoardWorkspace), { loading: ModuleLoading });
const OfficeBillingWorkspace = dynamic(() => import("@/components/office-billing").then((module) => module.OfficeBillingWorkspace), { loading: ModuleLoading });
const OfficeGstTaxWorkspace = dynamic(() => import("@/components/office-gst-tax").then((module) => module.OfficeGstTaxWorkspace), { loading: ModuleLoading });
const OfficeAccountingWorkspace = dynamic(() => import("@/components/office-accounting").then((module) => module.OfficeAccountingWorkspace), { loading: ModuleLoading });
const OfficeBankingWorkspace = dynamic(() => import("@/components/office-banking").then((module) => module.OfficeBankingWorkspace), { loading: ModuleLoading });
const OfficePaymentsWorkspace = dynamic(() => import("@/components/office-payments").then((module) => module.OfficePaymentsWorkspace), { loading: ModuleLoading });
const OfficeExpensesWorkspace = dynamic(() => import("@/components/office-expenses").then((module) => module.OfficeExpensesWorkspace), { loading: ModuleLoading });
const OfficeOwnershipWorkspace = dynamic(() => import("@/components/office-ownership").then((module) => module.OfficeOwnershipWorkspace), { loading: ModuleLoading });
const OfficeFinancialAssurance = dynamic(() => import("@/components/office-financial-assurance").then((module) => module.OfficeFinancialAssurance), { loading: ModuleLoading });
const OfficeFinanceCommandCenter = dynamic(() => import("@/components/office-finance-command-center").then((module) => module.OfficeFinanceCommandCenter), { loading: ModuleLoading });
const OfficeBudgetWorkspace = dynamic(() => import("@/components/office-budget").then((module) => module.OfficeBudgetWorkspace), { loading: ModuleLoading });
const OfficeCommercialHandoff = dynamic(() => import("@/components/office-commercial-handoff").then((module) => module.OfficeCommercialHandoff), { loading: ModuleLoading });
const OfficeCompanyCalendar = dynamic(() => import("@/components/office-company-calendar").then((module) => module.OfficeCompanyCalendar), { loading: ModuleLoading });
const OfficeCompanyInbox = dynamic(() => import("@/components/office-company-inbox").then((module) => module.OfficeCompanyInbox), { loading: ModuleLoading });
const OfficeCrmWorkspace = dynamic(() => import("@/components/office-crm-workspace").then((module) => module.OfficeCrmWorkspace), { loading: ModuleLoading });
const OfficeContractWorkspace = dynamic(() => import("@/components/office-contract-workspace").then((module) => module.OfficeContractWorkspace), { loading: ModuleLoading });
const OfficeCorporateCards = dynamic(() => import("@/components/office-corporate-cards").then((module) => module.OfficeCorporateCards), { loading: ModuleLoading });
const OfficeControlRegister = dynamic(() => import("@/components/office-control-register").then((module) => module.OfficeControlRegister), { loading: ModuleLoading });
const OfficeDataMovement = dynamic(() => import("@/components/office-data-movement").then((module) => module.OfficeDataMovement), { loading: ModuleLoading });
const OfficeDocumentStudio = dynamic(() => import("@/components/office-document-studio").then((module) => module.OfficeDocumentStudio), { loading: ModuleLoading });
const OfficeDeviceIdentity = dynamic(() => import("@/components/office-device-identity").then((module) => module.OfficeDeviceIdentity), { loading: ModuleLoading });
const OfficeDomainControl = dynamic(() => import("@/components/office-domain-control").then((module) => module.OfficeDomainControl), { loading: ModuleLoading });
const OfficeEngineeringControlCenter = dynamic(() => import("@/components/office-engineering-control-center").then((module) => module.OfficeEngineeringControlCenter), { loading: ModuleLoading });
const OfficeEngineeringOperations = dynamic(() => import("@/components/office-engineering-operations").then((module) => module.OfficeEngineeringOperations), { loading: ModuleLoading });
const OfficeEthicsChannel = dynamic(() => import("@/components/office-ethics").then((module) => module.OfficeEthicsChannel), { loading: ModuleLoading });
const OfficeEmergencyContacts = dynamic(() => import("@/components/office-emergency-contacts").then((module) => module.OfficeEmergencyContacts), { loading: ModuleLoading });
const OfficeIntelligenceBrief = dynamic(() => import("@/components/office-intelligence-brief").then((module) => module.OfficeIntelligenceBrief), { loading: ModuleLoading });
const OfficeItService = dynamic(() => import("@/components/office-it-service").then((module) => module.OfficeItService), { loading: ModuleLoading });
const OfficeKnowledgeHub = dynamic(() => import("@/components/office-knowledge-hub").then((module) => module.OfficeKnowledgeHub), { loading: ModuleLoading });
const OfficeMasterData = dynamic(() => import("@/components/office-master-data").then((module) => module.OfficeMasterData), { loading: ModuleLoading });
const OfficePhysicalOffice = dynamic(() => import("@/components/office-physical-office").then((module) => module.OfficePhysicalOffice), { loading: ModuleLoading });
const OfficeNotificationCenter = dynamic(() => import("@/components/office-notification-center").then((module) => module.OfficeNotificationCenter), { loading: ModuleLoading });
const OfficePayrollConsole = dynamic(() => import("@/components/office-payroll-console").then((module) => module.OfficePayrollConsole), { loading: ModuleLoading });
const OfficePortfolioWorkspace = dynamic(() => import("@/components/office-portfolio").then((module) => module.OfficePortfolioWorkspace), { loading: ModuleLoading });
const OfficePeopleDevelopment = dynamic(() => import("@/components/office-people-development").then((module) => module.OfficePeopleDevelopment), { loading: ModuleLoading });
const OfficeTravelWorkspace = dynamic(() => import("@/components/office-travel-workspace").then((module) => module.OfficeTravelWorkspace), { loading: ModuleLoading });
const OfficeTrustCenter = dynamic(() => import("@/components/office-trust-center").then((module) => module.OfficeTrustCenter), { loading: ModuleLoading });
const OfficePrivacyGovernance = dynamic(() => import("@/components/office-privacy-governance").then((module) => module.OfficePrivacyGovernance), { loading: ModuleLoading });
const OfficeRecruitmentWorkspace = dynamic(() => import("@/components/office-recruitment-workspace").then((module) => module.OfficeRecruitmentWorkspace), { loading: ModuleLoading });
const OfficeProcurementControl = dynamic(() => import("@/components/office-procurement-control").then((module) => module.OfficeProcurementControl), { loading: ModuleLoading });
const OfficeQualityWorkspace = dynamic(() => import("@/components/office-quality").then((module) => module.OfficeQualityWorkspace), { loading: ModuleLoading });
const OfficeReadiness = dynamic(() => import("@/components/office-readiness").then((module) => module.OfficeReadiness), { loading: ModuleLoading });
const OfficeOperationsMonitoring = dynamic(() => import("@/components/office-operations-monitoring").then((module) => module.OfficeOperationsMonitoring), { loading: ModuleLoading });
const OfficeRegistrationRegistry = dynamic(() => import("@/components/office-registration-registry").then((module) => module.OfficeRegistrationRegistry), { loading: ModuleLoading });
const OfficeAuditExplorer = dynamic(() => import("@/components/office-audit-explorer").then((module) => module.OfficeAuditExplorer), { loading: ModuleLoading });
const OfficeResilienceWorkspace = dynamic(() => import("@/components/office-resilience").then((module) => module.OfficeResilienceWorkspace), { loading: ModuleLoading });
const OfficeSecurityOverview = dynamic(() => import("@/components/office-security-overview").then((module) => module.OfficeSecurityOverview), { loading: ModuleLoading });
const OfficeSecuritySettings = dynamic(() => import("@/components/office-security-settings").then((module) => module.OfficeSecuritySettings), { loading: ModuleLoading });
const OfficeSecureCustody = dynamic(() => import("@/components/office-secure-custody").then((module) => module.OfficeSecureCustody), { loading: ModuleLoading });
const OfficeSupportOperations = dynamic(() => import("@/components/office-support-operations").then((module) => module.OfficeSupportOperations), { loading: ModuleLoading });
const OfficeStrategyWorkspace = dynamic(() => import("@/components/office-strategy").then((module) => module.OfficeStrategyWorkspace), { loading: ModuleLoading });
const OfficeWorkHub = dynamic(() => import("@/components/office-work-hub").then((module) => module.OfficeWorkHub), { loading: ModuleLoading });
const RequestCollaborationWorkspace = dynamic(() => import("@/components/request-collaboration-workspace").then((module) => module.RequestCollaborationWorkspace), { loading: ModuleLoading });
const OfficeOrganizationChart = dynamic(() => import("@/components/office-organization-chart").then((module) => module.OfficeOrganizationChart), { loading: ModuleLoading });
const OfficeEmbedRegistry = dynamic(() => import("@/components/office-embed-registry").then((module) => module.OfficeEmbedRegistry), { loading: ModuleLoading });

type Props = { workspace: WorkspaceKind; section: OfficeSection | FinanceSection; identity: OfficeIdentity };

const groupIcons = {
  Overview: LayoutDashboard,
  Work: ClipboardCheck,
  Operate: BriefcaseBusiness,
  Govern: Scale,
  Records: Files,
  Office: Users,
  Assure: ShieldCheck,
  Revenue: Building2,
  Treasury: Landmark,
  Tax: Gauge,
  Books: Files,
  Evidence: ShieldCheck,
  Payables: ClipboardCheck,
  "Corporate Finance": Landmark,
} as const;

function NavIcon({ group }: { group: string }) {
  const Icon = groupIcons[group as keyof typeof groupIcons] ?? Settings;
  return <Icon aria-hidden="true" />;
}

function sectionEntries(workspace: WorkspaceKind) {
  const sections = workspace === "finance" ? financeSections : officeSections;
  return Object.entries(sections) as [string, WorkspaceSection][];
}

function IdentityCard({ identity }: { identity: OfficeIdentity }) {
  const authorityLabel = identity.founder ? "FOUNDER" : identity.roles.join(" · ");
  const content = <><span>{authorityLabel}</span><small>{identity.email ?? "Verified identity"}{identity.department ? ` · ${identity.department}` : ""}</small></>;
  if (roleCanAccessSection(officeSections.settings, identity.roles)) {
    return <Link href="/office/settings" className="office-identity" aria-label="Open identity and security settings">{content}</Link>;
  }
  return <div className="office-identity" aria-label="Verified KRAVIA Office identity">{content}</div>;
}

export async function InternalWorkspaceScreen({ workspace, section, identity }: Props) {
  const definition = workspaceDefinitions[workspace];
  const sections = workspace === "finance" ? financeSections : officeSections;
  const item = (sections as Record<string, WorkspaceSection>)[section];
  const capability = identity.roles.includes("OWNER")
    ? { generated_at: new Date().toISOString(), permissions: [] as string[], scopes: [] }
    : await getOfficeCapabilitySnapshot();
  const permissions = capability.permissions;
  const visible = (slug: string, value: WorkspaceSection) => roleCanAccessSection(value, identity.roles) && capabilityCanAccessSection(workspace, slug, identity.roles, permissions);
  const permitted = item ? visible(String(section), item) : false;
  const entries = sectionEntries(workspace).filter(([slug, value]) => visible(slug, value));
  const groups = Array.from(new Set(entries.map(([, value]) => value.group)));
  const switchWorkspace: WorkspaceKind = workspace === "office" ? "finance" : "office";
  const switchDashboard = switchWorkspace === "finance" ? financeSections.dashboard : officeSections.dashboard;
  const canSwitch = roleCanAccessWorkspace(switchWorkspace, identity.roles)
    && roleCanAccessSection(switchDashboard, identity.roles)
    && capabilityCanAccessSection(switchWorkspace, "dashboard", identity.roles, permissions);
  const commands = navigationCommands(workspace, entries);

  return <main className={`office office-v2 workspace-shell workspace-${workspace}`}>
    <aside>
      <OfficeNavLink href={`${definition.basePath}/dashboard`} className="wordmark" aria-label={`${definition.label} home`}><span>KRAVIA</span><span>{workspace === "finance" ? "FINANCE" : "OFFICE"}</span></OfficeNavLink>
      <div className="workspace-context"><span>PRIVATE OPERATING SYSTEM</span><b>{workspace === "finance" ? "Finance & Tax" : "Company Operations"}</b></div>
      <nav aria-label={`${definition.label} navigation`}>{groups.map((group) => <div className="workspace-nav-group" key={group}><p>{group}</p>{entries.filter(([, value]) => value.group === group).map(([slug, value]) => <OfficeNavLink key={slug} href={`${definition.basePath}/${slug}`}><NavIcon group={value.group} /><span>{value.title}</span></OfficeNavLink>)}</div>)}</nav>
      <div className="workspace-side-actions">{canSwitch ? <Link href={`/${switchWorkspace}`} className="workspace-switch"><Landmark aria-hidden="true" /> Open {switchWorkspace === "finance" ? "Finance" : "Office"}</Link> : null}<WorkspaceSignOutButton workspace={workspace} /></div>
      <p className="office-side-note">Private · AAL2 protected<br />Role + permission + scope aware</p>
    </aside>

    <section className="office-main">
      <header className="office-topbar"><div><p className="eyebrow">{item?.eyebrow ?? definition.label}</p><h1>{item?.title ?? definition.label}</h1></div><div className="office-topbar-actions"><OfficePresenceControl /><OfficeCommandPalette commands={commands} /><OfficeCommandCenter /><IdentityCard identity={identity} /></div></header>
      {permitted && item ? <>
        <div className="office-notice"><ShieldCheck /><p>{item.description}</p></div>
        {workspace === "office" && section === "access" ? <><AccessGovernancePanel identity={identity} /><WorkforceAdministrationPanel identity={identity} /></>
          : workspace === "office" && section === "notifications" ? <OfficeNotificationCenter />
          : workspace === "office" && section === "tasks" ? <OfficeCompanyInbox />
          : workspace === "office" && section === "calendar" ? <OfficeCompanyCalendar />
          : workspace === "office" && section === "crm" ? <><OfficeCrmWorkspace /><OfficeCommercialHandoff /></>
          : workspace === "office" && section === "contracts" ? <OfficeContractWorkspace />
          : workspace === "office" && section === "products" ? <OfficeMasterData kind="products" canCreate={identity.roles.includes("OWNER") || permissions.includes("master.product.create")} />
          : section === "customers" ? <OfficeMasterData kind="customers" canCreate={identity.roles.includes("OWNER") || permissions.includes("master.customer.create")} />
          : workspace === "office" && section === "engineering" ? <><OfficeEngineeringControlCenter /><OfficeEngineeringOperations /></>
          : workspace === "office" && section === "portfolio" ? <OfficePortfolioWorkspace />
          : workspace === "office" && section === "intelligence" ? <OfficeIntelligenceBrief />
          : workspace === "office" && section === "decisions" ? <OfficeControlRegister />
          : workspace === "office" && section === "strategy" ? <OfficeStrategyWorkspace />
          : workspace === "office" && section === "requests" ? <><OfficeWorkHub identity={identity} mode="requests" /><RequestCollaborationWorkspace /></>
          : workspace === "office" && section === "approvals" ? <OfficeWorkHub identity={identity} mode="approvals" />
          : workspace === "office" && section === "manager" ? <OfficeWorkHub identity={identity} mode="manager" />
          : workspace === "office" && section === "knowledge" ? <OfficeKnowledgeHub />
          : section === "documents" ? <OfficeDocumentStudio />
          : workspace === "finance" && section === "billing" ? <OfficeBillingWorkspace canCreateInvoice={identity.roles.includes("OWNER") || permissions.includes("finance.invoice.create")} canRecordReceipt={identity.roles.includes("OWNER") || permissions.includes("finance.receipt.record")} />
          : workspace === "finance" && section === "gst" ? <OfficeGstTaxWorkspace canPrepare={identity.roles.includes("OWNER") || permissions.includes("tax.gst.prepare")} canApprove={identity.roles.includes("OWNER") || permissions.includes("tax.gst.approve")} />
          : workspace === "finance" && section === "accounting" ? <OfficeAccountingWorkspace canManageLocks={identity.roles.some((role) => role === "OWNER" || role === "FINANCE" || role === "CA")} canApproveUnlock={identity.roles.some((role) => role === "OWNER" || role === "CA")} />
          : workspace === "finance" && section === "banking" ? <OfficeBankingWorkspace mode="banking" canRegisterAccount={identity.roles.some((role) => role === "OWNER" || role === "DIRECTOR" || role === "FINANCE")} canImportTransaction={identity.roles.some((role) => role === "OWNER" || role === "FINANCE" || role === "CA")} canAutoMatch={identity.roles.some((role) => role === "OWNER" || role === "FINANCE" || role === "CA")} />
          : workspace === "finance" && section === "reconciliation" ? <OfficeBankingWorkspace mode="reconciliation" canRegisterAccount={false} canImportTransaction={false} canAutoMatch={identity.roles.some((role) => role === "OWNER" || role === "FINANCE" || role === "CA")} />
          : workspace === "finance" && section === "payments" ? <OfficePaymentsWorkspace canStage={identity.roles.includes("OWNER") || permissions.includes("finance.payment.prepare")} canDecide={identity.roles.includes("OWNER") || (identity.roles.includes("DIRECTOR") && permissions.includes("finance.payment.approve"))} canExecute={identity.roles.includes("OWNER") || permissions.includes("finance.payment.approve")} />
          : workspace === "finance" && section === "expenses" ? <OfficeExpensesWorkspace canCreate={identity.roles.includes("OWNER") || permissions.includes("finance.expense.request")} canDecide={identity.roles.includes("OWNER") || identity.roles.includes("DIRECTOR")} canApplyApproval={identity.roles.includes("OWNER") || identity.roles.includes("DIRECTOR") || identity.roles.includes("FINANCE")} />
          : workspace === "finance" && section === "ownership" ? <OfficeOwnershipWorkspace canStage={identity.roles.includes("OWNER") || identity.roles.includes("DIRECTOR")} canDecide={identity.roles.includes("OWNER") || identity.roles.includes("DIRECTOR")} canPost={identity.roles.includes("OWNER") || identity.roles.includes("DIRECTOR")} />
          : workspace === "finance" && section === "compliance" ? <OfficeFinancialAssurance mode="compliance" canManageCompliance={identity.roles.some((role) => role === "OWNER" || role === "DIRECTOR" || role === "CA")} canManageInspections={identity.roles.some((role) => role === "OWNER" || role === "DIRECTOR" || role === "FINANCE" || role === "CA")} canVerifyChain={false} />
          : workspace === "finance" && section === "audit" ? <OfficeFinancialAssurance mode="audit" canManageCompliance={false} canManageInspections={identity.roles.some((role) => role === "OWNER" || role === "DIRECTOR" || role === "FINANCE" || role === "CA")} canVerifyChain={identity.roles.some((role) => role === "OWNER" || role === "DIRECTOR" || role === "AUDITOR")} />
          : section === "payroll" ? <OfficePayrollConsole />
          : section === "budget" ? <OfficeBudgetWorkspace />
          : workspace === "office" && section === "assets" ? <OfficeAssetLifecycle />
          : workspace === "office" && section === "devices" ? <OfficeDeviceIdentity />
          : workspace === "office" && section === "it" ? <OfficeItService />
          : workspace === "office" && section === "facilities" ? <OfficePhysicalOffice />
          : workspace === "office" && section === "recruitment" ? <OfficeRecruitmentWorkspace />
          : workspace === "office" && section === "people" ? <><WorkforceLiveOverview /><OfficeWorkforceLifecycle /><OfficeOrganizationChart /></>
          : workspace === "office" && section === "emergency" ? <OfficeEmergencyContacts />
          : workspace === "office" && section === "development" ? <OfficePeopleDevelopment />
          : workspace === "office" && section === "travel" ? <OfficeTravelWorkspace />
          : workspace === "office" && section === "cards" ? <OfficeCorporateCards />
          : workspace === "office" && section === "governance" ? <OfficeBoardWorkspace />
          : workspace === "office" && section === "compliance" ? <OfficeApplicabilityEngine />
          : workspace === "office" && section === "registrations" ? <OfficeRegistrationRegistry />
          : workspace === "office" && section === "vendors" ? <OfficeProcurementControl />
          : workspace === "office" && section === "support" ? <OfficeSupportOperations />
          : workspace === "office" && section === "data" ? <OfficeDataMovement />
          : workspace === "office" && section === "privacy" ? <OfficePrivacyGovernance />
          : workspace === "office" && section === "quality" ? <OfficeQualityWorkspace />
          : workspace === "office" && section === "trust" ? <OfficeTrustCenter />
          : workspace === "office" && section === "ethics" ? <OfficeEthicsChannel />
          : workspace === "finance" && section === "ethics" ? <OfficeEthicsChannel />
          : workspace === "finance" && section === "emergency" ? <OfficeEmergencyContacts />
          : workspace === "finance" && section === "ai" ? <OfficeAiGovernance />
          : workspace === "office" && section === "resilience" ? <OfficeResilienceWorkspace />
          : workspace === "office" && section === "security" ? <OfficeSecurityOverview />
          : workspace === "office" && section === "ai" ? <OfficeAiGovernance />
          : workspace === "office" && section === "readiness" ? <><OfficeReadiness /><OfficeOperationsMonitoring canEvaluate={identity.roles.some((role) => role === "OWNER" || role === "DIRECTOR" || role === "OPERATIONS")} /></>
          : workspace === "office" && section === "integrations" ? <OfficeEmbedRegistry />
          : workspace === "office" && section === "domains" ? <OfficeDomainControl />
          : workspace === "office" && section === "custody" ? <OfficeSecureCustody />
          : workspace === "office" && section === "audit" ? <OfficeAuditExplorer />
          : workspace === "office" && section === "settings" ? <OfficeSecuritySettings identity={identity} />
          : workspace === "finance" && section === "cards" ? <OfficeCorporateCards />
          : workspace === "finance" && section === "insurance" ? <OfficeResilienceWorkspace mode="insurance" />
          : workspace === "finance" && section === "dashboard" ? <OfficeFinanceCommandCenter />
          : section === "dashboard" ? <WorkspaceDashboard workspace={workspace} section={section} identity={identity} permissions={permissions} />
          : <WorkspaceModule workspace={workspace} section={section} item={item} />}
      </> : <section className="office-denied"><TriangleAlert /><div><p className="eyebrow">ACCESS RESTRICTED</p><h2>This module is not assigned to your current authority.</h2><p>KRAVIA Office evaluates identity, current roles and capability scope before showing a work surface. Direct URLs do not bypass the server-side authorization used by records and actions.</p><Link className="text-link" href={`${definition.basePath}/dashboard`}>Return to overview <ArrowRight /></Link></div></section>}
    </section>
  </main>;
}

function WorkspaceDashboard({ workspace, section, identity, permissions }: { workspace: WorkspaceKind; section: OfficeSection | FinanceSection; identity: OfficeIdentity; permissions: readonly string[] }) {
  const sections = sectionEntries(workspace)
    .filter(([slug, sectionItem]) => slug !== "dashboard" && roleCanAccessSection(sectionItem, identity.roles) && capabilityCanAccessSection(workspace, slug, identity.roles, permissions))
    .slice(0, 9);
  const basePath = workspaceDefinitions[workspace].basePath;
  const runtime = runtimeModuleSpec(workspace, section);
  const onlyShellRoles = identity.roles.every((role) => role === "ADMIN" || role === "MEMBER");
  const executive = identity.roles.some((role) => role === "OWNER" || role === "DIRECTOR");

  return <>
    {workspace === "office" ? <>{executive ? <OfficeIntelligenceBrief compact /> : null}<OfficeWorkHub identity={identity} mode="dashboard" /><OfficeCompanyInbox compact /><OfficeActivityTimeline /></> : <section className="workspace-hero-panel"><div><p className="eyebrow">VERIFIED AAL2 SESSION</p><h2>Finance work without mixing ownership, tax and treasury.</h2></div><ShieldCheck aria-hidden="true" /></section>}
    {runtime && !onlyShellRoles ? <WorkspaceRuntimePanel title={workspace === "finance" ? "Finance overview" : "Office overview"} spec={runtime} /> : null}
    <div className="office-dashboard-grid workspace-module-grid">{sections.map(([slug, sectionItem]) => <OfficeNavLink href={`${basePath}/${slug}`} key={slug} className="workspace-module-card"><div className="workspace-module-card-head"><NavIcon group={sectionItem.group} /><p className="eyebrow">{sectionItem.group}</p></div><h2>{sectionItem.title}</h2><span>{sectionItem.description}</span><b>Open <ArrowRight aria-hidden="true" /></b></OfficeNavLink>)}</div>
  </>;
}

function WorkspaceModule({ workspace, section, item }: { workspace: WorkspaceKind; section: OfficeSection | FinanceSection; item: WorkspaceSection }) {
  const runtime = runtimeModuleSpec(workspace, section);
  if (runtime) return <WorkspaceRuntimePanel title={item.title} spec={runtime} />;
  return <section className="office-record-panel workspace-record-panel" aria-label={`${item.title} workspace`}><div className="office-record-panel-head"><div><p className="eyebrow">CANONICAL COMPANY SYSTEM</p><strong>{workspace === "finance" ? "Finance & Tax" : "KRAVIA Office"}</strong></div><span className="office-status">GOVERNED</span></div><div className="office-empty"><FileLock2 /><div><h2>Specialised workflow surface</h2><p>This module uses its controlled workflow rather than a generic table. No sample financial, legal, tax or corporate data is fabricated for presentation.</p></div></div></section>;
}
