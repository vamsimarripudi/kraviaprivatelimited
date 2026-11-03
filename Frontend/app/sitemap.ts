import type { MetadataRoute } from "next";
import { listPublishedContent } from "@/lib/content/repository";
import { publicProducts } from "@/lib/corporate-content";
import { buildPublicSitemap } from "@/lib/search-sitemap";
import { isProductionSite, publicPages, siteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isProductionSite) return [];
  const productRoutes = publicProducts.filter((product) => product.public && product.href?.startsWith("/")).map((product) => product.href as string);
  const paths = ["/", "/support", "/company/leadership", "/company/faq", ...Object.keys(publicPages), ...productRoutes];
  return buildPublicSitemap(paths, await listPublishedContent(), siteUrl);
}
