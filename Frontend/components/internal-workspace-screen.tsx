import Link from "next/link";
import { ArrowRight, FileLock2, Landmark, ShieldCheck, TriangleAlert } from "lucide-react";
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
import { AccessGovernancePanel } from "@/components/access-governance-panel";
import { WorkforceAdministrationPanel } from "@/components/workforce-administration-panel";
import { WorkforceLiveOverview } from "@/components/workforce-live-overview";
import { OfficeWorkforceLifecycle } from "@/components/office-workforce-lifecycle";
import { OfficeActivityTimeline } from "@/components/office-activity-timeline";
import { OfficeApplicabilityEngine } from "@/components/office-applicability-engine";
import { OfficeBoardWorkspace } from "@/components/office-board-workspace";
import { OfficeCommandCenter } from "@/components/office-command-center";
import { OfficeCommandPalette } from "@/components/office-command-palette";
import { OfficeCommercialHandoff } from "@/components/office-commercial-handoff";
import { OfficeCompanyCalendar } from "@/components/office-company-calendar";
import { OfficeCompanyInbox } from "@/components/office-company-inbox";
import { OfficeCrmWorkspace } from "@/components/office-crm-workspace";
import { OfficeDataMovement } from "@/components/office-data-movement";
import { OfficeDocumentStudio } from "@/components/office-document-studio";
import { OfficeDeviceIdentity } from "@/components/office-device-identity";
import { OfficeEngineeringControlCenter } from "@/components/office-engineering-control-center";
import { OfficeIntelligenceBrief } from "@/components/office-intelligence-brief";
import { OfficeItService } from "@/components/office-it-service";
import { OfficeNotificationCenter } from "@/components/office-notification-center";
import { OfficePayrollConsole } from "@/components/office-payroll-console";
import { OfficePresenceControl } from "@/components/office-presence-control";
import { OfficePrivacyGovernance } from "@/components/office-privacy-governance";
import { OfficeRecruitmentWorkspace } from "@/components/office-recruitment-workspace";
import { OfficeProcurementControl } from "@/components/office-procurement-control";
import { OfficeReadiness } from "@/components/office-readiness";
import { OfficeSecurityOverview } from "@/components/office-security-overview";
import { OfficeSecuritySettings } from "@/components/office-security-settings";
import { OfficeSupportOperations } from "@/components/office-support-operations";
import { OfficeWorkHub } from "@/components/office-work-hub";
import { RequestCollaborationWorkspace } from "@/components/request-collaboration-workspace";
import { OfficeOrganizationChart } from "@/components/office-organization-chart";
import { OfficeEmbedRegistry } from "@/components/office-embed-registry";

type Props = { workspace: WorkspaceKind; section: OfficeSection | FinanceSection; identity: OfficeIdentity };

function sectionEntries(workspace: WorkspaceKind) {
  const sections = workspace === "finance" ? financeSections : officeSections;
  return Object.entries(sections) as [string, WorkspaceSection][];
}

function IdentityCard({ identity }: { identity: OfficeIdentity }) {
  const content = <><span>{identity.roles.join(" · ")}</span><small>{identity.email ?? "Verified identity"}{identity.department ? ` · ${identity.department}` : ""}</small></>;
  if (roleCanAccessSection(officeSections.settings, identity.roles)) {
    return <Link href="/office/settings" className="office-identity" aria-label="Open identity and security settings">{content}</Link>;
  }
  return <div className="office-identity" aria-label="Verified KRAVIA Office identity">{content}</div>;
}

