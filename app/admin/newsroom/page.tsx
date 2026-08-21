import Link from "next/link";
import { ArrowUpRight, CircleDotDashed, FileCheck2 } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-console";
import { ContentLifecycleActions } from "@/components/content-lifecycle-actions";
import { ContentReviewControls } from "@/components/content-review-controls";
import { ContentStudio } from "@/components/content-studio";
import { requireAnyCorporateCapability } from "@/lib/corporate/authorization";
import { canReviewContentDomain, hasCapability } from "@/lib/corporate/permissions";
import { createClient } from "@/lib/supabase/server";
import { contentPath } from "@/lib/content/seo";
import type { ContentStatus, PublicContentType, ReviewDomain } from "@/lib/content/types";

type ContentRow = { id: string; title: string; slug: string; content_type: PublicContentType; status: ContentStatus; updated_at: string; published_at: string | null };
type ReviewRow = { content_id: string; review_domain: ReviewDomain; status: "PENDING" | "APPROVED" | "CHANGES_REQUESTED" | "REJECTED" };

export default async function AdminNewsroomPage() {
  const actor = await requireAnyCorporateCapability("content.view", "content.create", "content.edit", "content.review", "content.approve", "content.publish", "content.archive");
  const supabase = await createClient();
  const { data } = supabase ? await supabase.from("content_records").select("id,title,slug,content_type,status,updated_at,published_at").order("updated_at", { ascending: false }).limit(30) : { data: [] };
  const records = (data ?? []) as ContentRow[];
  const { data: reviewData } = supabase && records.length
    ? await supabase.from("content_reviews").select("content_id,review_domain,status").in("content_id", records.map((record) => record.id))
    : { data: [] };
  const reviewsByContent = new Map<string, ReviewRow[]>();
  for (const review of (reviewData ?? []) as ReviewRow[]) {
    reviewsByContent.set(review.content_id, [...(reviewsByContent.get(review.content_id) ?? []), review]);
  }
  const canCreate = hasCapability(actor.role, "content.create");
  const canEdit = hasCapability(actor.role, "content.edit");
  return <section className="admin-page">
    <AdminPageHeader eyebrow="PUBLIC CONTENT OPERATIONS" title="Create the record before it becomes public." intro="Company, product, Trust and newsroom records remain private until they pass the existing review, approval and publication workflow."><Link className="button button-light" href="/newsroom" target="_blank" rel="noreferrer">View public newsroom <ArrowUpRight /></Link></AdminPageHeader>
    <section className="admin-newsroom-layout">
      {canCreate ? <ContentStudio /> : <section className="admin-content-permission"><p className="eyebrow">REVIEW WORKSPACE</p><h2>Publication queue</h2><p>Your role can review, approve, publish, or archive governed content, but cannot create a new record.</p></section>}
      <aside className="admin-record-list" aria-label="Recent public content records">
        <header><p className="eyebrow">RECENT RECORDS</p><h2>Publication queue</h2><p>Every record retains its own workflow state and a route determined by its governed content type.</p></header>
        {records.length ? <ol>{records.map((record) => <li key={record.id}>
          <span className={`admin-record-status status-${record.status.toLowerCase()}`}>{record.status.replaceAll("_", " ")}</span>
          <div>
            <strong>{record.title}</strong>
            <small>{record.content_type.replaceAll("_", " ")} · {contentPath({ type: record.content_type, slug: record.slug })}</small>
            <time dateTime={record.updated_at}>Updated {new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(record.updated_at))}</time>
            {canEdit && (record.status === "DRAFT" || record.status === "CHANGES_REQUESTED") ? <Link className="text-link" href={`/admin/newsroom/${record.id}`}>Continue editing <ArrowUpRight aria-hidden="true" /></Link> : null}
            {record.status === "IN_REVIEW" && reviewsByContent.get(record.id)?.length ? <ContentReviewControls id={record.id} reviews={reviewsByContent.get(record.id)!.map((review) => ({ domain: review.review_domain, status: review.status, canDecide: canReviewContentDomain(actor.role, review.review_domain) }))} /> : null}
            <ContentLifecycleActions id={record.id} status={record.status} canRequestReview={hasCapability(actor.role, "content.edit")} canApprove={hasCapability(actor.role, "content.approve")} canPublish={hasCapability(actor.role, "content.publish")} canArchive={hasCapability(actor.role, "content.archive")} canStartRevision={canEdit} />
          </div>
        </li>)}</ol> : <div className="admin-empty"><CircleDotDashed aria-hidden="true" /><p>No governed public-content records are visible to your role yet. Create only factual content with an owner and review path.</p></div>}
        <Link className="text-link" href="/corporate/content"><FileCheck2 /> Open full content governance</Link>
      </aside>
    </section>
  </section>;
}