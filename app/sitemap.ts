import type { MetadataRoute } from "next";
import { listPublishedContent } from "@/lib/content/repository";
import { publicContentPath } from "@/lib/content/seo";
import { publicPages, siteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = ["", "support", ...Object.keys(publicPages)].map((page) => ({ url: `${siteUrl}/${page}`, changeFrequency: page === "newsroom" ? "weekly" as const : "monthly" as const, priority: page ? 0.7 : 1 }));
  const published = await listPublishedContent();
  const contentRoutes = published.filter((record) => !record.seo.noindex).map((record) => ({ url: `${siteUrl}${publicContentPath(record)}`, lastModified: record.updatedAt, changeFrequency: record.type === "NEWS" || record.type === "PRESS_RELEASE" ? "weekly" as const : "monthly" as const, priority: record.type === "NEWS" || record.type === "PRESS_RELEASE" ? 0.8 : 0.7 }));
  return [...staticRoutes, ...contentRoutes];
}
