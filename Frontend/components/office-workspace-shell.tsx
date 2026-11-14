"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowRightLeft, BookOpen, BriefcaseBusiness, Building2, CalendarDays, ChevronDown, ChevronRight,
  ClipboardCheck, Cog, FileText, Folders, GitBranch, Landmark,
  LayoutDashboard, Menu, Moon, MoreHorizontal, PanelLeftClose,
  PanelLeftOpen, Scale, Settings, ShieldCheck, Sun, Users, Wallet, X,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { OfficeNavLink } from "@/components/office-nav-link";
import { OfficePrefetchRoutes } from "@/components/office-prefetch-routes";
import { OfficePresenceControl } from "@/components/office-presence-control";
import { OfficeCommandPalette } from "@/components/office-command-palette";
import { OfficeIntelligencePeek } from "@/components/office-intelligence-peek";
import { OfficeIstClock } from "@/components/office-ist-clock";
import { WorkspaceSignOutButton } from "@/components/workspace-sign-out-button";
import { OfficeWorkspaceProvider } from "@/components/office-workspace-context";
import { OfficeAmbientField } from "@/components/office-experience-ambient";
import delegatedStyles from "./office-delegation-banner.module.css";
import type { OfficeIdentity } from "@/lib/office/auth-server";
import {
  capabilityCanAccessSection, navigationCommands,
} from "@/lib/office/workspace-capabilities";
import {
  financeSections, officeSections, roleCanAccessSection, roleCanAccessWorkspace,
  workspaceDefinitions, type WorkspaceKind, type WorkspaceSection,
} from "@/lib/office/workspaces";

const iconByCategory = {
  "My work": LayoutDashboard, People: Users, Engineering: GitBranch,
  Commercial: BriefcaseBusiness, Operations: Building2, Finance: Landmark,
  Governance: Scale, Administration: ShieldCheck, Overview: LayoutDashboard,
  Revenue: Wallet, Treasury: Landmark, Tax: FileText, Books: FileText,
  Payables: ClipboardCheck, Evidence: ShieldCheck,
} as const;

const officeCategoryBySlug: Record<string, string> = {
  dashboard:"My work", "my-role":"My work", "my-transfers":"My work", info:"My work", notifications:"My work",
  tasks:"My work",calendar:"My work",requests:"My work",approvals:"My work",
  manager:"People",recruitment:"People",people:"People",emergency:"People",
  development:"People",worktime:"People",
  engineering:"Engineering",products:"Engineering",portfolio:"Engineering",
  ai:"Engineering",integrations:"Engineering",quality:"Engineering",
  customers:"Commercial",crm:"Commercial",support:"Commercial",
  vendors:"Operations",assets:"Operations",it:"Operations",
  facilities:"Operations",travel:"Operations",cards:"Operations",
  payroll:"Finance",budget:"Finance",
  decisions:"Governance",governance:"Governance",compliance:"Governance",
  registrations:"Governance",documents:"Governance",contracts:"Governance",
  knowledge:"Governance",strategy:"Governance",intelligence:"Governance",
  privacy:"Governance",ethics:"Governance",trust:"Governance",
  "department-ownership":"Administration","role-packages":"Administration",
  access:"Administration",security:"Administration",data:"Administration",
  resilience:"Administration",domains:"Administration",custody:"Administration",
  readiness:"Administration",audit:"Administration",devices:"Administration",
  settings:"Administration",
};
const categoryOrder = [
  "My work","People","Engineering","Commercial","Operations",
  "Finance","Governance","Administration",
];
const financeOrder = ["Overview","Revenue","Treasury","Payables","Tax","Books","Evidence"];
const financeCategory: Record<string,string> = {
  Overview:"Overview",Revenue:"Revenue",Treasury:"Treasury",Tax:"Tax",
  Books:"Books",Payables:"Payables",Evidence:"Evidence","Corporate Finance":"Treasury",
};
const iconBySlug: Record<string, typeof LayoutDashboard> = {
  dashboard:LayoutDashboard,"my-role":Users,"my-transfers":ArrowRightLeft,info:BookOpen,notifications:ShieldCheck,
  tasks:ClipboardCheck,calendar:CalendarDays,requests:FileText,approvals:ShieldCheck,
  manager:Users,people:Users,recruitment:Users,development:Users,
  emergency:ShieldCheck,worktime:CalendarDays,payroll:Wallet,budget:Wallet,
  engineering:GitBranch,products:Folders,portfolio:Folders,crm:BriefcaseBusiness,
  customers:Building2,vendors:BriefcaseBusiness,contracts:FileText,
  documents:FileText,governance:Scale,compliance:Scale,settings:Settings,
  access:ShieldCheck,"role-packages":Users,"department-ownership":ShieldCheck,
};

