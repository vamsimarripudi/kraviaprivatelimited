"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Building2, FilePenLine, LayoutDashboard, MessagesSquare, RadioTower, Settings2, ShieldCheck } from "lucide-react";
import type { CorporateActor } from "@/lib/corporate/authorization";
import { hasCapability, type Capability } from "@/lib/corporate/permissions";

const navigation = [
  { href: "/admin", label: "Command center", Icon: LayoutDashboard },
  { href: "/admin/newsroom", label: "Content & newsroom", Icon: FilePenLine, capability: "content.view" as Capability },
  { href: "/admin/company", label: "Company facts", Icon: Building2, capability: "content.facts.manage" as Capability },
  { href: "/admin/forms", label: "Forms & requests", Icon: MessagesSquare, capability: "support.view" as Capability },
  { href: "/admin/monitoring", label: "Monitoring", Icon: Activity },
];

export function AdminConsole({ actor, children }: { actor: CorporateActor; children: ReactNode }) {
  const pathname = usePathname();
  return <main className="admin-console">
    <aside className="admin-rail">
      <Link className="admin-wordmark" href="/admin" aria-label="Kravia Site Control">
        <span>KRAVIA</span><small>SITE CONTROL</small>
      </Link>
      <nav aria-label="Site control navigation">
        {navigation.filter((item) => !item.capability || hasCapability(actor.role, item.capability)).map(({ href, label, Icon }) => <Link key={href} href={href} aria-current={href === "/admin" ? pathname === href ? "page" : undefined : pathname.startsWith(href) ? "page" : undefined}><Icon aria-hidden="true" />{label}</Link>)}
      </nav>
      <div className="admin-rail-foot"><ShieldCheck aria-hidden="true" /><p>Protected operating surface.<br />All changes are role-checked and audited.</p></div>
    </aside>
    <section className="admin-main">
      <header className="admin-topbar"><div><p className="eyebrow">KRAVIA PRIVATE LIMITED</p><strong>Website operations</strong></div><Link className="admin-identity" href="/corporate/settings"><span>{actor.role.replaceAll("_", " ")}</span><small>{actor.email ?? "Verified identity"}</small></Link></header>
      {children}
    </section>
  </main>;
}

export function AdminPageHeader({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children?: ReactNode }) {
  return <header className="admin-page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{intro}</p></div>{children ? <div className="admin-page-header-actions">{children}</div> : null}</header>;
}

export function AdminControlLink({ href, label, detail, Icon = Settings2 }: { href: string; label: string; detail: string; Icon?: typeof Settings2 }) {
  return <Link className="admin-control-link" href={href}><Icon aria-hidden="true" /><div><strong>{label}</strong><span>{detail}</span></div></Link>;
}

export function AdminLiveBadge({ live, label }: { live: boolean; label: string }) {
  return <span className={`admin-live-badge ${live ? "is-live" : "is-paused"}`}><RadioTower aria-hidden="true" />{label}</span>;
}
