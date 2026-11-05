import type { Metadata } from "next";
import { isProductionSite, publicSiteIdentity, siteUrl } from "./site";
import { isPublicSitemapPath, normalizePublicPath, publicPageRobots } from "./crawler-policy";

type PublicMetadataInput = { title: string; description: string; path: string; noindex?: boolean };

/** Page identity must not accidentally inherit the homepage's canonical or social title. */
export function buildPublicMetadata({ title, description, path, noindex = false }: PublicMetadataInput, production = isProductionSite): Metadata {
  const normalized = normalizePublicPath(path);
  const indexable = production && !noindex && Boolean(normalized && isPublicSitemapPath(normalized));
  const canonical = normalized ? new URL(normalized, siteUrl).toString() : undefined;
  const socialTitle = `${title} | ${publicSiteIdentity.name}`;
  return {
    title,
    description,
    alternates: canonical ? { canonical } : undefined,
    robots: publicPageRobots(indexable),
    openGraph: { type: "website", siteName: publicSiteIdentity.name, title: socialTitle, description, url: canonical },
    twitter: { card: "summary_large_image", site: "@KraviaOfficial", title: socialTitle, description },
  };
}

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
