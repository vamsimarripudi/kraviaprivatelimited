import type { MetadataRoute } from "next";
import { isProductionSite, siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  if (!isProductionSite) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/corporate", "/privacy-request", "/api/"] }],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
