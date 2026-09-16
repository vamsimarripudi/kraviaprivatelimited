import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { publicContentPath } from "./seo";
import type { ContentStatus, PublicContentRecord, PublicContentType } from "./types";

type PublicContentRow = {
  id: string; content_type: PublicContentType; slug: string; title: string; summary: string | null; body: unknown;
  status: ContentStatus; visibility: "PUBLIC"; created_at: string; updated_at: string; published_at: string | null;
  scheduled_for: string | null; content_owner: string | null; last_reviewed_at: string | null; next_review_at: string | null;
  version: number; seo: Record<string, unknown> | null; category: string | null; author_name: string | null; related_entity_ids: string[] | null;
};
type PublicationRow = { snapshot: unknown; published_at: string; version: number };

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

function asPublicContentRow(snapshot: unknown, publishedAt: string, version: number): PublicContentRow | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const row = snapshot as Partial<PublicContentRow>;
  if (typeof row.id !== "string" || typeof row.content_type !== "string" || typeof row.slug !== "string" || typeof row.title !== "string") return null;
  return { ...row, status: "PUBLISHED", visibility: "PUBLIC", published_at: publishedAt, version } as PublicContentRow;
}

async function listLegacyPublishedContent(type?: PublicContentType) {
  const supabase = await createClient();
  if (!supabase) return [] as PublicContentRecord[];
  let query = supabase.from("content_records").select("id,content_type,slug,title,summary,body,status,visibility,created_at,updated_at,published_at,scheduled_for,content_owner,last_reviewed_at,next_review_at,version,seo,category,author_name,related_entity_ids").eq("status", "PUBLISHED").eq("visibility", "PUBLIC").order("published_at", { ascending: false });
  if (type) query = query.eq("content_type", type);
  const { data, error } = await query;
  if (error || !data) return [] as PublicContentRecord[];
  return (data as PublicContentRow[]).map(mapRow);
}

/**
 * Published public reads use durable publication snapshots. An editor can open a
 * private next revision without making the current approved public page vanish.
 * The legacy fallback keeps pre-migration deployments functional until the
 * forward-only snapshot migration has been applied.
 */
export const listPublishedContent = cache(async (type?: PublicContentType) => {
  const supabase = await createClient();
  if (!supabase) return [] as PublicContentRecord[];
  const { data, error } = await supabase.from("content_publications").select("snapshot,published_at,version").eq("state", "PUBLISHED").order("published_at", { ascending: false });
  if (error || !data) return listLegacyPublishedContent(type);
  const records = (data as PublicationRow[])
    .map((publication) => asPublicContentRow(publication.snapshot, publication.published_at, publication.version))
    .filter((row): row is PublicContentRow => row !== null)
    .map(mapRow);
  return type ? records.filter((record) => record.type === type) : records;
});

export const getPublishedContentByPath = cache(async (type: PublicContentType, slug: string) => {
  const records = await listPublishedContent(type);
  return records.find((record) => record.slug === slug) ?? null;
});

/**
 * Resolves a public URL only against approved snapshots. Drafts, reviews,
 * evidence and next revisions cannot become reachable merely from a known URL.
 */
export const getPublishedContentByPublicPath = cache(async (path: string) => {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const records = await listPublishedContent();
  return records.find((record) => publicContentPath(record) === normalized) ?? null;
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