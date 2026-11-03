import type { MetadataRoute } from "next";
import { isPublicSitemapPath, normalizePublicPath } from "./crawler-policy";
import { publicContentPath } from "./content/seo";
import type { PublicContentRecord } from "./content/types";
import { staticLegalRedirect } from "./legal/published-policy-pack";

function canonicalPath(value: string): string | null {
  const normalized = normalizePublicPath(value);
  if (!normalized || !isPublicSitemapPath(normalized)) return null;
  const path = normalized === "/products/recruitflow" ? "/products/nicerole" : staticLegalRedirect(normalized) ?? normalized;
  return isPublicSitemapPath(path) ? path : null;
}

/** One entry per canonical public URL, with published noindex decisions taking precedence. */
export function buildPublicSitemap(paths: readonly string[], records: readonly PublicContentRecord[], origin: string): MetadataRoute.Sitemap {
  const entries = new Map<string, MetadataRoute.Sitemap[number]>();
  const published = records.filter((record) => record.status === "PUBLISHED" && record.visibility === "PUBLIC");
  const excluded = new Set(published.filter((record) => record.seo.noindex).map((record) => canonicalPath(publicContentPath(record))));
  for (const value of paths) {
    const path = canonicalPath(value);
    if (!path || excluded.has(path)) continue;
    const url = new URL(path, origin).toString();
    entries.set(url, { url });
  }
  for (const record of published) {
    const path = canonicalPath(publicContentPath(record));
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
