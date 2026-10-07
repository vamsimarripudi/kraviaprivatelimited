import "server-only";

import { createHash } from "node:crypto";
import release from "@/data/legal/public-policy-release-v1.json";
import type { PublicContentRecord } from "@/lib/content/types";
import { parseLegalPolicyMarkdown } from "./policy-markdown";
import { legalCandidateDocuments } from "./registry";
import type { LegalDocumentGroup } from "./types";

type ReleaseSourceDocument = {
  id: string;
  title: string;
  slug: string;
  version: string;
  effectiveDate: string;
  updatedAt: string;
  contentSha256: string;
  body: string;
};

type ReleaseManifest = {
  format: string;
  sourcePackVersion: string;
  sourcePreparedAt: string;
  documents: readonly ReleaseSourceDocument[];
};

const manifest = release as ReleaseManifest;
const publicReleaseDate = "2026-10-07T00:00:00.000Z";
const candidateById = new Map(legalCandidateDocuments.map((candidate) => [candidate.id, candidate]));

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function releaseFailure(message: string): never {
  throw new Error(`Invalid KRAVIA public legal release: ${message}`);
}

function releaseDocument(source: ReleaseSourceDocument): PublicContentRecord {
  const candidate = candidateById.get(source.id as `P${string}`);
  if (!candidate) releaseFailure(`unknown policy source ${source.id}`);
  if (candidate.slug !== source.slug || candidate.title !== source.title || candidate.version !== source.version) {
    releaseFailure(`registry metadata mismatch for ${source.id}`);
  }
  if (candidate.contentSha256 !== source.contentSha256 || sha256(source.body) !== source.contentSha256) {
    releaseFailure(`body hash mismatch for ${source.id}`);
  }
  const document = parseLegalPolicyMarkdown(source.body);
  if (!document) releaseFailure(`unreadable canonical body for ${source.id}`);
  const body = {
    ...document,
    effectiveDate: source.effectiveDate,
    // The supplied PDF extracts visibly identify themselves as review drafts.
    // Do not expose a misleading download until corrected public PDFs exist.
    approvedPdfPath: null,
  };
  return {
    id: `public-legal-${source.id.toLowerCase()}`,
    type: "POLICY",
    slug: source.slug,
    title: source.title,
    summary: document.overview,
    body,
    status: "PUBLISHED",
    visibility: "PUBLIC",
    createdAt: `${manifest.sourcePreparedAt}T00:00:00.000Z`,
    updatedAt: `${source.updatedAt}T00:00:00.000Z`,
    publishedAt: publicReleaseDate,
    version: Number(source.version),
    category: candidate.group,
    seo: {
      title: `${source.title} | Kravia Private Limited`,
      description: document.overview,
      canonicalPath: `/legal/${source.slug}`,
    },
  };
}

if (manifest.format !== "KRAVIA_PUBLIC_LEGAL_RELEASE_V1" || manifest.sourcePackVersion !== "1.0") {
  releaseFailure("unsupported release manifest");
}
if (manifest.documents.length !== 26 || new Set(manifest.documents.map((document) => document.id)).size !== 26) {
  releaseFailure("expected exactly 26 unique P-series policies");
}

/**
 * Immutable website release snapshot derived from the exact P01–P26 source
 * bodies. The database publication workflow remains authoritative for all
 * subsequent revisions and archive states.
 */
export const publishedLegalPolicyRecords: readonly PublicContentRecord[] = Object.freeze(
  [...manifest.documents]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(releaseDocument),
);

const publishedLegalPolicyBySlug = new Map(publishedLegalPolicyRecords.map((record) => [record.slug, record]));

export function legalDocumentGroup(record: PublicContentRecord): LegalDocumentGroup | null {
  const group = record.category;
  return group && ["COMPANY_AND_TRUST", "PRIVACY_AND_DATA_RIGHTS", "AI_AND_ACCEPTABLE_USE", "COMMERCIAL_TERMS", "SECURITY_AND_REPORTING", "REGIONAL_RIGHTS"].includes(group)
    ? group as LegalDocumentGroup
    : null;
}

/** Preserves historic Trust Center URLs while canonicalising v1 policies under /legal. */
export function staticLegalRedirect(path: string) {
  const match = /^\/trust\/([a-z0-9-]+)$/.exec(path);
  if (!match || !publishedLegalPolicyBySlug.has(match[1]!)) return null;
  return `/legal/${match[1]}`;
}
