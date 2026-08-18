import type { ContentReview, ContentStatus, PublicContentRecord, PublicContentType, ReviewDomain, SeoConfig } from "./types";

export const highRiskClaimPattern = /(?:\b100%|\balways\b|\bnever\b|\bfully compliant\b|\bcertified\b|\bgovernment approved\b|\bmost secure\b|\bbest\b|#1|\bguaranteed\b|\bzero risk\b)/gi;

export function findHighRiskClaims(value: string) {
  return [...value.matchAll(highRiskClaimPattern)].map((match) => ({ phrase: match[0], index: match.index ?? 0 }));
}

export function requiredReviewDomains(type: PublicContentType, content: Pick<PublicContentRecord, "title" | "summary" | "body">): ReviewDomain[] {
  const text = `${content.title} ${content.summary ?? ""} ${typeof content.body === "string" ? content.body : JSON.stringify(content.body)}`;
  const domains: ReviewDomain[] = ["CONTENT"];
  if (["POLICY", "CORPORATE_DISCLOSURE"].includes(type)) domains.push("CORPORATE", "LEGAL");
  if (type === "TRUST_DOCUMENT" && /security/i.test(text)) domains.push("SECURITY", "CORPORATE");
  if (type === "TRUST_DOCUMENT" && /privacy|data protection|dpdp/i.test(text)) domains.push("PRIVACY", "LEGAL", "CORPORATE");
  if (type === "PRODUCT") domains.push("PRODUCT");
  if (["ENGINEERING_ARTICLE", "RESEARCH", "TECHNOLOGY"].includes(type)) domains.push("TECHNOLOGY");
  if (findHighRiskClaims(text).length > 0 && !domains.includes("CORPORATE")) domains.push("CORPORATE");
  return [...new Set(domains)];
}

export function hasRequiredApprovals(record: Pick<PublicContentRecord, "type" | "title" | "summary" | "body">, reviews: readonly ContentReview[]) {
  const approved = new Set(reviews.filter((review) => review.status === "APPROVED").map((review) => review.domain));
  return requiredReviewDomains(record.type, record).every((domain) => approved.has(domain));
}

const transitions: Record<ContentStatus, readonly ContentStatus[]> = {
  DRAFT: ["IN_REVIEW", "ARCHIVED"],
  IN_REVIEW: ["CHANGES_REQUESTED", "APPROVED", "ARCHIVED"],
  CHANGES_REQUESTED: ["DRAFT", "IN_REVIEW", "ARCHIVED"],
  APPROVED: ["SCHEDULED", "PUBLISHED", "ARCHIVED"],
  SCHEDULED: ["PUBLISHED", "APPROVED", "ARCHIVED"],
  PUBLISHED: ["ARCHIVED"],
  ARCHIVED: ["DRAFT"],
};

export function canTransitionContent(from: ContentStatus, to: ContentStatus) { return transitions[from].includes(to); }

export type SeoIssue = { code: "MISSING_TITLE" | "MISSING_DESCRIPTION" | "DESCRIPTION_LENGTH" | "INVALID_SLUG" | "MISSING_CANONICAL" | "MISSING_OG_IMAGE"; severity: "error" | "warning"; message: string };
export function validateSeo(input: { slug: string; seo: SeoConfig; type: PublicContentType }): SeoIssue[] {
  const issues: SeoIssue[] = [];
  if (!input.seo.title.trim()) issues.push({ code: "MISSING_TITLE", severity: "error", message: "Published content requires a unique page title." });
  if (!input.seo.description.trim()) issues.push({ code: "MISSING_DESCRIPTION", severity: "error", message: "Published content requires a meta description." });
  if (input.seo.description.length > 170 || input.seo.description.length < 45) issues.push({ code: "DESCRIPTION_LENGTH", severity: "warning", message: "Meta description should be reviewed for search-result readability." });
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) issues.push({ code: "INVALID_SLUG", severity: "error", message: "Slug must use stable lowercase words separated by hyphens." });
  if (!input.seo.canonicalPath) issues.push({ code: "MISSING_CANONICAL", severity: "error", message: "Published content requires a canonical path." });
  if (["NEWS", "PRESS_RELEASE", "ENGINEERING_ARTICLE", "RESEARCH", "PRODUCT"].includes(input.type) && !input.seo.ogImage) issues.push({ code: "MISSING_OG_IMAGE", severity: "warning", message: "Review the social-preview image before publishing." });
  return issues;
}

export function isPublishable(record: Pick<PublicContentRecord, "type" | "title" | "summary" | "body" | "slug" | "seo">, reviews: readonly ContentReview[]) {
  return hasRequiredApprovals(record, reviews) && !validateSeo(record).some((issue) => issue.severity === "error");
}
