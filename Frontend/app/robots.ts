import type { MetadataRoute } from "next";
import { crawlerPolicy } from "@/lib/crawler-policy";
import { isProductionSite, siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  // Robots is crawler guidance, not access control. Private routes remain
  // protected by auth/RLS and use route-level noindex metadata.
  return crawlerPolicy(isProductionSite, siteUrl);
}