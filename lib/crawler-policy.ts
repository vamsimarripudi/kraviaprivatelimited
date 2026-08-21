import type { MetadataRoute } from "next";

const privatePathPrefixes = ["/admin", "/api", "/auth", "/corporate", "/privacy-request"];

/** A single, framework-neutral policy for crawler guidance and sitemap eligibility. */
export function crawlerPolicy(production: boolean, canonicalUrl: string): MetadataRoute.Robots {
  if (!production) return { rules: [{ userAgent: "*", disallow: "/" }] };

  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${canonicalUrl}/sitemap.xml`,
  };
}

/** Robots is not access control. This only prevents non-public routes entering a sitemap. */
export function isPublicSitemapPath(path: string): boolean {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return !privatePathPrefixes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
}