// The protected Founder navigation is intentionally an oversight + technology
// view, not an invitation to execute every other department's operations.
// Backend permissions still control every API operation and can be delegated.
const founderNavigation = new Set([
  "dashboard", "my-role", "my-transfers", "notifications", "tasks", "calendar", "requests",
  "approvals", "worktime", "manager", "department-ownership", "role-packages",
  "decisions", "strategy", "intelligence", "products", "portfolio", "engineering",
  "documents",
  "quality", "ai", "integrations", "domains", "security", "devices", "it",
  "data", "readiness", "access", "audit", "settings",
]);

type Entry = [string, WorkspaceSection];
type Theme = "light" | "dark";
const themeKey = "kravia.office.appearance";
function sectionEntries(workspace: WorkspaceKind): Entry[] {
  return Object.entries(workspace === "finance" ? financeSections : officeSections) as Entry[];
}
function sectionFromPath(pathname: string, workspace: WorkspaceKind) {
  const prefix = workspace === "finance" ? "/finance/" : "/office/";
  return pathname.startsWith(prefix) ? pathname.slice(prefix.length).split("/")[0] || "dashboard" : "dashboard";
}
function categoryOf(workspace: WorkspaceKind, slug: string, item: WorkspaceSection) {
  return workspace === "finance"
    ? financeCategory[item.group] ?? item.group
    : officeCategoryBySlug[slug] ?? (item.group === "My Work" ? "My work" : "Operations");
}
function CategoryIcon({ name }: { name: string }) {
  const Icon = iconByCategory[name as keyof typeof iconByCategory] ?? Folders;
  return <Icon aria-hidden="true" size={18}/>;
}
function IdentityCard({ identity }: { identity: OfficeIdentity }) {
  return <div className="office-compact-identity">
    <strong>{identity.founder ? "Founder" : identity.roles.join(" · ")}</strong>
    <small>{identity.email ?? "Verified Office identity"}</small>
    {identity.department ? <small>{identity.department}</small> : null}
  </div>;
}

