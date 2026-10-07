export const legalDocumentStates = ["REVIEW_DRAFT", "APPROVED_FUTURE", "CURRENT", "ARCHIVED", "WITHDRAWN", "PLANNED"] as const;
export type LegalDocumentState = (typeof legalDocumentStates)[number];

export type LegalDocumentGroup =
  | "COMPANY_AND_TRUST"
  | "PRIVACY_AND_DATA_RIGHTS"
  | "AI_AND_ACCEPTABLE_USE"
  | "COMMERCIAL_TERMS"
  | "SECURITY_AND_REPORTING"
  | "REGIONAL_RIGHTS";

export type LegalCandidateDocument = {
  id: `P${string}`;
  title: string;
  slug: string;
  route: `/legal/${string}`;
  group: LegalDocumentGroup;
  version: string;
  targetEffectiveDate: string;
  updatedAt: string;
  status: LegalDocumentState;
  publish: boolean;
  contentSha256: string;
  approvedContentSha256: string | null;
  requiredGates: readonly string[];
};

export type LegalApprovalEvidence = {
  scope: string | null;
  legalApprovedBy: string | null;
  legalApprovedAt: string | null;
  operationsApprovedBy: string | null;
  operationsApprovedAt: string | null;
  releaseApprovedBy: string | null;
  releaseApprovedAt: string | null;
};

export type LegalDocumentSection = {
  number: string;
  title: string;
  paragraphs: readonly string[];
  tables?: readonly LegalDocumentTable[];
};

export type LegalDocumentTable = {
  headers: readonly string[];
  rows: readonly (readonly string[])[];
};

/**
 * Canonical legal-document body shared by the web reader and a future approved
 * PDF renderer. Candidate source text is intentionally not bundled here.
 */
export type LegalDocumentBody = {
  format: "KRAVIA_LEGAL_DOCUMENT_V1";
  overview: string;
  keyPoints: readonly string[];
  sections: readonly LegalDocumentSection[];
  relatedPaths?: readonly string[];
  approvedPdfPath?: string | null;
  effectiveDate?: string | null;
};

export function isSha256(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}

/**
 * A target date, build, or draft flag can never make a policy public. This
 * predicate mirrors the database release gate and is useful for server-side
 * rendering and tests before a production database is configured.
 */
export function isApprovedForPublicRelease(
  document: LegalCandidateDocument,
  approvals: LegalApprovalEvidence,
  now = new Date(),
) {
  if (document.status !== "CURRENT" || !document.publish) return false;
  if (!isSha256(document.contentSha256) || document.approvedContentSha256 !== document.contentSha256) return false;
  if (!approvals.scope?.trim()) return false;
  if (![approvals.legalApprovedBy, approvals.legalApprovedAt, approvals.operationsApprovedBy, approvals.operationsApprovedAt, approvals.releaseApprovedBy, approvals.releaseApprovedAt].every(Boolean)) return false;
  const effectiveAt = Date.parse(document.targetEffectiveDate);
  return Number.isFinite(effectiveAt) && effectiveAt <= now.getTime();
}
