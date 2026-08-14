import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";
const pages = ["", "company", "products", "technology", "governance", "disclosures", "trust", "trust/privacy", "trust/data-protection", "trust/security", "trust/responsible-ai", "updates", "careers", "contact", "legal"];
export default function sitemap(): MetadataRoute.Sitemap { return pages.map(page => ({ url: `${siteUrl}/${page}`, lastModified: new Date(), changeFrequency: "monthly", priority: page ? .7 : 1 })); }
