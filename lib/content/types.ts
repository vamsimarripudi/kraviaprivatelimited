export const contentStatuses = ["DRAFT", "IN_REVIEW", "CHANGES_REQUESTED", "APPROVED", "SCHEDULED", "PUBLISHED", "ARCHIVED"] as const;
export type ContentStatus = (typeof contentStatuses)[number];

export const publicContentTypes = [
  "COMPANY", "PRODUCT", "MILESTONE", "PRINCIPLE", "LEADERSHIP", "TECHNOLOGY", "RESEARCH",
  "NEWS", "PRESS_RELEASE", "ENGINEERING_ARTICLE", "TRUST_DOCUMENT", "POLICY", "CORPORATE_DISCLOSURE",
  "REPORT", "CAREER", "PARTNER", "FAQ",
] as const;
export type PublicContentType = (typeof publicContentTypes)[number];

export type ContentVisibility = "PRIVATE" | "PUBLIC";
export type ReviewDomain = "CONTENT" | "PRODUCT" | "TECHNOLOGY" | "SECURITY" | "PRIVACY" | "LEGAL" | "CORPORATE" | "DIRECTOR";
export type ChangeMateriality = "EDITORIAL" | "MINOR" | "MATERIAL" | "LEGAL_POLICY" | "CORPORATE_FACT";
export type SeoConfig = { title: string; description: string; canonicalPath?: string; ogImage?: string; noindex?: boolean };

export type PublicContentRecord = {
  id: string;
  type: PublicContentType;
  slug: string;
  title: string;
  summary?: string | null;
  body: unknown;
  status: ContentStatus;
  visibility: ContentVisibility;
  createdBy?: string | null;
  createdAt: string;
  updatedBy?: string | null;
  updatedAt: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  publishedAt?: string | null;
  scheduledFor?: string | null;
  contentOwner?: string | null;
  lastReviewedAt?: string | null;
  nextReviewAt?: string | null;
  version: number;
  seo: SeoConfig;
  category?: string | null;
  authorName?: string | null;
  relatedEntityIds?: string[];
};

export type ContentReview = { id: string; contentId: string; version: number; domain: ReviewDomain; status: "PENDING" | "APPROVED" | "CHANGES_REQUESTED" | "REJECTED"; reviewerId?: string | null; note?: string | null; reviewedAt?: string | null };
export type PublicClaim = { id: string; claim: string; category: "PRODUCT" | "SECURITY" | "PRIVACY" | "AI" | "CORPORATE" | "PERFORMANCE"; evidence?: string | null; evidenceDocumentId?: string | null; verificationStatus: "UNVERIFIED" | "VERIFIED" | "EXPIRED" | "REVIEW_REQUIRED"; owner: string; verifiedAt?: string | null; nextReviewAt?: string | null };
export type CorporateFact = { id: string; key: string; value: unknown; visibility: ContentVisibility; verificationStatus: "UNVERIFIED" | "DOCUMENT_VERIFIED" | "PROFESSIONAL_VERIFIED" | "DIRECTOR_APPROVED" | "PUBLIC_APPROVED"; source?: string | null; effectiveFrom?: string | null; effectiveTo?: string | null; lastReviewedAt?: string | null };
export type ContentRelationship = { fromId: string; predicate: "BUILDS" | "IS_A" | "OPERATES_IN" | "HAS_POLICY" | "RELATES_TO" | "ANNOUNCES" | "HAS_ROLE"; toId: string; public: boolean };
