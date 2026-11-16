"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRightLeft, BookOpen, BriefcaseBusiness, Building2, CalendarDays, ChevronDown, ChevronRight,
  ClipboardCheck, Cog, FileText, Folders, GitBranch, Landmark,
  LayoutDashboard, Menu, MessageSquareText, Moon, MoreHorizontal, PanelLeftClose,
  PanelLeftOpen, Scale, Settings, ShieldCheck, Sun, Users, Vault, Wallet, X,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { OfficeNavLink } from "@/components/office-nav-link";
import { OfficePrefetchRoutes } from "@/components/office-prefetch-routes";
import { OfficeChatOnlineHeartbeat } from "@/components/office-chat-online-heartbeat";
import { OfficePresenceControl } from "@/components/office-presence-control";
import { OfficeCommandPalette } from "@/components/office-command-palette";
import { OfficeNotificationHub } from "@/components/office-notification-hub";
import { OfficeIntelligencePeek } from "@/components/office-intelligence-peek";
import { OfficeIstClock } from "@/components/office-ist-clock";
import { WorkspaceSignOutButton } from "@/components/workspace-sign-out-button";
import { OfficeWorkspaceProvider } from "@/components/office-workspace-context";
import { OfficeAmbientField } from "@/components/office-experience-ambient";
import delegatedStyles from "./office-delegation-banner.module.css";
import type { OfficeIdentity } from "@/lib/office/auth-server";
import {officeAssignedDepartmentCodes,officeClientSectionVisible,
 officeClientCategoryForSection,officeDepartmentForSection,officeDepartmentLabel,
 type OfficeDepartmentOwnershipSnapshot,
} from "@/lib/office/client-department-navigation";
import {
  capabilityCanAccessSection, navigationCommands,
} from "@/lib/office/workspace-capabilities";
import {
  financeSections, officeSections, roleCanAccessSection, roleCanAccessWorkspace,
  workspaceDefinitions, type WorkspaceKind, type WorkspaceSection,
} from "@/lib/office/workspaces";

const iconByCategory = {
  "My work": LayoutDashboard, Connect: MessageSquareText, "K-Vault": Vault, HR: Users, People: Users, Engineering: GitBranch,
  Commercial: BriefcaseBusiness, Operations: Building2, Finance: Landmark,
  Governance: Scale, Administration: ShieldCheck, Overview: LayoutDashboard,
  Revenue: Wallet, Treasury: Landmark, Tax: FileText, Books: FileText,
  Payables: ClipboardCheck, Evidence: ShieldCheck,
} as const;

