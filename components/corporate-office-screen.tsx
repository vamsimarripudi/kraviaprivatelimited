import Link from "next/link";
import { ArrowRight, CalendarClock, FileLock2, ShieldCheck, TriangleAlert } from "lucide-react";
import { officeNavigation, officeSections, type OfficeSection } from "@/lib/corporate/office";
import { hasCapability, type CorporateRole } from "@/lib/corporate/permissions";

type Props = { section: OfficeSection; email?: string; role?: CorporateRole };

export function CorporateOfficeScreen({ section, email, role }: Props) {
  const item = officeSections[section];
  const permitted = role ? hasCapability(role, item.capability) : false;
  return <main className="office office-v2"><aside><Link href="/corporate/dashboard" className="wordmark" aria-label="Kravia Corporate Office"><span>KRAVIA</span><span>CORPORATE OFFICE</span></Link><nav aria-label="Corporate navigation">{officeNavigation.map((entry) => <Link key={entry.slug} href={`/corporate/${entry.slug}`} aria-current={entry.slug === section ? "page" : undefined}>{entry.title}</Link>)}</nav><p className="office-side-note">Private surface<br />No public indexing</p></aside><section className="office-main"><header className="office-topbar"><div><p className="eyebrow">{item.eyebrow}</p><h1>{item.title}</h1></div><div className="office-identity"><span>{role?.replaceAll("_", " ") ?? "ROLE REVIEW"}</span><small>{email ?? "Identity required"}</small></div></header>{permitted ? <><div className="office-notice"><ShieldCheck /><p>{item.description}</p></div>{section === "dashboard" ? <DashboardEmpty /> : <section className="office-record-panel" aria-label={`${item.title} records`}><div className="office-record-panel-head"><div><p className="eyebrow">SELECTED FINANCIAL YEAR</p><strong>FY 2026–27</strong></div><span className="office-status">CONFIGURATION-LED</span></div><div className="office-empty"><FileLock2 /><div><h2>{item.empty}</h2><p>Records appear only after an authorised user creates or assigns them. This environment contains no sample corporate data.</p></div></div></section>}</> : <section className="office-denied"><TriangleAlert /><div><p className="eyebrow">ACCESS RESTRICTED</p><h2>This workspace is not assigned to your role.</h2><p>Request a scoped assignment from a Corporate Administrator. Access changes are reviewed, time-bound where appropriate, and audited.</p><Link className="text-link" href="/corporate/dashboard">Return to overview <ArrowRight /></Link></div></section>}</section></main>;
}

function DashboardEmpty() {
  const items = [["Action required", "No items require attention."], ["Upcoming compliance", "No obligations are configured."], ["Upcoming meetings", "No meetings are scheduled."], ["Pending approvals", "No approvals are assigned."], ["Expiring registrations", "No expiry records are configured."], ["Recent corporate activity", "No corporate activity is visible to this role."]] as const;
  return <><div className="office-dashboard-intro"><CalendarClock /><div><p className="eyebrow">TODAY&apos;S CORPORATE BRIEF</p><p>Activity is deliberately empty until source records, reviewed rules and authorised assignments exist.</p></div></div><div className="office-dashboard-grid">{items.map(([title, text]) => <article key={title}><p className="eyebrow">{title}</p><h2>{text}</h2><span>Awaiting governed records</span></article>)}</div></>;
}


