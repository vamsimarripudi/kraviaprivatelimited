import type { Metadata } from "next";
import { siteUrl } from "../site";
import type { PublicContentRecord } from "./types";

export function contentPath(record: Pick<PublicContentRecord, "type" | "slug">) {
  if (["NEWS", "PRESS_RELEASE", "ENGINEERING_ARTICLE", "RESEARCH"].includes(record.type)) return `/newsroom/${record.slug}`;
  if (record.type === "CAREER") return `/careers/${record.slug}`;
  if (["COMPANY", "MILESTONE", "PRINCIPLE", "LEADERSHIP"].includes(record.type)) return `/company/${record.slug}`;
  if (record.type === "PRODUCT") return `/products/${record.slug}`;
  if (record.type === "TECHNOLOGY") return `/technology/${record.slug}`;
  if (["TRUST_DOCUMENT", "POLICY"].includes(record.type)) return `/trust/${record.slug}`;
  if (["CORPORATE_DISCLOSURE", "REPORT"].includes(record.type)) return `/disclosures/${record.slug}`;
  if (record.type === "PARTNER") return `/partners/${record.slug}`;
  return `/resources/${record.slug}`;
}

/** One public route for one approved record. Editors may override this only with a valid governed canonical path. */
export function publicContentPath(record: Pick<PublicContentRecord, "type" | "slug" | "seo">) {
  return record.seo.canonicalPath || contentPath(record);
}

export function contentMetadata(record: PublicContentRecord): Metadata {
  const path = publicContentPath(record);
  const canonical = new URL(path, siteUrl).toString();
  const image = record.seo.ogImage ? new URL(record.seo.ogImage, siteUrl).toString() : undefined;
  return {
    title: record.seo.title || record.title,
    description: record.seo.description || record.summary || undefined,
    alternates: { canonical },
    robots: record.seo.noindex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: { title: record.seo.title || record.title, description: record.seo.description || record.summary || undefined, url: canonical, type: record.type === "NEWS" || record.type === "PRESS_RELEASE" ? "article" : "website", images: image ? [image] : undefined },
  };
}

export function articleJsonLd(record: PublicContentRecord) {
  if (!["NEWS", "PRESS_RELEASE", "ENGINEERING_ARTICLE", "RESEARCH"].includes(record.type)) return null;
  return {
    "@context": "https://schema.org", "@type": record.type === "PRESS_RELEASE" ? "NewsArticle" : "Article",
    headline: record.title, description: record.summary ?? undefined, datePublished: record.publishedAt ?? undefined,
    dateModified: record.updatedAt, mainEntityOfPage: new URL(publicContentPath(record), siteUrl).toString(),
    author: { "@type": "Organization", name: record.authorName || "KRAVIA PRIVATE LIMITED" },
    publisher: { "@type": "Organization", name: "KRAVIA PRIVATE LIMITED" },
    image: record.seo.ogImage ? [new URL(record.seo.ogImage, siteUrl).toString()] : undefined,
  };
}
