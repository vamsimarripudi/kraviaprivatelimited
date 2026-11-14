import Link from "next/link";
import { ArrowRight, ClipboardCheck, Clock3, FolderClosed, LockKeyhole, ShieldCheck } from "lucide-react";
import { getOfficeVaultAccessCenter, OfficeVaultAccessError } from "@/lib/office/vault-access-server";
import type { VaultCategory } from "@/lib/office/vault-categories";
import styles from "./office-vault-overview.module.css";

const categoryName: Record<string, string> = {
 identity: "Company identity", registrations: "Registrations & licences",
 banking: "Banking & finance", legal: "Legal & governance",
 people: "People documentation", technology: "Technology & assets",
 documents: "Document evidence", custody: "Secure custody",
};
function date(value: string) {
 const parsed = new Date(value);
 return Number.isNaN(parsed.getTime()) ? "Unknown date" : new Intl.DateTimeFormat("en-IN", {
  day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
 }).format(parsed);
}

export async function OfficeVaultOverview({ categories }: { categories: VaultCategory[] }) {
 let access: Awaited<ReturnType<typeof getOfficeVaultAccessCenter>> | null = null;
 try {
  access = await getOfficeVaultAccessCenter();
 } catch (error) {
  // The schema must be migrated separately after approval. Do not invent
  // counts when this read-only ledger is missing or temporarily unavailable.
  if (!(error instanceof OfficeVaultAccessError) || error.status !== 503) throw error;
 }
 const now = access?.generated_at ? Date.parse(access.generated_at) : 0;
 const pending = access?.my_requests.filter(row => row.status === "PENDING") ?? [];
 const reviews = access?.review_queue.filter(row => row.requester_user_id !== access.actor_user_id) ?? [];
 const effective = access?.my_grants.filter(row => !row.revoked_at && Date.parse(row.expires_at) > now) ?? [];
 const expiring = effective.filter(row => Date.parse(row.expires_at) <= now + 30 * 86400000);
 const recent = [...(access?.my_requests ?? [])].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)).slice(0,5);
 const metrics = [
  { label: "Available categories", value: categories.length.toLocaleString("en-IN"), note: "Current source permissions" },
  { label: "Requests requiring review", value: access ? reviews.length.toLocaleString("en-IN") : "—", note: access ? "Within your review authority" : "Access ledger unavailable" },
  { label: "Expiring access grants", value: access ? expiring.length.toLocaleString("en-IN") : "—", note: access ? "Within the next 30 days" : "Access ledger unavailable" },
  { label: "Pending access requests", value: access ? pending.length.toLocaleString("en-IN") : "—", note: access ? "Submitted by your identity" : "Access ledger unavailable" },
 ];
 return <div className={styles.overview} aria-label="K-Vault overview">
  <div className={styles.metrics}>
   {metrics.map(metric => <article key={metric.label}>
    <h2>{metric.label}</h2><strong>{metric.value}</strong><small>{metric.note}</small>
   </article>)}
  </div>
  <div className={styles.columns}>
   <section className={styles.panel} aria-labelledby="vault-overview-quick">
    <header><h2 id="vault-overview-quick">Quick access</h2>
     <Link href="/office/k-vault/categories">All categories <ArrowRight size={15}/></Link>
    </header>
    {categories.length ? <nav className={styles.quick} aria-label="Accessible Vault categories">
     {categories.slice(0,6).map(category =>
      <Link href={"/office/k-vault/categories/"+category.slug} key={category.slug}>
       <FolderClosed size={19} aria-hidden="true"/><span>{category.title}</span>
       <ArrowRight size={15} aria-hidden="true"/>
      </Link>)}
    </nav> : <div className={styles.empty}><LockKeyhole size={20} aria-hidden="true"/>
      Your current authority has no readable Vault categories.
      <Link href="/office/k-vault/requests">Request governed access</Link></div>}
   </section>
   <section className={styles.panel} aria-labelledby="vault-overview-access">
    <header><h2 id="vault-overview-access">My access summary</h2>
     <Link href="/office/k-vault/requests">Review access <ArrowRight size={15}/></Link>
    </header>
    {access === null ? <div className={styles.empty}>Access grant ledger unavailable. Current permissions have not been inferred.</div>
     : effective.length === 0 ? <div className={styles.empty}>No active additional Vault grants. Canonical source permissions remain independently enforced.</div>
     : <ul className={styles.grants}>
       {effective.slice(0,4).map(grant => <li key={grant.id}>
        <ShieldCheck size={17} aria-hidden="true"/><span>
         <strong>{categoryName[grant.category_slug] ?? grant.category_slug} · {grant.action}</strong>
         <small>{grant.resource_id ? "Record-specific" : "Category scope"} · Expires {date(grant.expires_at)}</small>
        </span>
       </li>)}
      </ul>}
    {access && effective.length > 4 ? <Link className={styles.more} href="/office/k-vault/requests">
     View all {effective.length} grants <ArrowRight size={15}/></Link> : null}
   </section>
  </div>
  <section className={styles.panel} aria-labelledby="vault-overview-recent">
   <header><h2 id="vault-overview-recent">Recent permitted access activity</h2>
    <Link href="/office/k-vault/requests">All requests <ArrowRight size={15}/></Link></header>
   {access === null ? <p className={styles.empty}>Recent activity is unavailable until the scoped access ledger responds.</p>
    : recent.length === 0 ? <p className={styles.empty}>No access requests recorded for this identity.</p>
    : <ol className={styles.activity}>{recent.map(row => <li key={row.id}>
       <ClipboardCheck size={19} aria-hidden="true"/><span><strong>{categoryName[row.category_slug] ?? row.category_slug} · {row.action}</strong>
        <small>Requested {date(row.created_at)} · {row.status}</small></span>
       <Clock3 size={16} aria-hidden="true"/></li>)}</ol>}
  </section>
  <p className={styles.notice}><ShieldCheck size={16} aria-hidden="true"/>
   Category visibility and additional grants do not override record-level source authorization, MFA or independent review.
  </p>
 </div>;
}
