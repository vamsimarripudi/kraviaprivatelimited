"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import {
  BriefcaseBusiness,
  Building2,
  ClipboardCheck,
  Files,
  Gauge,
  Landmark,
  LayoutDashboard,
  Scale,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { OfficeNavLink } from "@/components/office-nav-link";
import { OfficePrefetchRoutes } from "@/components/office-prefetch-routes";
import { OfficePresenceControl } from "@/components/office-presence-control";
import { OfficeCommandPalette } from "@/components/office-command-palette";
import { OfficeCommandCenter } from "@/components/office-command-center";
import { WorkspaceSignOutButton } from "@/components/workspace-sign-out-button";
import { OfficeWorkspaceProvider } from "@/components/office-workspace-context";
import type { OfficeIdentity } from "@/lib/office/auth-server";
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
  type WorkspaceKind,
  type WorkspaceSection,
} from "@/lib/office/workspaces";

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

function sectionFromPath(pathname: string, workspace: WorkspaceKind) {
  const prefix = workspace === "finance" ? "/finance/" : "/office/";
  if (!pathname.startsWith(prefix)) return "dashboard";
  return pathname.slice(prefix.length).split("/")[0] || "dashboard";
}

function IdentityCard({ identity }: { identity: OfficeIdentity }) {
  const authorityLabel = identity.founder ? "FOUNDER" : identity.roles.join(" · ");
  const content = (
    <>
      <span>{authorityLabel}</span>
      <small>
        {identity.email ?? "Verified identity"}
        {identity.department ? ` · ${identity.department}` : ""}
      </small>
    </>
  );
  if (roleCanAccessSection(officeSections.settings, identity.roles)) {
    return (
      <OfficeNavLink
        href="/office/settings"
        className="office-identity"
        aria-label="Open identity and security settings"
      >
        {content}
      </OfficeNavLink>
    );
  }
  return <div className="office-identity">{content}</div>;
}

export function OfficeWorkspaceShell({
  workspace,
  identity,
  permissions,
  children,
}: {
  workspace: WorkspaceKind;
  identity: OfficeIdentity;
  permissions: readonly string[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const definition = workspaceDefinitions[workspace];
  const sections = workspace === "finance" ? financeSections : officeSections;
  const section = sectionFromPath(pathname, workspace);
  const item = (sections as Record<string, WorkspaceSection>)[section];

  const entries = useMemo(
    () =>
      sectionEntries(workspace).filter(
        ([slug, value]) =>
          roleCanAccessSection(value, identity.roles) &&
          capabilityCanAccessSection(workspace, slug, identity.roles, permissions),
      ),
    [identity.roles, permissions, workspace],
  );
  const groups = useMemo(
    () => Array.from(new Set(entries.map(([, value]) => value.group))),
    [entries],
  );

  const switchWorkspace: WorkspaceKind = workspace === "office" ? "finance" : "office";
  const switchDashboard =
    switchWorkspace === "finance" ? financeSections.dashboard : officeSections.dashboard;
  const canSwitch =
    roleCanAccessWorkspace(switchWorkspace, identity.roles) &&
    roleCanAccessSection(switchDashboard, identity.roles) &&
    capabilityCanAccessSection(
      switchWorkspace,
      "dashboard",
      identity.roles,
      permissions,
    );

  const commands = useMemo(
    () => navigationCommands(workspace, entries),
    [entries, workspace],
  );
  const prefetchedRoutes = useMemo(
    () => entries.map(([slug]) => `${definition.basePath}/${slug}`),
    [definition.basePath, entries],
  );

  return (
    <OfficeWorkspaceProvider identity={identity} permissions={permissions}>
      <main className={`office office-v2 workspace-shell workspace-${workspace}`}>
        <OfficePrefetchRoutes hrefs={prefetchedRoutes} />
        <aside>
          <OfficeNavLink
            href={`${definition.basePath}/dashboard`}
            className="wordmark"
            aria-label={`${definition.label} home`}
          >
            <span>KRAVIA</span>
            <span>{workspace === "finance" ? "FINANCE" : "OFFICE"}</span>
          </OfficeNavLink>

          <div className="workspace-context">
            <span>PRIVATE OPERATING SYSTEM</span>
            <b>{workspace === "finance" ? "Finance & Tax" : "Company Operations"}</b>
          </div>

          <nav aria-label={`${definition.label} navigation`}>
            {groups.map((group) => (
              <div className="workspace-nav-group" key={group}>
                <p>{group}</p>
                {entries
                  .filter(([, value]) => value.group === group)
                  .map(([slug, value]) => (
                    <OfficeNavLink key={slug} href={`${definition.basePath}/${slug}`}>
                      <NavIcon group={value.group} />
                      <span>{value.title}</span>
                    </OfficeNavLink>
                  ))}
              </div>
            ))}
          </nav>

          <div className="workspace-side-actions">
            {canSwitch ? (
              <OfficeNavLink href={`/${switchWorkspace}/dashboard`} className="workspace-switch">
                <Landmark aria-hidden="true" />
                Open {switchWorkspace === "finance" ? "Finance" : "Office"}
              </OfficeNavLink>
            ) : null}
            <WorkspaceSignOutButton workspace={workspace} />
          </div>
          <p className="office-side-note">Private · AAL2 protected</p>
        </aside>

        <section className="office-main">
          <header className="office-topbar">
            <div>
              <p className="eyebrow">{item?.eyebrow ?? definition.label}</p>
              <h1>{item?.title ?? definition.label}</h1>
            </div>
            <div className="office-topbar-actions">
              <OfficePresenceControl />
              <OfficeCommandPalette commands={commands} />
              <OfficeCommandCenter />
              <IdentityCard identity={identity} />
            </div>
          </header>

          {item ? (
            <div className="office-notice">
              <ShieldCheck aria-hidden="true" />
              <p>{item.description}</p>
            </div>
          ) : null}

          {children}
        </section>
      </main>
    </OfficeWorkspaceProvider>
  );
}
