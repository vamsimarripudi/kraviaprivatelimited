import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FilePenLine } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-console";
import { ContentStudio, type ContentStudioRecord } from "@/components/content-studio";
import { requireCorporateCapability } from "@/lib/corporate/authorization";
import { createClient } from "@/lib/supabase/server";
import type { PublicContentType } from "@/lib/content/types";

type StoredContentRecord = {
  id: string; content_type: PublicContentType; slug: string; title: string; summary: string | null; body: unknown;
  category: string | null; author_name: string | null; status: string; version: number; seo: Record<string, unknown> | null;
};

function editorRecord(record: StoredContentRecord): ContentStudioRecord | null {
  if (record.status !== "DRAFT" && record.status !== "CHANGES_REQUESTED") return null;
  const seo = record.seo ?? {};
  return {
    id: record.id, type: record.content_type, slug: record.slug, title: record.title, summary: record.summary,
    body: typeof record.body === "string" ? [{ type: "paragraph" as const, text: record.body }] : Array.isArray(record.body) ? record.body.flatMap((block) => typeof block === "string" ? [{ type: "paragraph" as const, text: block }] : block && typeof block === "object" && "text" in block && typeof block.text === "string" ? [{ type: "paragraph" as const, text: block.text }] : []) : [],
    category: record.category, authorName: record.author_name, version: record.version, status: record.status,
    seo: {
      title: typeof seo.title === "string" ? seo.title : record.title,
      description: typeof seo.description === "string" ? seo.description : record.summary ?? "",
      canonicalPath: typeof seo.canonicalPath === "string" ? seo.canonicalPath : "",
      ogImage: typeof seo.ogImage === "string" ? seo.ogImage : null,
    },
  };
}

export default async function EditNewsroomRecord({ params }: { params: Promise<{ id: string }> }) {
  await requireCorporateCapability("content.edit");
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) notFound();
  const { data, error } = await supabase.from("content_records").select("id,content_type,slug,title,summary,body,category,author_name,status,version,seo").eq("id", id).maybeSingle();
  if (error || !data) notFound();
  const record = editorRecord(data as StoredContentRecord);
  if (!record) return <section className="admin-page"><AdminPageHeader eyebrow="PUBLIC CONTENT OPERATIONS" title="Open a revision before editing." intro="Published content remains visible from its approved public snapshot. Use the publication queue to start a private revision, then return here to edit it." /><Link href="/admin/newsroom" className="button button-light"><ArrowLeft aria-hidden="true" /> Back to publication queue</Link></section>;
  return <section className="admin-page"><AdminPageHeader eyebrow="PUBLIC CONTENT OPERATIONS" title="Edit private revision" intro="Your changes create a new append-only content version. The public site remains on the last approved snapshot until this version completes review and publication." /><Link href="/admin/newsroom" className="text-link"><ArrowLeft aria-hidden="true" /> Back to publication queue</Link><div className="admin-content-editor"><FilePenLine aria-hidden="true" /><ContentStudio record={record} /></div></section>;
}