const officeCategoryBySlug: Record<string, string> = {
  dashboard:"My work", "my-role":"My work", "my-transfers":"My work", info:"My work", notifications:"My work",
  tasks:"My work",calendar:"My work",requests:"My work",approvals:"My work",
  // HR operations are a visible department, not hidden among personal people tools.
  manager:"People",recruitment:"HR",people:"HR",emergency:"People",
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
  "My work","HR","People","Engineering","Commercial","Operations",
  "Finance","Governance","Administration",
];
// Short visible category labels only on narrow mobile rails; the full names remain
// available through each button's aria-label and in the contextual navigation.
const mobileCategoryLabels: Record<string, string> = {
  "My work": "Work", HR: "HR", People: "People", Connect: "Chat",
  Engineering: "Build", "K-Vault": "Vault", Commercial: "Sales",
  Operations: "Ops", Finance: "Finance", Governance: "Govern",
  Administration: "Admin", Overview: "Home", Revenue: "Revenue",
  Treasury: "Treasury", Payables: "Pay", Tax: "Tax", Books: "Books",
  Evidence: "Evidence",
};
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
const densityKey = "kravia.office.density";
const sidebarKey = "kravia.office.sidebar.expanded";
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
  const router = useRouter();
  const [mobileNav, setMobileNav] = useState(false);
  const [megaExpanded, setMegaExpanded] = useState(true);
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [pickedCategory, setPickedCategory] = useState<string | null>(null);
  const [pickedSubgroup, setPickedSubgroup] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const [manualOutstanding, setManualOutstanding] = useState<number|null>(null);
  const [departmentLoad,setDepartmentLoad]=useState<"loading"|"ready"|"error">("loading");
  const [loadedActor,setLoadedActor]=useState<string|null>(null);
  const [assignedCodes,setAssignedCodes]=useState<string[]>([]);
  const [selectedDepartmentCode,setSelectedDepartmentCode]=useState<string|null>(null);
  const [departmentRevision,setDepartmentRevision]=useState(0);
  const moreRef = useRef<HTMLDivElement>(null);
  const definition = workspaceDefinitions[workspace];
  const sections = workspace === "finance" ? financeSections : officeSections;
  const section = sectionFromPath(pathname, workspace);
  const item = (sections as Record<string, WorkspaceSection>)[section];
  const isConnect = workspace === "office" && (pathname === "/office/chat" || pathname.startsWith("/office/chat/"));
  const isVault = workspace === "office" && (pathname === "/office/k-vault" || pathname.startsWith("/office/k-vault/"));
  const isChatConversation = isConnect && /^\/office\/chat\/(?:dm|groups|channels|threads)\//.test(pathname);
  // Do not infer K-Vault entry from Finance, Director, Admin or document capabilities.
  const vaultEntry = workspace === "office" && permissions.includes("vault.entry");

  // Client-side navigation only. Existing APIs enforce record permissions.
  const isFounder=identity.roles.includes("OWNER");
  const allowedEntries=sectionEntries(workspace).filter(([slug,value]) =>
    roleCanAccessSection(value, identity.roles) &&
    capabilityCanAccessSection(workspace, slug, identity.roles, permissions) &&
    (workspace !== "office" || !identity.roles.includes("OWNER") || founderNavigation.has(slug)));

  const currentRouteDepartment=workspace==="office"?officeDepartmentForSection(section):null;
  const primaryDepartment=(identity.department??"").toUpperCase();
  const activeDepartment=departmentLoad==="ready"&&loadedActor===identity.userId
    ? (currentRouteDepartment&&assignedCodes.includes(currentRouteDepartment)
      ? currentRouteDepartment
      : selectedDepartmentCode&&assignedCodes.includes(selectedDepartmentCode)
        ? selectedDepartmentCode
        : assignedCodes.includes(primaryDepartment)?primaryDepartment:assignedCodes[0]??null)
    : null;
  const entries=allowedEntries.filter(([slug]) =>
    workspace!=="office"||officeClientSectionVisible(slug,activeDepartment?[activeDepartment]:[],isFounder));
  const categoryForEntry=(slug:string,value:WorkspaceSection) =>
    workspace==="office"?officeClientCategoryForSection(slug,isFounder):categoryOf(workspace,slug,value);
  const categories=(() => {
    const order=workspace==="office"
      ? ["My work",...(activeDepartment?[officeDepartmentLabel(activeDepartment)]:[]),
         "Connect","K-Vault","Company control",...categoryOrder]
      : financeOrder;
    const labels=entries.map(([slug,value])=>categoryForEntry(slug,value));
    if(workspace==="office"){
      labels.push("My work","Connect");
      if(activeDepartment)labels.push(officeDepartmentLabel(activeDepartment));
    }
    if(vaultEntry)labels.push("K-Vault");
    return [...new Set(labels)].sort((a,b)=>{
      const rank=(label:string)=>order.includes(label)?order.indexOf(label):order.length;
      return rank(a)-rank(b);
    });
  })();
  const currentCategory=isConnect?"Connect":isVault?"K-Vault":
    item?categoryForEntry(section,item):"My work";
  const selectedCategory=pickedCategory&&categories.includes(pickedCategory)?pickedCategory:
    categories.includes(currentCategory)?currentCategory:"My work";
  const links=entries.filter(([slug,value])=>categoryForEntry(slug,value)===selectedCategory);
  const subgroups = [...new Set(links.map(([,value]) => value.group))];
  const currentSubgroup = selectedCategory === currentCategory && item ? item.group : subgroups[0];
  const expandedSubgroup = pickedSubgroup ?? currentSubgroup;
  const commands = navigationCommands(workspace,entries);
  const prefetchedRoutes = entries.map(([slug]) => definition.basePath + "/" + slug);

  const financeDelegated = identity.roles.includes("OWNER") && delegatedDepartments.includes("FINANCE");
  const switchWorkspace: WorkspaceKind = workspace === "office" ? "finance" : "office";
  const switchDashboard = switchWorkspace === "finance" ? financeSections.dashboard : officeSections.dashboard;
  const canSwitch = roleCanAccessWorkspace(switchWorkspace,identity.roles)
    && roleCanAccessSection(switchDashboard,identity.roles)
    && capabilityCanAccessSection(switchWorkspace,"dashboard",identity.roles,permissions)
    && !(workspace === "office" && switchWorkspace === "finance" && financeDelegated)
    && (workspace!=="office"||(departmentLoad==="ready"&&assignedCodes.includes("FINANCE")));

  useEffect(()=>{
    if(workspace!=="office")return;
    const controller=new AbortController();
    void fetch("/api/office-departments",{
      credentials:"same-origin",cache:"no-store",signal:controller.signal,
    }).then(async response=>{
      if(!response.ok)throw new Error("Department assignments unavailable");
      const snapshot=await response.json() as OfficeDepartmentOwnershipSnapshot;
      if(controller.signal.aborted)return;
      const next=officeAssignedDepartmentCodes(snapshot,identity.userId,identity.department);
      setAssignedCodes(next);
      setLoadedActor(identity.userId);
      setDepartmentLoad("ready");
    }).catch(()=>{
      if(controller.signal.aborted)return;
      setAssignedCodes([]);
      setLoadedActor(null);
      setDepartmentLoad("error");
    });
    return()=>controller.abort();
  },[workspace,identity.userId,identity.department,departmentRevision]);
  useEffect(()=>{
    if(workspace!=="office")return;
    const refresh=()=>setDepartmentRevision(v=>v+1);
    window.addEventListener("focus",refresh);
    window.addEventListener("kravia-office-departments-changed",refresh);
    return()=>{
      window.removeEventListener("focus",refresh);
      window.removeEventListener("kravia-office-departments-changed",refresh);
    };
  },[workspace]);
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
      // The command palette owns Ctrl/Cmd+K; do not also open the overflow menu.
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

  useEffect(() => {
    const openMobileNavigation = () => {
      setMegaExpanded(true);
      setMobileNav(true);
    };
    window.addEventListener("kravia-office-open-navigation", openMobileNavigation);
    return () => window.removeEventListener("kravia-office-open-navigation", openMobileNavigation);
  }, []);

  function switchTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try { window.localStorage.setItem(themeKey,next); } catch {}
    window.dispatchEvent(new CustomEvent("kravia-office-theme-change", { detail: next }));
  }

  function switchActiveDepartment(next:string){
    if(!assignedCodes.includes(next)||departmentLoad!=="ready")return;
    setSelectedDepartmentCode(next);
    setPickedCategory(officeDepartmentLabel(next));
    setPickedSubgroup(null);
    setMobileNav(false);
    const first=allowedEntries.find(([slug])=>officeDepartmentForSection(slug)===next);
    if(first)router.push("/office/"+first[0]);
    else router.push("/office/dashboard");
  }
  const blockedClientSection=workspace==="office"&&Boolean(item)&&
    !entries.some(([slug])=>slug===section);
  const activePageTitle = isConnect ? "My Chats" : isVault ? "K-Vault" : item?.title ?? section;
  const settingsHref = workspace === "finance" ? "/office/settings" : definition.basePath + "/settings";
  const canOpenSettings = workspace === "office" || canSwitch;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        setDensity(window.localStorage.getItem(densityKey) === "compact" ? "compact" : "comfortable");
        setMegaExpanded(window.localStorage.getItem(sidebarKey) !== "closed");
      } catch { /* Personal display preferences are optional. */ }
    });
    const onDensity = (event: Event) => {
      const next = (event as CustomEvent<"comfortable" | "compact">).detail;
      if (next === "comfortable" || next === "compact") setDensity(next);
    };
    const onSidebar = (event: Event) => {
      const next = (event as CustomEvent<boolean>).detail;
      if (typeof next === "boolean") setMegaExpanded(next);
    };
    window.addEventListener("kravia-office-density-change", onDensity);
    window.addEventListener("kravia-office-sidebar-change", onSidebar);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("kravia-office-density-change", onDensity);
      window.removeEventListener("kravia-office-sidebar-change", onSidebar);
    };
  }, []);
  function changeSidebar(next: boolean) {
    setMegaExpanded(next);
    try { window.localStorage.setItem(sidebarKey, next ? "open" : "closed"); } catch {}
    window.dispatchEvent(new CustomEvent("kravia-office-sidebar-change", { detail: next }));
  }

  const navId = workspace + "-workspace-mega-navigation";
  const departmentReady=departmentLoad==="ready"&&loadedActor===identity.userId;
  const currentDepartments=departmentReady?assignedCodes:[];
  return <OfficeWorkspaceProvider identity={identity} permissions={permissions}>
    <main className={"office office-v2 office-v4 office-modern office-floating-rail workspace-shell workspace-" + workspace}
      data-ui-theme={theme} data-density={density} data-menu-expanded={megaExpanded} data-chat-conversation={isChatConversation}
      data-connect-home={workspace === "office" && pathname === "/office/chat"}>
      <OfficeAmbientField variant="workspace" />
      <a className="office-skip-link" href="#office-main-content">Skip to main content</a>
      <OfficePrefetchRoutes hrefs={prefetchedRoutes}/>
      <OfficeChatOnlineHeartbeat/>
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
              onPointerEnter={()=>{if(name==="K-Vault")router.prefetch("/office/k-vault");}}
              onFocus={()=>{if(name==="K-Vault")router.prefetch("/office/k-vault");}}
              onClick={() => {
                // Do not collapse the contextual panel inside an open mobile drawer.
                // That made the drawer appear blank after tapping the active category.
                if (window.matchMedia("(max-width: 767px)").matches) {
                  setPickedCategory(name); setPickedSubgroup(null); changeSidebar(true);
                } else if (selectedCategory === name && megaExpanded) {
                  changeSidebar(false);
                } else {
                  setPickedCategory(name); setPickedSubgroup(null); changeSidebar(true);
                }
              }}>
              <CategoryIcon name={name}/>
              <span className="office-category-full-label">{name}</span>
              <span className="office-category-compact-label" aria-hidden="true">{mobileCategoryLabels[name] ?? name}</span>
            </button>)}
          </div>
          <div className="office-sidebar-footer">
            {canOpenSettings ? <OfficeNavLink href={settingsHref} className="office-rail-action"
              aria-label="Office settings" title="Office settings"><Settings size={18} aria-hidden="true"/></OfficeNavLink> : null}
            {canSwitch ? <OfficeNavLink href={"/" + switchWorkspace + "/dashboard"}
                className="office-rail-action"
                aria-label={"Open " + (switchWorkspace === "finance" ? "Finance" : "Office")}
                title={"Switch to " + (switchWorkspace === "finance" ? "Finance" : "Office")}>
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
              onClick={() => changeSidebar(!megaExpanded)}>
              {megaExpanded ? <PanelLeftClose size={17}/> : <PanelLeftOpen size={17}/>}
            </button>
            <button className="office-mobile-close" type="button" aria-label="Close menu"
              onClick={() => setMobileNav(false)}><X size={18}/></button>
          </div>
          {workspace==="office"?<div className="office-client-department-picker" data-office-client-departments>
             <span>ASSIGNED DEPARTMENT</span>
             {!departmentReady&&departmentLoad!=="error"?<small role="status">Loading assignment…</small>:
             departmentLoad==="error"?<button type="button"
               onClick={()=>{setDepartmentLoad("loading");setDepartmentRevision(v=>v+1);}}>
               Department list unavailable · Retry
             </button>:
             currentDepartments.length>1?<select aria-label="Switch assigned department"
               value={activeDepartment??""} onChange={event=>switchActiveDepartment(event.target.value)}>
               {currentDepartments.map(code=><option key={code} value={code}>{officeDepartmentLabel(code)}</option>)}
             </select>:
             <strong>{activeDepartment?officeDepartmentLabel(activeDepartment):"Personal workspace"}</strong>}
           </div>:null}
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
            {workspace === "office" && selectedCategory === "HR" ? <>
              {identity.roles.includes("HR") && !entries.some(([slug])=>slug==="people") ?
                <p className="office-hr-nav-note" role="status">
                  Employee records unavailable in this session. Check device approval and permissions.
                </p> : null}
              {entries.some(([slug])=>slug==="payroll"||slug==="development") ?
                <div className="office-mega-link-list" data-office-hr-shortcuts>
                  {entries.some(([slug])=>slug==="payroll") ?
                    <OfficeNavLink href="/office/payroll"><Wallet size={16}/>Payroll OS</OfficeNavLink> : null}
                  {entries.some(([slug])=>slug==="development") ?
                    <OfficeNavLink href="/office/development"><Users size={16}/>People development</OfficeNavLink> : null}
                </div> : null}
            </> : null}
            {workspace === "office" && selectedCategory === "Connect" ?
              <div className="office-mega-link-list" data-office5-quick-links>
                <OfficeNavLink href="/office/chat"><MessageSquareText size={16}/>My Chats</OfficeNavLink>
                
                
                
              </div> : null}
            {workspace === "office" && selectedCategory === "K-Vault" && vaultEntry ?
              <div className="office-mega-link-list" data-office5-quick-links>
                <OfficeNavLink href="/office/k-vault"><Vault size={16}/>Overview</OfficeNavLink>
                <OfficeNavLink href="/office/k-vault/categories"><Folders size={16}/>Categories</OfficeNavLink>
                <OfficeNavLink href="/office/k-vault/documents"><FileText size={16}/>Documents</OfficeNavLink>
                <OfficeNavLink href="/office/k-vault/requests"><ShieldCheck size={16}/>Access requests</OfficeNavLink>
              </div> : null}
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
            onClick={() => { changeSidebar(true); setMobileNav(v => !v); }}>
            {mobileNav ? <X size={18}/> : <Menu size={18}/>}
          </button>
          <nav className="office-breadcrumbs" aria-label="Breadcrumb">
            <OfficeNavLink href={definition.basePath + "/dashboard"}>{definition.label}</OfficeNavLink>
            <ChevronRight size={14} aria-hidden="true"/>
            <span>{currentCategory}</span>
            <ChevronRight size={14} aria-hidden="true"/>
            <strong aria-current="page">{activePageTitle}</strong>
          </nav>
          <div className="office-topbar-tools">
            <OfficeCommandPalette commands={commands}/>
            <OfficeNotificationHub/>
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
            <small>Finance operations belong to the current department owner. Former departmental approvals and edits remain restricted.</small>
          </span></div>
          <OfficeNavLink href="/office/requests" className={delegatedStyles.request}>
            Raise a Finance request <ChevronRight size={15} aria-hidden="true"/>
          </OfficeNavLink>
        </aside> : null}
        {blockedClientSection?<div className="office-client-department-state" role="status"
           data-office-client-department-guard>
           <ShieldCheck size={24} aria-hidden="true"/>
           <strong>{departmentLoad==="error"?"Department assignment unavailable":
             !departmentReady?"Loading assigned workspace":"Not in your active department"}</strong>
           <p>{departmentLoad==="error"?
             "Refresh department assignments to restore your navigation.":
             !departmentReady?"Checking the departments assigned to your Office account.":
             "Switch to an assigned department or open My Work. This screen is not part of your selected workspace."}</p>
           {departmentLoad==="error"?<button type="button"
             onClick={()=>{setDepartmentLoad("loading");setDepartmentRevision(v=>v+1);}}>
             Retry department list
           </button>:<OfficeNavLink href="/office/dashboard">My Work</OfficeNavLink>}
         </div>:children}
      </section>
      <nav className="office5-mobile-dock" aria-label="Office mobile navigation">
        <OfficeNavLink href={definition.basePath + "/dashboard"}><LayoutDashboard size={18} aria-hidden="true"/><span>Home</span></OfficeNavLink>
        {workspace === "office" ? <OfficeNavLink href="/office/chat"><MessageSquareText size={18} aria-hidden="true"/><span>Connect</span></OfficeNavLink> : null}
        {vaultEntry ? <OfficeNavLink href="/office/k-vault"><Vault size={18} aria-hidden="true"/><span>Vault</span></OfficeNavLink> : null}
        <button type="button" onClick={() => { changeSidebar(true); setMobileNav(true); }} aria-label="Open more navigation"><Menu size={18} aria-hidden="true"/><span>More</span></button>
      </nav>
    </main>
  </OfficeWorkspaceProvider>;
}
