import Link from "next/link";
import { ArrowUpRight, CircleDotDashed, FileCheck2 } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-console";
import { ContentStudio } from "@/components/content-studio";
import { requireCorporateCapability } from "@/lib/corporate/authorization";
import { createClient } from "@/lib/supabase/server";
import { contentPath } from "@/lib/content/seo";
import type { PublicContentType } from "@/lib/content/types";

type ContentRow = { id: string; title: string; slug: string; content_type: PublicContentType; status: string; updated_at: string; published_at: string | null };

export default async function AdminNewsroomPage() {
  await requireCorporateCapability("content.create");
  const supabase = await createClient();
  const { data } = supabase ? await supabase.from("content_records").select("id,title,slug,content_type,status,updated_at,published_at").order("updated_at", { ascending: false }).limit(30) : { data: [] };
  const records = (data ?? []) as ContentRow[];
  return <section className="admin-page">
    <AdminPageHeader eyebrow="PUBLIC CONTENT OPERATIONS" title="Create the record before it becomes public." intro="Company, product, Trust and newsroom records remain private until they pass the existing review, approval and publication workflow."><Link className="button button-light" href="/newsroom" target="_blank" rel="noreferrer">View public newsroom <ArrowUpRight /></Link></AdminPageHeader>
    <section className="admin-newsroom-layout">
      <ContentStudio />
      <aside className="admin-record-list" aria-label="Recent public content records">
        <header><p className="eyebrow">RECENT RECORDS</p><h2>Publication queue</h2><p>Every record retains its own workflow state and a route determined by its governed content type.</p></header>
        {records.length ? <ol>{records.map((record) => <li key={record.id}>
          <span className={`admin-record-status status-${record.status.toLowerCase()}`}>{record.status.replaceAll("_", " ")}</span>
          <div>
            <strong>{record.title}</strong>
            <small>{record.content_type.replaceAll("_", " ")} · {contentPath({ type: record.content_type, slug: record.slug })}</small>
            <time dateTime={record.updated_at}>Updated {new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(record.updated_at))}</time>
          </div>
        </li>)}</ol> : <div className="admin-empty"><CircleDotDashed aria-hidden="true" /><p>No governed public-content records are visible to your role yet. Create only factual content with an owner and review path.</p></div>}
        <Link className="text-link" href="/corporate/content"><FileCheck2 /> Open full content governance</Link>
      </aside>
    </section>
  </section>;
}