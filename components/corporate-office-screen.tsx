import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, FileLock2, ShieldCheck, TriangleAlert } from "lucide-react";
import { officeNavigation, officeSections, type OfficeSection } from "@/lib/corporate/office";
import { hasCapability, type CorporateRole } from "@/lib/corporate/permissions";
import { CorporateActivityBeacon } from "@/components/corporate-activity-beacon";

type Props = { section: OfficeSection; email?: string; role?: CorporateRole; children?: ReactNode };

export function CorporateOfficeScreen({ section, email, role, children }: Props) {
  const item = officeSections[section];
  const permitted = role ? hasCapability(role, item.capability) : false;
  return <main className="office office-v2"><CorporateActivityBeacon /><aside><Link href="/corporate/dashboard" className="wordmark" aria-label="Kravia Corporate Office"><span>KRAVIA</span><span>CORPORATE OFFICE</span></Link><nav aria-label="Corporate navigation">{officeNavigation.map((entry) => <Link key={entry.slug} href={`/corporate/${entry.slug}`} aria-current={entry.slug === section ? "page" : undefined}>{entry.title}</Link>)}</nav><p className="office-side-note">Private surface<br />No public indexing</p></aside><section className="office-main"><header className="office-topbar"><div><p className="eyebrow">{item.eyebrow}</p><h1>{item.title}</h1></div><Link href="/corporate/settings" className="office-identity" aria-label="Open your profile and security settings"><span>{role?.replaceAll("_", " ") ?? "ROLE REVIEW"}</span><small>{email ?? "Identity required"}</small></Link></header>{permitted ? <><div className="office-notice"><ShieldCheck /><p>{item.description}</p></div>{section === "dashboard" ? <DashboardEmpty /> : section === "content" ? <ContentGovernancePanel /> : section === "support" && children ? children : <section className="office-record-panel" aria-label={`${item.title} records`}><div className="office-record-panel-head"><div><p className="eyebrow">SELECTED FINANCIAL YEAR</p><strong>FY 2026–27</strong></div><span className="office-status">CONFIGURATION-LED</span></div><div className="office-empty"><FileLock2 /><div><h2>{item.empty}</h2><p>Records appear only after an authorised user creates or assigns them. This environment contains no sample corporate data.</p></div></div></section>}</> : <section className="office-denied"><TriangleAlert /><div><p className="eyebrow">ACCESS RESTRICTED</p><h2>This workspace is not assigned to your role.</h2><p>Request a scoped assignment from a Corporate Administrator. Access changes are reviewed, time-bound where appropriate, and audited.</p><Link className="text-link" href="/corporate/dashboard">Return to overview <ArrowRight /></Link></div></section>}</section></main>;
}

function DashboardEmpty() {
  const items = [["Action required", "No items require attention."], ["Upcoming compliance", "No obligations are configured."], ["Upcoming meetings", "No meetings are scheduled."], ["Pending approvals", "No approvals are assigned."], ["Expiring registrations", "No expiry records are configured."], ["Recent corporate activity", "No corporate activity is visible to this role."]] as const;
  return <><div className="office-dashboard-intro"><CalendarClock /><div><p className="eyebrow">TODAY&apos;S CORPORATE BRIEF</p><p>Activity is deliberately empty until source records, reviewed rules and authorised assignments exist.</p></div></div><div className="office-dashboard-grid">{items.map(([title, text]) => <article key={title}><p className="eyebrow">{title}</p><h2>{text}</h2><span>Awaiting governed records</span></article>)}</div></>;
}



function ContentGovernancePanel() {
  const gates = ["Required review domains", "SEO title and description", "Canonical path", "Public visibility", "Publication audit"];
  return <section className="content-governance-panel" aria-label="Content publication controls"><div><p className="eyebrow">PUBLICATION OPERATING SYSTEM</p><h2>Truth before reach.</h2><p>Content can be drafted, reviewed, approved, scheduled, published, archived and restored without exposing reviewer notes, evidence or unpublished records.</p></div><ol>{gates.map((gate, index) => <li key={gate}><span>0{index + 1}</span><b>{gate}</b><p>Checked before public publication.</p></li>)}</ol><div className="office-empty"><FileLock2 /><div><h2>No content records are available yet.</h2><p>Create verified content only when an owner, review path and public purpose are known. The system never seeds public news, jobs or claims.</p></div></div></section>;
}