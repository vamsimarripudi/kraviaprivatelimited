import Link from "next/link";
import { ArrowRight, FileLock2, Landmark, ShieldCheck, TriangleAlert } from "lucide-react";
import type { OfficeIdentity } from "@/lib/office/auth-server";
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

type Props = {
  workspace: WorkspaceKind;
  section: OfficeSection | FinanceSection;
  identity: OfficeIdentity;
};

function sectionEntries(workspace: WorkspaceKind) {
  const sections = workspace === "finance" ? financeSections : officeSections;
  return Object.entries(sections) as [string, WorkspaceSection][];
}

function IdentityCard({ identity }: { identity: OfficeIdentity }) {
  const content = <><span>{identity.roles.join(" · ")}</span><small>{identity.email ?? "Verified identity"}</small></>;
  if (roleCanAccessSection(officeSections.settings, identity.roles)) {
    return <Link href="/office/settings" className="office-identity" aria-label="Open identity and security settings">{content}</Link>;
  }
  return <div className="office-identity" aria-label="Verified KRAVIA Office identity">{content}</div>;
}

export function InternalWorkspaceScreen({ workspace, section, identity }: Props) {
  const definition = workspaceDefinitions[workspace];
  const sections = workspace === "finance" ? financeSections : officeSections;
  const item = (sections as Record<string, WorkspaceSection>)[section];
  const permitted = item ? roleCanAccessSection(item, identity.roles) : false;
  const entries = sectionEntries(workspace).filter(([, value]) => roleCanAccessSection(value, identity.roles));
  const groups = Array.from(new Set(entries.map(([, value]) => value.group)));
  const canSwitch = workspace === "office" ? roleCanAccessWorkspace("finance", identity.roles) : roleCanAccessWorkspace("office", identity.roles);
  const switchWorkspace: WorkspaceKind = workspace === "office" ? "finance" : "office";

  return <main className={`office office-v2 workspace-shell workspace-${workspace}`}>
    <aside>
      <Link href={`${definition.basePath}/dashboard`} className="wordmark" aria-label={`${definition.label} home`}>
        <span>KRAVIA</span><span>{workspace === "finance" ? "FINANCE" : "OFFICE"}</span>
      </Link>
      <div className="workspace-context"><span>PRIVATE WORKSPACE</span><b>{workspace === "finance" ? "Finance & Tax" : "Corporate Operations"}</b></div>
      <nav aria-label={`${definition.label} navigation`}>
        {groups.map((group) => <div className="workspace-nav-group" key={group}>
          <p>{group}</p>
          {entries.filter(([, value]) => value.group === group).map(([slug, value]) => <Link key={slug} href={`${definition.basePath}/${slug}`} aria-current={slug === section ? "page" : undefined}>{value.title}</Link>)}
        </div>)}
      </nav>
      <div className="workspace-side-actions">
        {canSwitch ? <Link href={`/${switchWorkspace}`} className="workspace-switch"><Landmark aria-hidden="true" /> Open {switchWorkspace === "finance" ? "Finance" : "Office"}</Link> : null}
        <WorkspaceSignOutButton workspace={workspace} />
      </div>
      <p className="office-side-note">Private surface<br />No public indexing</p>
    </aside>

    <section className="office-main">
      <header className="office-topbar">
        <div><p className="eyebrow">{item?.eyebrow ?? definition.label}</p><h1>{item?.title ?? definition.label}</h1></div>
        <IdentityCard identity={identity} />
      </header>

      {permitted && item ? <>
        <div className="office-notice"><ShieldCheck /><p>{item.description}</p></div>
        {section === "dashboard"
          ? <WorkspaceDashboard workspace={workspace} section={section} identity={identity} />
          : <WorkspaceModule workspace={workspace} section={section} item={item} />}
      </> : <section className="office-denied"><TriangleAlert /><div><p className="eyebrow">ACCESS RESTRICTED</p><h2>This module is not assigned to your role.</h2><p>KRAVIA Office permissions are enforced from the dedicated identity tenant. Access changes require an authorised role assignment and a newly issued session.</p><Link className="text-link" href={`${definition.basePath}/dashboard`}>Return to overview <ArrowRight /></Link></div></section>}
    </section>
  </main>;
}

function WorkspaceDashboard({ workspace, section, identity }: { workspace: WorkspaceKind; section: OfficeSection | FinanceSection; identity: OfficeIdentity }) {
  const sections = sectionEntries(workspace)
    .filter(([slug, item]) => slug !== "dashboard" && roleCanAccessSection(item, identity.roles))
    .slice(0, 8);
  const basePath = workspaceDefinitions[workspace].basePath;
  const runtime = runtimeModuleSpec(workspace, section);
  return <>
    <section className="workspace-hero-panel">
      <div><p className="eyebrow">VERIFIED AAL2 SESSION</p><h2>{workspace === "finance" ? "Finance work without mixing ownership, tax and treasury." : "One company workspace. Role-scoped by design."}</h2></div>
      <ShieldCheck aria-hidden="true" />
    </section>
    {runtime ? <WorkspaceRuntimePanel title={workspace === "finance" ? "Finance overview" : "Office overview"} spec={runtime} /> : null}
    <div className="office-dashboard-grid workspace-module-grid">
      {sections.map(([slug, item]) => <Link href={`${basePath}/${slug}`} key={slug} className="workspace-module-card">
        <p className="eyebrow">{item.group}</p><h2>{item.title}</h2><span>{item.description}</span><b>Open module <ArrowRight aria-hidden="true" /></b>
      </Link>)}
    </div>
  </>;
}

function WorkspaceModule({ workspace, section, item }: { workspace: WorkspaceKind; section: OfficeSection | FinanceSection; item: WorkspaceSection }) {
  const runtime = runtimeModuleSpec(workspace, section);
  if (runtime) return <WorkspaceRuntimePanel title={item.title} spec={runtime} />;

  return <section className="office-record-panel workspace-record-panel" aria-label={`${item.title} workspace`}>
    <div className="office-record-panel-head">
      <div><p className="eyebrow">CANONICAL COMPANY SYSTEM</p><strong>{workspace === "finance" ? "Finance & Tax" : "KRAVIA Office"}</strong></div>
      <span className="office-status">ROLE SCOPED</span>
    </div>
    <div className="office-empty"><FileLock2 /><div><h2>Specialised workflow surface</h2><p>This module uses its controlled workflow rather than a generic table. No sample financial, legal, tax or corporate data is fabricated for presentation.</p></div></div>
  </section>;
}
