import Link from "next/link";
import { ArrowUpRight, CircleDotDashed, FileCheck2 } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-console";
import { ContentStudio } from "@/components/content-studio";
import { requireCorporateCapability } from "@/lib/corporate/authorization";
import { createClient } from "@/lib/supabase/server";

type ContentRow = { id: string; title: string; slug: string; content_type: string; status: string; updated_at: string; published_at: string | null };

export default async function AdminNewsroomPage() {
  await requireCorporateCapability("content.create");
  const supabase = await createClient();
  const { data } = supabase ? await supabase.from("content_records").select("id,title,slug,content_type,status,updated_at,published_at").in("content_type", ["NEWS", "PRESS_RELEASE", "ENGINEERING_ARTICLE", "RESEARCH"]).order("updated_at", { ascending: false }).limit(30) : { data: [] };
  const records = (data ?? []) as ContentRow[];
  return <section className="admin-page">
    <AdminPageHeader eyebrow="NEWSROOM OPERATIONS" title="Create the record before you create the reach." intro="This produces real governed newsroom records. It does not publish immediately: the existing review, approval and publication workflow stays in force."><Link className="button button-light" href="/newsroom" target="_blank" rel="noreferrer">View public newsroom <ArrowUpRight /></Link></AdminPageHeader>
    <section className="admin-newsroom-layout"><ContentStudio /><aside className="admin-record-list" aria-label="Recent newsroom records"><header><p className="eyebrow">RECENT RECORDS</p><h2>Publishing queue</h2><p>Every record retains its own workflow state and public URL only after publication.</p></header>{records.length ? <ol>{records.map((record) => <li key={record.id}><span className={`admin-record-status status-${record.status.toLowerCase()}`}>{record.status.replaceAll("_", " ")}</span><div><strong>{record.title}</strong><small>{record.content_type.replaceAll("_", " ")} · /newsroom/{record.slug}</small><time dateTime={record.updated_at}>Updated {new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(record.updated_at))}</time></div></li>)}</ol> : <div className="admin-empty"><CircleDotDashed aria-hidden="true" /><p>No governed newsroom records are visible to your role yet. Create only factual content with an owner and review path.</p></div>}<Link className="text-link" href="/corporate/content"><FileCheck2 /> Open full content governance</Link></aside></section>
  </section>;
}