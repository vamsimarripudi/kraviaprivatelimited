import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { ContentStatus, PublicContentRecord, PublicContentType } from "./types";

type PublicContentRow = {
  id: string; content_type: PublicContentType; slug: string; title: string; summary: string | null; body: unknown;
  status: ContentStatus; visibility: "PUBLIC"; created_at: string; updated_at: string; published_at: string | null;
  scheduled_for: string | null; content_owner: string | null; last_reviewed_at: string | null; next_review_at: string | null;
  version: number; seo: Record<string, unknown> | null; category: string | null; author_name: string | null; related_entity_ids: string[] | null;
};

function mapRow(row: PublicContentRow): PublicContentRecord {
  const seo = row.seo ?? {};
  return {
    id: row.id, type: row.content_type, slug: row.slug, title: row.title, summary: row.summary, body: row.body,
    status: row.status, visibility: row.visibility, createdAt: row.created_at, updatedAt: row.updated_at,
    publishedAt: row.published_at, scheduledFor: row.scheduled_for, contentOwner: row.content_owner,
    lastReviewedAt: row.last_reviewed_at, nextReviewAt: row.next_review_at, version: row.version,
    seo: { title: String(seo.title ?? row.title), description: String(seo.description ?? row.summary ?? ""), canonicalPath: typeof seo.canonicalPath === "string" ? seo.canonicalPath : undefined, ogImage: typeof seo.ogImage === "string" ? seo.ogImage : undefined, noindex: seo.noindex === true },
    category: row.category, authorName: row.author_name, relatedEntityIds: row.related_entity_ids ?? [],
  };
}

/** Published public reads only. Drafts, reviews, evidence and private records never use this repository. */
export const listPublishedContent = cache(async (type?: PublicContentType) => {
  const supabase = await createClient();
  if (!supabase) return [] as PublicContentRecord[];
  let query = supabase.from("content_records").select("id,content_type,slug,title,summary,body,status,visibility,created_at,updated_at,published_at,scheduled_for,content_owner,last_reviewed_at,next_review_at,version,seo,category,author_name,related_entity_ids").eq("status", "PUBLISHED").eq("visibility", "PUBLIC").order("published_at", { ascending: false });
  if (type) query = query.eq("content_type", type);
  const { data, error } = await query;
  // The migration may not yet be deployed; public pages retain their version-controlled fallback rather than surfacing an implementation detail.
  if (error || !data) return [] as PublicContentRecord[];
  return (data as PublicContentRow[]).map(mapRow);
});

export const getPublishedContentByPath = cache(async (type: PublicContentType, slug: string) => {
  const records = await listPublishedContent(type);
  return records.find((record) => record.slug === slug) ?? null;
});

export const getPublishedNewsroomContent = cache(async () => {
  const records = await listPublishedContent();
  return records.filter((record) => ["NEWS", "PRESS_RELEASE", "ENGINEERING_ARTICLE", "RESEARCH"].includes(record.type));
});

export const getPublishedCareers = cache(async () => listPublishedContent("CAREER"));

export const resolvePublishedRedirect = cache(async (path: string) => {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.from("content_redirects").select("destination_path").eq("source_path", path).eq("active", true).maybeSingle();
  return data?.destination_path ?? null;
});