export function OfficeWorkspaceShell({
  workspace, identity, permissions, delegatedDepartments = [], children,
}: {
  workspace: WorkspaceKind;
  identity: OfficeIdentity;
  permissions: readonly string[];
  delegatedDepartments?: readonly string[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileNav, setMobileNav] = useState(false);
  const [megaExpanded, setMegaExpanded] = useState(false);
  const [pickedCategory, setPickedCategory] = useState<string | null>(null);
  const [pickedSubgroup, setPickedSubgroup] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const [manualOutstanding, setManualOutstanding] = useState<number|null>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const definition = workspaceDefinitions[workspace];
  const sections = workspace === "finance" ? financeSections : officeSections;
  const section = sectionFromPath(pathname, workspace);
  const item = (sections as Record<string, WorkspaceSection>)[section];

  const entries = useMemo(() => sectionEntries(workspace).filter(([slug,value]) =>
    roleCanAccessSection(value, identity.roles) &&
    capabilityCanAccessSection(workspace, slug, identity.roles, permissions) &&
    (workspace !== "office" || !identity.roles.includes("OWNER") || founderNavigation.has(slug))),
    [workspace, identity.roles, permissions]);
  const categories = useMemo(() => {
    const order = workspace === "office" ? categoryOrder : financeOrder;
    return [...new Set(entries.map(([slug,value]) => categoryOf(workspace,slug,value)))]
      .sort((a,b) => order.indexOf(a) - order.indexOf(b));
  }, [entries, workspace]);
  const currentCategory = item ? categoryOf(workspace, section, item) : categories[0];
  const selectedCategory = pickedCategory && categories.includes(pickedCategory) ? pickedCategory : currentCategory;
  const links = entries.filter(([slug,value]) => categoryOf(workspace,slug,value) === selectedCategory);
  const subgroups = [...new Set(links.map(([,value]) => value.group))];
  const currentSubgroup = selectedCategory === currentCategory && item ? item.group : subgroups[0];
  const expandedSubgroup = pickedSubgroup ?? currentSubgroup;
  const commands = useMemo(() => navigationCommands(workspace,entries), [entries,workspace]);
  const prefetchedRoutes = useMemo(() => entries.map(([slug]) => definition.basePath + "/" + slug),
    [entries,definition.basePath]);

  const financeDelegated = identity.roles.includes("OWNER") && delegatedDepartments.includes("FINANCE");
  const switchWorkspace: WorkspaceKind = workspace === "office" ? "finance" : "office";
  const switchDashboard = switchWorkspace === "finance" ? financeSections.dashboard : officeSections.dashboard;
  const canSwitch = roleCanAccessWorkspace(switchWorkspace,identity.roles)
    && roleCanAccessSection(switchDashboard,identity.roles)
    && capabilityCanAccessSection(switchWorkspace,"dashboard",identity.roles,permissions)
    // Transferred Finance is Company Oversight, not a second Founder
    // operational workspace in the primary account rail.
    && !(workspace === "office" && switchWorkspace === "finance" && financeDelegated);

  useEffect(() => {
    let current = true;
    const sync = async () => {
      try {
        const response = await fetch("/api/office-manual", { cache: "no-store", credentials: "same-origin" });
        if (!response.ok) return;
        const result = await response.json() as {outstanding?:number};
        if (current && typeof result.outstanding === "number") setManualOutstanding(result.outstanding);
      } catch { /* Handbook is optional during database deployment. */ }
    };
    const onChange = (event:Event) => {
      const value = (event as CustomEvent<number>).detail;
      if (typeof value === "number") setManualOutstanding(value);
    };
    window.addEventListener("kravia-office-manual-state", onChange);
    void sync();
    return () => { current = false; window.removeEventListener("kravia-office-manual-state", onChange); };
  }, []);
  useEffect(() => {
    // Defer localStorage hydration to a frame; the SSR shell starts in light
    // mode and avoids cascading setState in a synchronous React effect.
    const frame = window.requestAnimationFrame(() => {
      try {
        const stored = window.localStorage.getItem(themeKey);
        setTheme(stored === "dark" || stored === "light" ? stored
          : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      } catch { setTheme("light"); }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setPickedCategory(null); setPickedSubgroup(null); setMobileNav(false); setMoreOpen(false);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);
  useEffect(() => {
    const themeHandler = (event: Event) => {
      const next = (event as CustomEvent<Theme>).detail;
      if (next === "light" || next === "dark") setTheme(next);
    };
    window.addEventListener("kravia-office-theme-change",themeHandler);
    return () => window.removeEventListener("kravia-office-theme-change",themeHandler);
  }, []);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setMobileNav(false); setMoreOpen(false); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") setMoreOpen(true);
    };
    document.addEventListener("keydown",handler);
    return () => document.removeEventListener("keydown",handler);
  }, []);
  useEffect(() => {
    if (!moreOpen) return;
    const outside = (event: MouseEvent) => {
      if (event.target instanceof Node && !moreRef.current?.contains(event.target)) setMoreOpen(false);
    };
    document.addEventListener("mousedown",outside);
    return () => document.removeEventListener("mousedown",outside);
  }, [moreOpen]);

  function switchTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try { window.localStorage.setItem(themeKey,next); } catch {}
    window.dispatchEvent(new CustomEvent("kravia-office-theme-change", { detail: next }));
  }

  const settingsHref = workspace === "finance" ? "/office/settings" : definition.basePath + "/settings";
  const canOpenSettings = workspace === "office" || canSwitch;

  const navId = workspace + "-workspace-mega-navigation";
  return <OfficeWorkspaceProvider identity={identity} permissions={permissions}>
    <main className={"office office-v2 office-v4 office-modern office-floating-rail workspace-shell workspace-" + workspace}
      data-ui-theme={theme} data-menu-expanded={megaExpanded}>
      <OfficeAmbientField variant="workspace" />
      <a className="office-skip-link" href="#office-main-content">Skip to main content</a>
      <OfficePrefetchRoutes hrefs={prefetchedRoutes}/>
      <button className="office-mobile-backdrop" type="button" aria-label="Close navigation"
        data-open={mobileNav} onClick={() => setMobileNav(false)}/>
      <aside className="office-mega-aside" data-mobile-open={mobileNav} data-menu-expanded={megaExpanded}>
        <div className="office-icon-rail">
          <OfficeNavLink href={definition.basePath + "/dashboard"} className="wordmark office-wordmark"
            aria-label={definition.label + " dashboard"}>
            <BrandLogo priority/>
            <span className="office-wordmark-unit">{workspace === "finance" ? "Finance" : "Office"}</span>
          </OfficeNavLink>
          <div className="office-rail-category-list" role="group" aria-label="Navigation categories">
            {categories.map(name => <button className="office-rail-category" type="button" key={name}
              title={name} aria-label={name} aria-expanded={selectedCategory === name && megaExpanded}
              data-active={selectedCategory === name}
              onClick={() => {
                if (selectedCategory === name && megaExpanded) setMegaExpanded(false);
                else { setPickedCategory(name); setPickedSubgroup(null); setMegaExpanded(true); }
              }}>
              <CategoryIcon name={name}/><span>{name}</span>
            </button>)}
          </div>
          <div className="office-sidebar-footer">
            {canOpenSettings ? <OfficeNavLink href={settingsHref} className="office-rail-action"
              aria-label="Office settings"><Settings size={18} aria-hidden="true"/></OfficeNavLink> : null}
            {canSwitch ? <OfficeNavLink href={"/" + switchWorkspace + "/dashboard"}
                className="office-rail-action"
                aria-label={"Open " + (switchWorkspace === "finance" ? "Finance" : "Office")}>
              <Landmark size={18} aria-hidden="true"/>
            </OfficeNavLink> : null}
            <button className="office-rail-action" type="button" onClick={switchTheme}
              aria-label={"Switch to " + (theme === "dark" ? "light" : "dark") + " theme"}
              title={theme === "dark" ? "Light theme" : "Dark theme"}>
              {theme === "dark" ? <Sun size={18}/> : <Moon size={18}/>}
            </button>
            <WorkspaceSignOutButton workspace={workspace} iconOnly/>
          </div>
        </div>
        <div className="office-mega-panel">
          <div className="office-menu-heading">
            <div><small>{workspace === "finance" ? "FINANCE" : "KRAVIA OFFICE"}</small>
              <strong>{selectedCategory}</strong></div>
            <button type="button" aria-label={megaExpanded ? "Collapse menu" : "Expand menu"}
              title={megaExpanded ? "Collapse menu" : "Expand menu"}
              onClick={() => setMegaExpanded(v => !v)}>
              {megaExpanded ? <PanelLeftClose size={17}/> : <PanelLeftOpen size={17}/>}
            </button>
            <button className="office-mobile-close" type="button" aria-label="Close menu"
              onClick={() => setMobileNav(false)}><X size={18}/></button>
          </div>
          <nav id={navId} className="office-category-links" aria-label={definition.label + " navigation"}>
            {subgroups.map(group => <details className="office-mega-subgroup" key={selectedCategory + ":" + group}
              open={expandedSubgroup === group}>
              <summary onClick={(event) => {
                event.preventDefault();
                setPickedSubgroup(expandedSubgroup === group ? "__CLOSED__" : group);
              }}><ChevronDown size={15}/>{group}</summary>
              <div className="office-mega-link-list">
                {links.filter(([,value]) => value.group === group).map(([slug,value]) => {
                  const Icon = iconBySlug[slug] ?? Folders;
                  return <OfficeNavLink key={slug} href={definition.basePath + "/" + slug}>
                    <Icon size={16} aria-hidden="true"/><span>{value.title}</span>
                    {slug === "info" && manualOutstanding !== null && manualOutstanding > 0 ? <small className="office-manual-sidebar-status" aria-label={manualOutstanding + " manuals pending"}>{manualOutstanding} pending</small> : null}
                    <ChevronRight size={12} aria-hidden="true"/>
                  </OfficeNavLink>;
                })}
              </div>
            </details>)}
            {workspace === "office" && identity.roles.includes("OWNER") &&
              selectedCategory === "Administration" ?
              <details className="office-mega-subgroup" open={expandedSubgroup === "Public content"}>
                <summary onClick={(event) => {
                  event.preventDefault();
                  setPickedSubgroup(expandedSubgroup === "Public content" ? "__CLOSED__" : "Public content");
                }}><ChevronDown size={15}/>Public content</summary>
                <div className="office-mega-link-list">
                  <OfficeNavLink href="/office/resource-publishing"><Folders size={16}/>Resource publishing</OfficeNavLink>
                  <OfficeNavLink href="/office/newsletters"><FileText size={16}/>Newsletter approvals</OfficeNavLink>
                </div>
              </details> : null}
          </nav>
          <div className="office-menu-identity"><IdentityCard identity={identity}/></div>
        </div>
      </aside>
      <section className="office-main" id="office-main-content" tabIndex={-1}>
        <header className="office-topbar office-topbar-compact">
          <button type="button" className="office-mobile-trigger"
            aria-controls={navId} aria-expanded={mobileNav}
            aria-label={mobileNav ? "Close Office menu" : "Open Office menu"}
            onClick={() => { setMegaExpanded(true); setMobileNav(v => !v); }}>
            {mobileNav ? <X size={18}/> : <Menu size={18}/>}
          </button>
          <nav className="office-breadcrumbs" aria-label="Breadcrumb">
            <OfficeNavLink href={definition.basePath + "/dashboard"}>{definition.label}</OfficeNavLink>
            <ChevronRight size={14} aria-hidden="true"/>
            <span>{currentCategory}</span>
            <ChevronRight size={14} aria-hidden="true"/>
            <strong aria-current="page">{item?.title ?? section}</strong>
          </nav>
          <div className="office-topbar-tools">
            <OfficeIstClock/>
            {workspace === "office" && identity.roles.some(role => role === "OWNER" || role === "DIRECTOR") ?
              <OfficeIntelligencePeek key={pathname}/> : null}
          <div className="office-more-wrapper" ref={moreRef}>
            <button type="button" className="office-more-button"
              aria-label="More workspace tools" aria-expanded={moreOpen}
              aria-controls="office-more-menu" title="Workspace tools"
              onClick={() => setMoreOpen(v => !v)}>
              <MoreHorizontal size={21} aria-hidden="true"/>
            </button>
            <div id="office-more-menu" className="office-more-card" data-open={moreOpen} aria-hidden={!moreOpen}>
              <div className="office-more-heading"><strong>Workspace tools</strong>
                <button type="button" onClick={() => setMoreOpen(false)}
                  aria-label="Close workspace tools"><X size={16}/></button></div>
              <OfficePresenceControl/>
              <OfficeCommandPalette commands={commands}/>
              <IdentityCard identity={identity}/>
              <div className="office-more-shortcuts">
                {canOpenSettings ? <OfficeNavLink href={settingsHref}><Cog size={15}/>Settings</OfficeNavLink> : null}
                <button type="button" onClick={switchTheme}>
                  {theme === "dark" ? <Sun size={15}/> : <Moon size={15}/>}
                  {theme === "dark" ? "Light theme" : "Dark theme"}
                </button>
              </div>
            </div>
          </div>
          </div>
        </header>
        {item ? <div className="office-notice office-compact-notice" title={item.description}>
          <ShieldCheck size={14} aria-hidden="true"/>
          <p>{item.description}</p>
        </div> : null}
        {financeDelegated && workspace === "finance" ? <aside className={delegatedStyles.banner} role="status" aria-label="Delegated Finance oversight">
          <div><Landmark size={18} aria-hidden="true"/><span>
            <strong>Finance · Read-only Founder oversight</strong>
            <small>Finance operations belong to the current department owner. Your former departmental approvals and edits are restricted.</small>
          </span></div>
          <OfficeNavLink href="/office/requests" className={delegatedStyles.request}>
            Raise a Finance request <ChevronRight size={15} aria-hidden="true"/>
          </OfficeNavLink>
        </aside> : null}
        {children}
      </section>
    </main>
  </OfficeWorkspaceProvider>;
}
