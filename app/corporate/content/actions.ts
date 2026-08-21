"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCorporateCapability } from "@/lib/corporate/authorization";
import { canReviewContentDomain } from "@/lib/corporate/permissions";
import { createClient } from "@/lib/supabase/server";
import { canTransitionContent, findHighRiskClaims, isPublishable, requiredReviewDomains, validateSeo } from "@/lib/content/governance";
import { publicContentPath } from "@/lib/content/seo";
import type { ChangeMateriality, ContentReview, PublicContentRecord, PublicContentType, ReviewDomain } from "@/lib/content/types";

const contentType = z.enum(["COMPANY", "PRODUCT", "MILESTONE", "PRINCIPLE", "LEADERSHIP", "TECHNOLOGY", "RESEARCH", "NEWS", "PRESS_RELEASE", "ENGINEERING_ARTICLE", "TRUST_DOCUMENT", "POLICY", "CORPORATE_DISCLOSURE", "REPORT", "CAREER", "PARTNER", "FAQ"]);
const reviewDomain = z.enum(["CONTENT", "PRODUCT", "TECHNOLOGY", "SECURITY", "PRIVACY", "LEGAL", "CORPORATE", "DIRECTOR"]);
const baseInput = z.object({ id: z.string().uuid() });
const materiality = z.enum(["EDITORIAL", "MINOR", "MATERIAL", "LEGAL_POLICY", "CORPORATE_FACT"]);
const recordInput = z.object({ type: contentType, slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), title: z.string().min(1).max(180), summary: z.string().max(500).nullable().optional(), body: z.unknown(), category: z.string().max(80).nullable().optional(), authorName: z.string().max(160).nullable().optional(), seo: z.object({ title: z.string().min(1).max(180), description: z.string().min(1).max(200), canonicalPath: z.string().regex(/^\//), ogImage: z.string().regex(/^\//).nullable().optional(), noindex: z.boolean().optional() }) });
const revisionInput = recordInput.extend({ id: z.string().uuid(), changeSummary: z.string().min(3).max(1000), materiality });

async function clientOrThrow() { const client = await createClient(); if (!client) throw new Error("Corporate Office requires Supabase configuration."); return client; }
async function recordEvent(supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>, contentId: string, eventType: string, reason?: string) {
  const { error } = await supabase.from("content_publication_events").insert({ content_id: contentId, event_type: eventType, reason: reason ?? null });
  if (error) throw new Error("The content event could not be recorded.");
}
function revalidateContent(record: Pick<PublicContentRecord, "type" | "slug" | "seo">) { revalidatePath("/"); revalidatePath("/newsroom"); revalidatePath("/sitemap.xml"); revalidatePath(publicContentPath(record)); }

export async function createContent(input: z.input<typeof recordInput>) {
  const actor = await requireCorporateCapability("content.create");
  const data = recordInput.parse(input); const supabase = await clientOrThrow();
  const { data: record, error } = await supabase.from("content_records").insert({ content_type: data.type, slug: data.slug, title: data.title, summary: data.summary ?? null, body: data.body, category: data.category ?? null, author_name: data.authorName ?? null, seo: data.seo, created_by: actor.id, updated_by: actor.id, content_owner: actor.id }).select().single();
  if (error || !record) throw new Error("The draft could not be created. Check the slug and try again.");
  const { error: versionError } = await supabase.from("content_versions").insert({ content_id: record.id, version: 1, snapshot: record, change_summary: "Initial draft", created_by: actor.id });
  if (versionError) throw new Error("The draft version could not be recorded.");
  await recordEvent(supabase, record.id, "CREATED");
  return { id: record.id, status: "DRAFT" as const };
}


/** Saves a new private version only from an editable workflow state. */
export async function updateContent(input: z.input<typeof revisionInput>) {
  await requireCorporateCapability("content.edit");
  const data = revisionInput.parse(input); const supabase = await clientOrThrow();
  const { data: revised, error } = await supabase.rpc("revise_content_record", {
    p_content_id: data.id, p_content_type: data.type, p_slug: data.slug, p_title: data.title, p_summary: data.summary ?? null,
    p_body: data.body, p_category: data.category ?? null, p_author_name: data.authorName ?? null, p_seo: data.seo,
    p_change_summary: data.changeSummary, p_materiality: data.materiality as ChangeMateriality,
  }).single();
  if (error || !revised) throw new Error("The new content version could not be saved.");
  return { id: revised.id, version: revised.version };
}

/** Opens a private revision while retaining the active public snapshot. */
export async function beginContentRevision(input: z.input<typeof baseInput>) {
  const actor = await requireCorporateCapability("content.edit"); const { id } = baseInput.parse(input); const supabase = await clientOrThrow();
  const { data: current, error: currentError } = await supabase.from("content_records").select("id,status").eq("id", id).single();
  if (currentError || !current || current.status !== "PUBLISHED") throw new Error("Only a published record can start a new revision.");
  const { error } = await supabase.from("content_records").update({ status: "DRAFT", visibility: "PRIVATE", scheduled_for: null, updated_by: actor.id }).eq("id", id);
  if (error) throw new Error("The private revision could not be opened.");
  return { id };
}

export async function requestContentReview(input: z.input<typeof baseInput>) {
  await requireCorporateCapability("content.edit"); const { id } = baseInput.parse(input); const supabase = await clientOrThrow();
  const { data: record, error } = await supabase.from("content_records").select("*").eq("id", id).single();
  if (error || !record) throw new Error("This content record is unavailable.");
  if (!canTransitionContent(record.status, "IN_REVIEW")) throw new Error("This content cannot enter review from its current state.");
  const domains = requiredReviewDomains(record.content_type as PublicContentType, { title: record.title, summary: record.summary, body: record.body });
  const { error: reviewError } = await supabase.from("content_reviews").upsert(domains.map((domain) => ({ content_id: record.id, version: record.version, review_domain: domain, status: "PENDING" })), { onConflict: "content_id,version,review_domain" });
  if (reviewError) throw new Error("Review requirements could not be prepared.");
  const { error: updateError } = await supabase.from("content_records").update({ status: "IN_REVIEW" }).eq("id", id);
  if (updateError) throw new Error("The review request could not be saved."); await recordEvent(supabase, id, "REVIEW_REQUESTED");
}

export async function submitContentReview(input: { id: string; domain: ReviewDomain; decision: "APPROVED" | "CHANGES_REQUESTED" | "REJECTED"; note?: string }) {
  const actor = await requireCorporateCapability("content.review"); const data = z.object({ id: z.string().uuid(), domain: reviewDomain, decision: z.enum(["APPROVED", "CHANGES_REQUESTED", "REJECTED"]), note: z.string().max(5000).optional() }).parse(input);
  if (!canReviewContentDomain(actor.role, data.domain)) throw new Error("Your role is not authorised to decide this review domain.");
  const supabase = await clientOrThrow();
  const { data: review, error } = await supabase.from("content_reviews").select("*").eq("content_id", data.id).eq("review_domain", data.domain).order("version", { ascending: false }).limit(1).single();
  if (error || !review) throw new Error("No assigned review is available for this content.");
  const { error: updateError } = await supabase.from("content_reviews").update({ status: data.decision, reviewer_id: actor.id, reviewed_at: new Date().toISOString(), note: data.note ?? null }).eq("id", review.id);
  if (updateError) throw new Error("The review decision could not be recorded.");
  if (data.decision !== "APPROVED") { await supabase.from("content_records").update({ status: "CHANGES_REQUESTED" }).eq("id", data.id); await recordEvent(supabase, data.id, "CHANGES_REQUESTED", data.note); }
}

export async function approveContent(input: z.input<typeof baseInput>) {
  await requireCorporateCapability("content.approve"); const { id } = baseInput.parse(input); const supabase = await clientOrThrow();
  const { data: record, error } = await supabase.from("content_records").select("*").eq("id", id).single();
  if (error || !record) throw new Error("This content record is unavailable.");
  if (!canTransitionContent(record.status, "APPROVED")) throw new Error("This content cannot be approved from its current state.");
  const { data: reviews } = await supabase.from("content_reviews").select("id,content_id,version,review_domain,status,reviewer_id,note,reviewed_at").eq("content_id", id).eq("version", record.version);
  const mappedReviews: ContentReview[] = (reviews ?? []).map((review) => ({ id: review.id, contentId: review.content_id, version: review.version, domain: review.review_domain as ReviewDomain, status: review.status as ContentReview["status"], reviewerId: review.reviewer_id, note: review.note, reviewedAt: review.reviewed_at }));
  const candidate = { type: record.content_type as PublicContentType, title: record.title, summary: record.summary, body: record.body, slug: record.slug, seo: record.seo };
  if (!isPublishable(candidate, mappedReviews)) throw new Error("Required reviews or SEO fields are incomplete. Resolve the content quality checks before approval.");
  const { error: updateError } = await supabase.from("content_records").update({ status: "APPROVED", approved_by: (await requireCorporateCapability("content.approve")).id, approved_at: new Date().toISOString() }).eq("id", id);
  if (updateError) throw new Error("The approval could not be recorded."); await recordEvent(supabase, id, "APPROVED");
}

export async function publishContent(input: { id: string; scheduledFor?: string | null }) {
  await requireCorporateCapability("content.publish");
  const data = z.object({ id: z.string().uuid(), scheduledFor: z.string().datetime().nullable().optional() }).parse(input); const supabase = await clientOrThrow();
  const { data: publishedRecord, error } = await supabase.rpc("publish_content_snapshot", { p_content_id: data.id, p_scheduled_for: data.scheduledFor ?? null }).single();
  if (error || !publishedRecord) throw new Error("The approved public revision could not be released. Confirm the publication-snapshot migration is applied and retry.");
  if (!data.scheduledFor || new Date(data.scheduledFor).getTime() <= Date.now()) revalidateContent({ type: publishedRecord.content_type as PublicContentType, slug: publishedRecord.slug, seo: publishedRecord.seo });
}

export async function archiveContent(input: { id: string; reason: string }) {
  await requireCorporateCapability("content.archive");
  const data = z.object({ id: z.string().uuid(), reason: z.string().min(3).max(1000) }).parse(input); const supabase = await clientOrThrow();
  const { data: archivedRecord, error } = await supabase.rpc("archive_content_snapshot", { p_content_id: data.id, p_reason: data.reason }).single();
  if (error || !archivedRecord) throw new Error("The public revision could not be withdrawn safely. Confirm the publication-snapshot migration is applied and retry.");
  revalidateContent({ type: archivedRecord.content_type as PublicContentType, slug: archivedRecord.slug, seo: archivedRecord.seo });
}

export async function contentSeoChecks(input: z.input<typeof recordInput>) {
  const data = recordInput.parse(input);
  const claims = findHighRiskClaims(`${data.title} ${data.summary ?? ""} ${typeof data.body === "string" ? data.body : JSON.stringify(data.body)}`);
  return { issues: validateSeo({ ...data, seo: { ...data.seo, ogImage: data.seo.ogImage ?? undefined } }), highRiskClaims: claims.map((claim) => claim.phrase) };
}
