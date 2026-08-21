import Link from "next/link";
import { ArrowUpRight, Building2, FileText, MessagesSquare, RadioTower, ShieldCheck } from "lucide-react";
import { AdminControlLink, AdminLiveBadge, AdminPageHeader } from "@/components/admin-console";
import { listManagedFormSettings } from "@/lib/admin/site-control";
import { listPublishedContent } from "@/lib/content/repository";
import { requireAnyCorporateCapability } from "@/lib/corporate/authorization";
import { createClient } from "@/lib/supabase/server";

export default async function AdminDashboardPage() {
  await requireAnyCorporateCapability("content.view", "support.view", "security.manage", "readiness.view", "automation.view");
  const supabase = await createClient();
  const [formState, published, supportResult, reviewResult] = await Promise.all([
    listManagedFormSettings(),
    listPublishedContent(),
    supabase?.from("support_cases").select("id", { count: "exact", head: true }).neq("status", "CLOSED") ?? Promise.resolve({ count: null }),
    supabase?.from("content_records").select("id", { count: "exact", head: true }).eq("status", "IN_REVIEW") ?? Promise.resolve({ count: null }),
  ]);
  const configuredForms = formState.settings.length;
  return <section className="admin-page">
    <AdminPageHeader eyebrow="CONTROLLED PUBLIC OPERATIONS" title="A truthful website, operated in one place." intro="Publish approved company content, keep public request experiences current, and inspect the signals that need an authorised owner." />
    <section className="admin-signal-grid" aria-label="Current website operations">
      <article><FileText aria-hidden="true" /><p className="eyebrow">PUBLIC CONTENT</p><strong>{published.length}</strong><span>published record{published.length === 1 ? "" : "s"} visible on the website</span><Link href="/admin/newsroom">Manage newsroom <ArrowUpRight /></Link></article>
      <article><MessagesSquare aria-hidden="true" /><p className="eyebrow">REQUEST INTAKE</p><strong>{supportResult.count ?? "—"}</strong><span>{supportResult.count === null ? "restricted to your role" : "active request cases"}</span><Link href="/admin/forms">Manage forms <ArrowUpRight /></Link></article>
      <article><ShieldCheck aria-hidden="true" /><p className="eyebrow">REVIEW QUEUE</p><strong>{reviewResult.count ?? "—"}</strong><span>{reviewResult.count === null ? "restricted to your role" : "content record(s) awaiting review"}</span><Link href="/corporate/content">Open review workflow <ArrowUpRight /></Link></article>
    </section>
    <section className="admin-command-grid">
      <div className="admin-command-intro"><p className="eyebrow">CONTROL SURFACES</p><h2>One operating view. Separate safeguards.</h2><p>Website presentation, public content, request handling and operational data are connected—but permissions and publication gates remain independent.</p><AdminLiveBadge live={formState.schemaReady} label={formState.schemaReady ? `${configuredForms} form setting${configuredForms === 1 ? "" : "s"} configured` : "Form settings awaiting migration"} /></div>
      <div className="admin-control-list">
        <AdminControlLink href="/admin/newsroom" label="Newsroom publishing" detail="Create a governed draft, define its public presentation, then use review and publishing controls." Icon={FileText} />
        <AdminControlLink href="/admin/company" label="Company fact governance" detail="Record evidence-backed corporate facts once; only public-approved values reach the website and organization schema." Icon={Building2} />
        <AdminControlLink href="/admin/forms" label="Forms & request operations" detail="Edit public form copy while keeping routing and restricted queues protected." Icon={MessagesSquare} />
        <AdminControlLink href="/admin/monitoring" label="Monitoring & database health" detail="View authorised operational signals, schema readiness and aggregate workload." Icon={RadioTower} />
      </div>
    </section>
    <section className="admin-governance-note"><ShieldCheck aria-hidden="true" /><div><strong>Publication is never an unchecked content edit.</strong><p>Drafts remain private until they pass the existing review, approval and publish workflow. Public forms expose only approved presentation copy; requester records remain in their separate support queues.</p></div></section>
  </section>;
}