"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, Fingerprint, MailCheck, Moon, ShieldCheck, Sun, UserRound, Users, Wallet } from "lucide-react";
import type { OfficeIdentity } from "@/lib/office/auth-server";
import { OfficeSecuritySettings } from "@/components/office-security-settings";
import { OfficeEmployeeMailControls } from "@/components/office-employee-mail-controls";
import styles from "./office-settings-hub.module.css";

type View = "account" | "appearance" | "security" | "communications";
type Theme = "light" | "dark";
const preferenceKey = "kravia.office.appearance";

export function OfficeSettingsHub({ identity }: { identity: OfficeIdentity }) {
  const [view, setView] = useState<View>("account");
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const stored = window.localStorage.getItem(preferenceKey);
        setTheme(stored === "dark" ? "dark" : "light");
      } catch { setTheme("light"); }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function changeTheme(next: Theme) {
    setTheme(next);
    try { window.localStorage.setItem(preferenceKey, next); } catch {}
    window.dispatchEvent(new CustomEvent("kravia-office-theme-change", { detail: next }));
  }

  return <section className={styles.shell}>
    <header className={styles.header}>
      <span className={styles.eyebrow}>KRAVIA OFFICE · PREFERENCES</span>
      <h2>Account & settings</h2>
      <p>Personal workspace appearance and real security controls. Your identity, company roles and access rights are governed separately.</p>
    </header>

    <nav className={styles.tabs} aria-label="Office settings">
      <button type="button" data-active={view === "account"} onClick={() => setView("account")}><UserRound size={17}/>Account</button>
      <button type="button" data-active={view === "appearance"} onClick={() => setView("appearance")}><Sun size={17}/>Appearance</button>
      <button type="button" data-active={view === "security"} onClick={() => setView("security")}><ShieldCheck size={17}/>Security & devices</button>
      {identity.roles.includes("OWNER") ?
        <button type="button" data-active={view === "communications"} onClick={() => setView("communications")}>
          <MailCheck size={17}/>Employee communications
        </button> : null}
    </nav>

    {view === "account" ? <div className={styles.grid}>
      <article className={styles.card}>
        <div className={styles.cardTitle}><UserRound size={20}/><h3>Verified Office profile</h3></div>
        <div className={styles.avatar}>{(identity.email || "KR").slice(0, 2).toUpperCase()}</div>
        <dl className={styles.details}>
          <div><dt>Corporate email</dt><dd>{identity.email ?? "Unavailable in current session"}</dd></div>
          <div><dt>Department</dt><dd>{identity.department ?? "Not yet assigned"}</dd></div>
          <div><dt>Account status</dt><dd>Verified session · {identity.aal.toUpperCase()}</dd></div>
          <div><dt>Company authority</dt><dd>{identity.founder ? "Founder" : identity.roles.join(", ")}</dd></div>
        </dl>
        <p>Profile details are taken from the official Office identity and assignment records. A job title or legal designation cannot be edited here to grant permissions.</p>
        <div className={styles.links}>
          <Link href="/office/my-role"><Users size={16}/>My roles & onboarding</Link>
          <Link href="/office/worktime"><Wallet size={16}/>Attendance & payslips</Link>
        </div>
      </article>
      <article className={styles.card}>
        <div className={styles.cardTitle}><Bell size={20}/><h3>Notifications and preferences</h3></div>
        <p>Company notifications, personal task alerts and account-security information use the existing governed systems.</p>
        <div className={styles.links}><Link href="/office/notifications"><Bell size={16}/>Open notifications</Link></div>
        <div className={styles.cardTitle}><Fingerprint size={20}/><h3>Sign-in protection</h3></div>
        <p>Your second factor, login sessions and registered company-managed devices can be reviewed in Security & devices.</p>
        <button type="button" onClick={() => setView("security")}>Manage security</button>
      </article>
    </div> : null}

    {view === "appearance" ? <div className={styles.card}>
      <div className={styles.cardTitle}><Sun size={20}/><h3>Workspace colour theme</h3></div>
      <p>The selected theme applies to KRAVIA Office and Finance only. It is stored on this device and never changes the public website.</p>
      <div className={styles.themeGrid}>
        <button type="button" aria-pressed={theme === "light"} data-active={theme === "light"} onClick={() => changeTheme("light")}>
          <Sun size={23}/><strong>Light</strong><small>Bright surfaces and clean contrast</small>
        </button>
        <button type="button" aria-pressed={theme === "dark"} data-active={theme === "dark"} onClick={() => changeTheme("dark")}>
          <Moon size={23}/><strong>Dark</strong><small>Low-glare workspace surfaces</small>
        </button>
      </div>
    </div> : null}

    {view === "security" ? <OfficeSecuritySettings identity={identity}/> : null}
    {view === "communications" && identity.roles.includes("OWNER") ?
      <OfficeEmployeeMailControls/> : null}
  </section>;
}
