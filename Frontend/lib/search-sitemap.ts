import type { MetadataRoute } from "next";
import { isPublicSitemapPath, normalizePublicPath } from "./crawler-policy";
import { publicContentPath } from "./content/seo";
import type { PublicContentRecord } from "./content/types";

type RedirectResolver = (path: string) => string | null;

function canonicalPath(value: string, resolveRedirect: RedirectResolver): string | null {
  const normalized = normalizePublicPath(value);
  if (!normalized || !isPublicSitemapPath(normalized)) return null;
  const destination = normalized === "/products/recruitflow" ? "/products/nicerole" : resolveRedirect(normalized) ?? normalized;
  const path = normalizePublicPath(destination);
  return path && isPublicSitemapPath(path) ? path : null;
}

/** One entry per canonical public URL. The route injects its server-only redirect resolver. */
export function buildPublicSitemap(paths: readonly string[], records: readonly PublicContentRecord[], origin: string, resolveRedirect: RedirectResolver = () => null): MetadataRoute.Sitemap {
  const entries = new Map<string, MetadataRoute.Sitemap[number]>();
  const published = records.filter((record) => record.status === "PUBLISHED" && record.visibility === "PUBLIC");
  const excluded = new Set(published.filter((record) => record.seo.noindex).map((record) => canonicalPath(publicContentPath(record), resolveRedirect)));
  for (const value of paths) {
    const path = canonicalPath(value, resolveRedirect);
    if (!path || excluded.has(path)) continue;
    const url = new URL(path, origin).toString();
    entries.set(url, { url });
  }
  for (const record of published) {
    const path = canonicalPath(publicContentPath(record), resolveRedirect);
    if (!path || excluded.has(path)) continue;
    const url = new URL(path, origin).toString();
    const timestamp = Date.parse(record.updatedAt);
    const existing = entries.get(url);
    const previous = existing?.lastModified ? new Date(existing.lastModified).getTime() : -Infinity;
    // Never fabricate a modification time, or move an existing timestamp backwards.
    const lastModified = Number.isFinite(timestamp) && timestamp <= Date.now() && timestamp > previous
      ? new Date(timestamp).toISOString() : existing?.lastModified;
    entries.set(url, { url, ...(lastModified ? { lastModified } : {}) });
  }
  return [...entries.values()];
}
