"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight, Bell, BookOpen, CalendarDays, ChevronRight, Fingerprint,
  KeyRound, LayoutDashboard, LockKeyhole, MailCheck, MonitorSmartphone,
  Moon, Search, Settings2, ShieldCheck, Sun, UserRound, Wallet, type LucideIcon,
} from "lucide-react";
import type { OfficeIdentity } from "@/lib/office/auth-server";
import {
  readConnectPreferences, saveConnectPreferences, readMotionMode, saveMotionMode,
  type ConnectPreferences,
} from "@/lib/office/connect-preferences";
import { OfficeSecuritySettings } from "@/components/office-security-settings";
import { OfficeConnectSettings } from "@/components/office-connect-settings";
import { OfficeEmployeeMailControls } from "@/components/office-employee-mail-controls";
import { OfficeLifecycleMailControls } from "@/components/office-lifecycle-mail-controls";
import styles from "./office-settings-hub.module.css";

type Tab = "overview" | "account" | "preferences" | "notifications" |
  "security" | "work" | "connect" | "owner" | "vault";
type SecurityPage = "devices" | "sessions" | "password" | "authenticator";
type Theme = "light" | "dark";
const preferenceKey = "kravia.office.appearance";
const densityKey = "kravia.office.density";
const sidebarKey = "kravia.office.sidebar.expanded";
const tabs: Array<{ id: Tab; label: string; icon: LucideIcon; ownerOnly?: boolean }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "account", label: "Account & employment", icon: UserRound },
  { id: "preferences", label: "Display & accessibility", icon: Settings2 },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security & devices", icon: ShieldCheck },
  { id: "work", label: "Work & pay", icon: Wallet },
  { id: "connect", label: "Connect", icon: MailCheck },
  { id: "owner", label: "Owner controls", icon: LockKeyhole, ownerOnly: true },
  { id: "vault", label: "Vault policy", icon: BookOpen },
];
function ActionRow({ title, detail, href, action = "Open" }: {
  title: string; detail: string; href: string; action?: string;
}) {
  return <div className={styles.actionRow}><span><strong>{title}</strong><small>{detail}</small></span>
    <Link href={href}>{action}<ArrowUpRight size={15} aria-hidden="true"/></Link></div>;
}
function Panel({ title, subtitle, children }: {
  title: string; subtitle?: string; children: React.ReactNode;
}) {
  return <section className={styles.panel}><header className={styles.panelHeader}>
    <h3>{title}</h3>{subtitle ? <p>{subtitle}</p> : null}</header>{children}</section>;
}
function Toggle({ title, detail, checked, onChange }: {
  title: string; detail: string; checked: boolean; onChange: (next: boolean) => void;
}) {
  return <label className={styles.toggleRow}><span><strong>{title}</strong><small>{detail}</small></span>
    <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)}/></label>;
}

