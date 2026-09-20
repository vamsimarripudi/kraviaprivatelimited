import type { Metadata, MetadataRoute } from "next";

export const privatePathPrefixes = ["/admin", "/api", "/auth", "/corporate", "/office", "/finance", "/privacy-request"] as const;

/** A single, framework-neutral policy for crawler guidance and sitemap eligibility. */
export function crawlerPolicy(production: boolean, canonicalUrl: string): MetadataRoute.Robots {
  if (!production) return { rules: [{ userAgent: "*", disallow: "/" }] };

  return {
    rules: [{ userAgent: "*", allow: "/", disallow: [...privatePathPrefixes] }],
    sitemap: `${canonicalUrl}/sitemap.xml`,
  };
}


/**
 * Page metadata mirrors the robots.txt environment boundary. This protects
 * preview deployments even when a crawler reaches a page through a direct URL
 * rather than first reading robots.txt.
 */
export function publicPageRobots(production: boolean): Metadata["robots"] {
  return production
    ? { index: true, follow: true }
    : { index: false, follow: false, nocache: true };
}

/** Robots is not access control. This only prevents non-public routes entering a sitemap. */
export function isPublicSitemapPath(path: string): boolean {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return !privatePathPrefixes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
}