export async function InternalWorkspaceScreen({ workspace, section, identity }: Props) {
  const definition = workspaceDefinitions[workspace];
  const sections = workspace === "finance" ? financeSections : officeSections;
  const item = (sections as Record<string, WorkspaceSection>)[section];
  const capability = await getOfficeCapabilitySnapshot();
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
      <Link href={`${definition.basePath}/dashboard`} className="wordmark" aria-label={`${definition.label} home`}><span>KRAVIA</span><span>{workspace === "finance" ? "FINANCE" : "OFFICE"}</span></Link>
      <div className="workspace-context"><span>PRIVATE OPERATING SYSTEM</span><b>{workspace === "finance" ? "Finance & Tax" : "Company Operations"}</b></div>
      <nav aria-label={`${definition.label} navigation`}>{groups.map((group) => <div className="workspace-nav-group" key={group}><p>{group}</p>{entries.filter(([, value]) => value.group === group).map(([slug, value]) => <Link key={slug} href={`${definition.basePath}/${slug}`} aria-current={slug === section ? "page" : undefined}>{value.title}</Link>)}</div>)}</nav>
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
          : workspace === "office" && section === "engineering" ? <OfficeEngineeringControlCenter />
          : workspace === "office" && section === "intelligence" ? <OfficeIntelligenceBrief />
          : workspace === "office" && section === "requests" ? <><OfficeWorkHub identity={identity} mode="requests" /><RequestCollaborationWorkspace /></>
          : workspace === "office" && section === "approvals" ? <OfficeWorkHub identity={identity} mode="approvals" />
          : workspace === "office" && section === "manager" ? <OfficeWorkHub identity={identity} mode="manager" />
          : section === "documents" ? <OfficeDocumentStudio />
          : section === "payroll" ? <OfficePayrollConsole />
          : workspace === "office" && section === "devices" ? <OfficeDeviceIdentity />
          : workspace === "office" && section === "it" ? <OfficeItService />
          : workspace === "office" && section === "recruitment" ? <OfficeRecruitmentWorkspace />
          : workspace === "office" && section === "people" ? <><WorkforceLiveOverview /><OfficeWorkforceLifecycle /><OfficeOrganizationChart /></>
          : workspace === "office" && section === "governance" ? <OfficeBoardWorkspace />
          : workspace === "office" && section === "compliance" ? <OfficeApplicabilityEngine />
          : workspace === "office" && section === "vendors" ? <OfficeProcurementControl />
          : workspace === "office" && section === "support" ? <OfficeSupportOperations />
          : workspace === "office" && section === "data" ? <OfficeDataMovement />
          : workspace === "office" && section === "privacy" ? <OfficePrivacyGovernance />
          : workspace === "office" && section === "security" ? <OfficeSecurityOverview />
          : workspace === "office" && section === "readiness" ? <OfficeReadiness />
          : workspace === "office" && section === "integrations" ? <OfficeEmbedRegistry />
          : workspace === "office" && section === "settings" ? <OfficeSecuritySettings identity={identity} />
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
    <div className="office-dashboard-grid workspace-module-grid">{sections.map(([slug, sectionItem]) => <Link href={`${basePath}/${slug}`} key={slug} className="workspace-module-card"><p className="eyebrow">{sectionItem.group}</p><h2>{sectionItem.title}</h2><span>{sectionItem.description}</span><b>Open module <ArrowRight aria-hidden="true" /></b></Link>)}</div>
  </>;
}

function WorkspaceModule({ workspace, section, item }: { workspace: WorkspaceKind; section: OfficeSection | FinanceSection; item: WorkspaceSection }) {
  const runtime = runtimeModuleSpec(workspace, section);
  if (runtime) return <WorkspaceRuntimePanel title={item.title} spec={runtime} />;
  return <section className="office-record-panel workspace-record-panel" aria-label={`${item.title} workspace`}><div className="office-record-panel-head"><div><p className="eyebrow">CANONICAL COMPANY SYSTEM</p><strong>{workspace === "finance" ? "Finance & Tax" : "KRAVIA Office"}</strong></div><span className="office-status">GOVERNED</span></div><div className="office-empty"><FileLock2 /><div><h2>Specialised workflow surface</h2><p>This module uses its controlled workflow rather than a generic table. No sample financial, legal, tax or corporate data is fabricated for presentation.</p></div></div></section>;
}