export function OfficeSettingsHub({ identity }: { identity: OfficeIdentity }) {
  const isOwner = identity.roles.includes("OWNER");
  const isFinance = usePathname().startsWith("/finance/");
  const allowed = tabs.filter(item => (!item.ownerOnly || isOwner) && (!isFinance || ["overview", "account", "preferences", "security", "work"].includes(item.id)));
  const profileHref = isFinance ? "/finance/my-role" : "/office/my-role";
  const worktimeHref = isFinance ? "/finance/worktime" : "/office/worktime";
  const [tab, setTab] = useState<Tab>("overview");
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState<Theme>("light");
  const [compact, setCompact] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [personal, setPersonal] = useState<ConnectPreferences>({
    showUnread: true, showMentions: true,
  });
  const [securityPage, setSecurityPage] = useState<SecurityPage>("devices");
  const [ownerPage, setOwnerPage] = useState<"employee" | "lifecycle">("employee");
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const stored = window.localStorage.getItem(preferenceKey);
        setTheme(stored === "light" || stored === "dark" ? stored
          : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
        setCompact(window.localStorage.getItem(densityKey) === "compact");
        setSidebarExpanded(window.localStorage.getItem(sidebarKey) !== "closed");
        setPersonal(readConnectPreferences());
        setReducedMotion(readMotionMode() === "reduced");
      } catch { /* Optional local preferences can be unavailable in private mode. */ }
      const fromHash = window.location.hash.slice(1);
      const found = allowed.find(item => item.id === fromHash);
      if (found) setTab(found.id);
    });
    const onTheme = (event: Event) => {
      const value = (event as CustomEvent<Theme>).detail;
      if (value === "light" || value === "dark") setTheme(value);
    };
    window.addEventListener("kravia-office-theme-change", onTheme);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("kravia-office-theme-change", onTheme);
    };
  }, [isOwner]);
  function pick(next: Tab) {
    if (!allowed.some(item => item.id === next)) return;
    setTab(next);
    try { window.history.replaceState(null, "", window.location.pathname + "#" + next); } catch {}
  }
  function changeTheme(next: Theme) {
    setTheme(next);
    try { window.localStorage.setItem(preferenceKey, next); } catch {}
    window.dispatchEvent(new CustomEvent("kravia-office-theme-change", { detail: next }));
  }
  function changeDensity(next: boolean) {
    setCompact(next);
    try { window.localStorage.setItem(densityKey, next ? "compact" : "comfortable"); } catch {}
    window.dispatchEvent(new CustomEvent("kravia-office-density-change", {
      detail: next ? "compact" : "comfortable",
    }));
  }
  function changeMotion(next: boolean) {
    setReducedMotion(next);
    saveMotionMode(next ? "reduced" : "system");
  }
  function changeSidebar(next: boolean) {
    setSidebarExpanded(next);
    try { window.localStorage.setItem(sidebarKey, next ? "open" : "closed"); } catch {}
    window.dispatchEvent(new CustomEvent("kravia-office-sidebar-change", { detail: next }));
  }
  function changePersonal(key: "showUnread" | "showMentions", checked: boolean) {
    const next = { ...personal, [key]: checked };
    setPersonal(next);
    saveConnectPreferences(next);
  }
  const filtered = allowed.filter(item => item.label.toLowerCase().includes(query.trim().toLowerCase()));
  const active = allowed.find(item => item.id === tab) ?? allowed[0];
  const MemberIcon = active.icon;

  return <section className={styles.shell} aria-label="KRAVIA Office Settings" data-settings-scope>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>KRAVIA OFFICE / SETTINGS</p>
        <h1>{tab === "overview" ? "Settings" : active.label}</h1>
        <p>Personal preferences and governed controls. Permissions remain enforced by their source services.</p>
      </div>
      <div className={styles.themeWrap}><span>Theme</span>
        <div className={styles.themeSwitch} role="group" aria-label="Workspace theme">
          <button type="button" aria-pressed={theme === "light"} onClick={() => changeTheme("light")}>
            <Sun size={14} aria-hidden="true"/>Light</button>
          <button type="button" aria-pressed={theme === "dark"} onClick={() => changeTheme("dark")}>
            <Moon size={14} aria-hidden="true"/>Dark</button>
        </div>
      </div>
    </header>
    <div className={styles.mobileSelector}>
      <label htmlFor="office-settings-section">Settings section</label>
      <select id="office-settings-section" value={tab}
        onChange={event => pick(event.target.value as Tab)}>
        {allowed.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
    </div>
    <div className={styles.layout}>
      <nav className={styles.navigation} aria-label="Settings sections">
        <label className={styles.search}><Search size={15} aria-hidden="true"/>
          <input type="search" value={query} onChange={event => setQuery(event.target.value)}
            placeholder="Find settings" aria-label="Find settings sections"/></label>
        <div className={styles.navItems}>{filtered.map(item => {
          const Icon = item.icon;
          return <button type="button" key={item.id} aria-current={item.id === tab ? "page" : undefined}
            data-active={item.id === tab} onClick={() => pick(item.id)}>
            <Icon size={16} aria-hidden="true"/><span>{item.label}</span>
            <ChevronRight size={13} aria-hidden="true"/></button>;
        })}{filtered.length === 0 ? <p className={styles.emptyNav}>No matching section.</p> : null}</div>
        <p className={styles.navNote}>Source permissions and approved company policy always take precedence.</p>
      </nav>
      <div className={styles.content}>
        {tab === "overview" ? <div className={styles.columns}>
          <Panel title="Your account" subtitle="Verified identity and employment sources">
            <ActionRow title="Corporate identity" detail={identity.displayName || identity.email || "Office identity"}
              href={profileHref} action="View profile"/>
            <ActionRow title="Assigned roles" detail="Source-controlled, not editable in Settings"
              href={profileHref} action="Open roles"/>
            <ActionRow title="Attendance & salary" detail="Verified worktime and issued payslips"
              href={worktimeHref} action="Worktime"/>
            {!isFinance ? <ActionRow title="Notifications" detail="Approved company events and notices"
              href="/office/notifications" action="Inbox"/> : null}
          </Panel>
          <div className={styles.stack}>
            <Panel title="Quick preferences" subtitle="Actual local display controls">
              <Toggle title="Compact density" detail="Reduce repeated card spacing"
                checked={compact} onChange={changeDensity}/>
              <Toggle title="Keep context menu expanded" detail="Persist the navigation width on this device"
                checked={sidebarExpanded} onChange={changeSidebar}/>
              <Toggle title="Unread indicators" detail="Show unread markers in Connect"
                checked={personal.showUnread} onChange={next => changePersonal("showUnread", next)}/>
            </Panel>
            <Panel title="Security" subtitle="Current first-party Office session">
              <div className={styles.statusRow}><span>MFA assurance</span><strong>{identity.aal.toUpperCase()}</strong></div>
              <div className={styles.statusRow}><span>Trusted device bindings</span>
                <button type="button" onClick={() => { setSecurityPage("devices"); pick("security"); }}>Manage</button></div>
              <div className={styles.statusRow}><span>Other sessions</span>
                <button type="button" onClick={() => { setSecurityPage("sessions"); pick("security"); }}>Review</button></div>
            </Panel>
          </div>
        </div> : null}
        {tab === "account" ? <div className={styles.columns}>
          <Panel title="Verified corporate identity" subtitle="Read-only fields from the identity service">
            <dl className={styles.identity}>
              <div><dt>Name</dt><dd>{identity.displayName || "Not provided"}</dd></div>
              <div><dt>Email</dt><dd>{identity.email || "Not available"}</dd></div>
              <div><dt>Department</dt><dd>{identity.department || "Not assigned"}</dd></div>
              <div><dt>Authority</dt><dd>{identity.founder ? "Founder" : identity.roles.join(", ")}</dd></div>
              <div><dt>Authentication</dt><dd>{identity.aal.toUpperCase()}</dd></div>
            </dl>
          </Panel>
          <Panel title="Employment" subtitle="Use canonical records for updates">
            <ActionRow title="My roles" detail="Job scope and onboarding" href={profileHref}/>
            <ActionRow title="Work pattern" detail="Actual sessions and paid leave evidence" href={worktimeHref}/>
            <ActionRow title="Employee documents" detail="Approved records, signatures and evidence" href={profileHref}/>
            {!isFinance ? <ActionRow title="Request a correction" detail="Reviewed company workflow" href="/office/requests"/> : null}
          </Panel>
        </div> : null}
        {tab === "preferences" ? <div className={styles.columns}>
          <Panel title="Display & navigation" subtitle="Local preferences; no access changes">
            <Toggle title="Compact density" detail="Tighter work cards, tables and rows"
              checked={compact} onChange={changeDensity}/>
            <Toggle title="Expanded navigation" detail="Remember context menu state"
              checked={sidebarExpanded} onChange={changeSidebar}/>
            <div className={styles.helpRow}><strong>Appearance</strong>
              <small>Use the compact Light/Dark selector in this page header.</small></div>
          </Panel>
          <Panel title="Accessibility" subtitle="Reduce motion locally, then review identity-backed preferences if available">
            <Toggle title="Reduce interface motion" detail="Applied on this device immediately"
              checked={reducedMotion} onChange={changeMotion}/>
            {!isFinance ? <ActionRow title="Verified Connect preferences" detail="Save motion and notification consent to your Office identity"
              href="/office/chat/settings" action="Configure"/> : null}
            <div className={styles.helpRow}><strong>Keyboard access</strong>
              <small>Tab to navigate, Enter or Space to activate, Escape to close dialogs.</small></div>
          </Panel>
        </div> : null}
        {tab === "notifications" ? <div className={styles.stack}>
          <Panel title="Company notifications" subtitle="Source-owned event history">
            <ActionRow title="My notifications" detail="Read approved company notices" href="/office/notifications"
              action="Open inbox"/>
          </Panel>
          <OfficeConnectSettings embedded/>
        </div> : null}
        {tab === "security" ? <div className={styles.stack}>
          <div className={styles.subnav} role="group" aria-label="Security categories">
            {([
              ["devices", "Trusted devices", MonitorSmartphone],
              ["sessions", "Sessions", Fingerprint],
              ["password", "Password", KeyRound],
              ["authenticator", "Authenticator", ShieldCheck],
            ] as const).map(([id, label, Icon]) =>
              <button key={id} type="button" data-active={securityPage === id}
                aria-pressed={securityPage === id} onClick={() => setSecurityPage(id)}>
                <Icon size={15} aria-hidden="true"/>{label}</button>)}
          </div>
          <OfficeSecuritySettings identity={identity} view={securityPage}/>
        </div> : null}
        {tab === "work" ? <div className={styles.columns}>
          <Panel title="Work & salary" subtitle="Evidence-backed records only">
            <ActionRow title="Attendance & overtime" detail="Breaks, historical corrections, premium reviews"
              href={worktimeHref}/>
            <ActionRow title="Payslips" detail="Issued slips after payroll approval"
              href={worktimeHref} action="View slips"/>
            <ActionRow title="Employment record" detail="Your current approved role"
              href={profileHref}/>
          </Panel>
          <Panel title="Requests & decisions" subtitle="Permission checked at destination">
            <ActionRow title="Worktime correction" detail="Submit genuine time evidence"
              href={worktimeHref} action="Open worktime"/>
            {!isFinance ? <><ActionRow title="Approvals" detail="Independent reviews; no self-approval"
              href="/office/approvals"/>
            <ActionRow title="Calendar" detail="Company events and deadlines"
              href="/office/calendar"/></> : null}
          </Panel>
        </div> : null}
        {tab === "connect" ? <div className={styles.columns}>
          <Panel title="Connect preferences" subtitle="Personal preferences are not delivery authorization">
            <ActionRow title="Notification consent" detail="Messages, mentions and digest choices"
              href="/office/chat/settings" action="Manage"/>
            <Toggle title="Unread indicators" detail="Device-local"
              checked={personal.showUnread} onChange={next => changePersonal("showUnread", next)}/>
            <Toggle title="Mentions shortcut" detail="Device-local"
              checked={personal.showMentions} onChange={next => changePersonal("showMentions", next)}/>
          </Panel>
          <Panel title="Communication links" subtitle="Existing access boundaries remain">
            <ActionRow title="Conversations" detail="Secure messages and shared files"
              href="/office/chat" action="Open Connect"/>
            <ActionRow title="Notifications" detail="Assigned updates and mentions"
              href="/office/notifications"/>
            <ActionRow title="Privacy governance" detail="Source-scoped privacy requests"
              href="/office/privacy"/>
          </Panel>
        </div> : null}
        {tab === "owner" && isOwner ? <div className={styles.stack}>
          <div className={styles.subnav} role="group" aria-label="Corporate mail policy views">
            <button type="button" data-active={ownerPage === "employee"}
              aria-pressed={ownerPage === "employee"} onClick={() => setOwnerPage("employee")}>
              Employee ID notices</button>
            <button type="button" data-active={ownerPage === "lifecycle"}
              aria-pressed={ownerPage === "lifecycle"} onClick={() => setOwnerPage("lifecycle")}>
              Lifecycle notification events</button>
          </div>
          {ownerPage === "employee" ? <OfficeEmployeeMailControls/> : <OfficeLifecycleMailControls/>}
          <Panel title="Company governance" subtitle="Actions require independent approval">
            <ActionRow title="Access administration" detail="Review roles and privileges"
              href="/office/access"/>
            <ActionRow title="Audit trail" detail="Immutable source-backed history"
              href="/office/audit"/>
          </Panel>
        </div> : null}
        {tab === "vault" ? <div className={styles.columns}>
          <Panel title="K-Vault policy sources" subtitle="Only permission-scoped records are exposed">
            <ActionRow title="Classification & retention" detail="Requires Vault policy capability"
              href="/office/k-vault/settings" action="Review"/>
            <ActionRow title="Access requests" detail="Request specific resource access"
              href="/office/k-vault/requests"/>
            <ActionRow title="Vault activity" detail="Personal source-scoped audit"
              href="/office/k-vault/activity"/>
          </Panel>
          <Panel title="Authoritative systems" subtitle="Settings never bypass source controls">
            <ActionRow title="Privacy rules" detail="Retention and legal holds" href="/office/privacy"/>
            <ActionRow title="Registrations" detail="Verified company registry" href="/office/registrations"/>
            <ActionRow title="Document Studio" detail="Signed evidence and originals" href="/office/documents"/>
          </Panel>
        </div> : null}
        <footer className={styles.footnote}><MemberIcon size={15} aria-hidden="true"/>
          Appearance and preference changes cannot grant company authority.</footer>
      </div>
    </div>
  </section>;
}
