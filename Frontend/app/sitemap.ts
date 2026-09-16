import type { MetadataRoute } from "next";
import { isPublicSitemapPath } from "@/lib/crawler-policy";
import { listPublishedContent } from "@/lib/content/repository";
import { publicContentPath } from "@/lib/content/seo";
import { publicProducts } from "@/lib/corporate-content";
import { publicPages, siteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const productRoutes = publicProducts
    .filter((product) => product.public && product.href?.startsWith("/"))
    .map((product) => product.href as string);
  const staticRoutes = ["", "support", ...Object.keys(publicPages), ...productRoutes]
    .filter((page, index, pages) => pages.indexOf(page) === index)
    .filter(isPublicSitemapPath)
    .map((page) => ({
      url: `${siteUrl}/${page.replace(/^\//, "")}`,
      changeFrequency: page === "newsroom" ? "weekly" as const : "monthly" as const,
      priority: page ? 0.7 : 1,
    }));
  const published = await listPublishedContent();
  const contentRoutes = published
    .filter((record) => !record.seo.noindex && isPublicSitemapPath(publicContentPath(record)))
    .map((record) => ({
      url: `${siteUrl}${publicContentPath(record)}`,
      lastModified: record.updatedAt,
      changeFrequency: record.type === "NEWS" || record.type === "PRESS_RELEASE" ? "weekly" as const : "monthly" as const,
      priority: record.type === "NEWS" || record.type === "PRESS_RELEASE" ? 0.8 : 0.7,
    }));
  return [...staticRoutes, ...contentRoutes];
}