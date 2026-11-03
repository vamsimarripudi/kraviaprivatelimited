import type { Metadata, MetadataRoute } from "next";

export const privatePathPrefixes = ["/admin", "/api", "/auth", "/corporate", "/office", "/finance", "/privacy-request", "/legal/preview"] as const;

/** Documented search/user-fetch agents. Training-specific permissions are unchanged. */
export const searchCrawlerAgents = [
  "Googlebot", "bingbot", "Applebot", "OAI-SearchBot", "ChatGPT-User",
  "PerplexityBot", "Perplexity-User", "Claude-SearchBot", "Claude-User",
] as const;

/** Each specific group repeats the boundaries: it does not inherit the wildcard group. */
export function crawlerPolicy(production: boolean, canonicalUrl: string): MetadataRoute.Robots {
  if (!production) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [...searchCrawlerAgents, "*"].map((userAgent) => ({ userAgent, allow: "/", disallow: [...privatePathPrefixes] })),
    sitemap: `${canonicalUrl}/sitemap.xml`,
  };
}

export function publicPageRobots(production: boolean): Metadata["robots"] {
  return production ? { index: true, follow: true } : { index: false, follow: false, nocache: true };
}

function hasForbiddenPathCharacters(value: string): boolean {
  return /[\\?#\s]/.test(value) || [...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
}

/** Canonical paths are local, query-free and unambiguous; never accept an external URL. */
export function normalizePublicPath(path: string): string | null {
  if (path !== path.trim() || /^[a-z][a-z\d+.-]*:/i.test(path) || path.startsWith("//")) return null;
  if (hasForbiddenPathCharacters(path) || /%2f|%5c|%25/i.test(path)) return null;
  let decoded: string;
  try { decoded = decodeURIComponent(path); } catch { return null; }
  if (hasForbiddenPathCharacters(decoded) || decoded.split("/").some((part) => part === "." || part === "..")) return null;
  const normalized = `/${decoded.split("/").filter(Boolean).join("/")}`;
  return new URL(normalized, "https://path.invalid").pathname;
}

/** Robots is not access control. Authentication remains mandatory on private routes. */
export function isPublicSitemapPath(path: string): boolean {
  const normalized = normalizePublicPath(path);
  if (!normalized) return false;
  const comparable = normalized.toLowerCase();
  return !privatePathPrefixes.some((prefix) => comparable === prefix || comparable.startsWith(`${prefix}/`));
}
