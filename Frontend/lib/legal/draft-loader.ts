import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { legalCandidateBySlug } from "./registry";
import type { LegalDocumentBody, LegalDocumentSection } from "./types";

const sourceFiles: Record<string, string> = {
  "trust-charter": "P01_trust_charter.md", privacy: "P02_privacy.md", terms: "P03_terms.md", "ai-policy": "P04_ai_policy.md", "acceptable-use": "P05_acceptable_use.md", disclaimer: "P06_disclaimer.md", cookies: "P07_cookies.md", "billing-refunds": "P08_billing_refunds.md", "data-rights": "P09_data_rights.md", "retention-deletion": "P10_retention_deletion.md", security: "P11_security.md", "vulnerability-disclosure": "P12_vulnerability_disclosure.md", subprocessors: "P13_subprocessors.md", communications: "P14_communications.md", "intellectual-property": "P15_intellectual_property.md", accessibility: "P16_accessibility.md", grievance: "P17_grievance.md", "product-sunset": "P18_product_sunset.md", "beta-research": "P19_beta_research.md", "legal-requests-transfers": "P20_legal_requests_transfers.md", "india-privacy": "P21_india_privacy.md", "us-privacy": "P22_us_privacy.md", "europe-uk-privacy": "P23_europe_uk_privacy.md", "consumer-rights": "P24_consumer_rights.md", resources: "P25_resources.md", "policy-versions": "P26_policy_versions.md",
};

function paragraphs(value: string) {
  return value.split(/\r?\n\s*\r?\n/).map((paragraph) => paragraph.replace(/\r?\n/g, " ").trim()).filter((paragraph) => paragraph && !paragraph.startsWith("**") && !paragraph.startsWith("---"));
}

/** Parses an externally supplied review pack only in an explicit local-review environment. */
export function parseLegalDraftMarkdown(markdown: string): LegalDocumentBody | null {
  const parts = markdown.split(/(?=^##\s+)/m);
  const summaryPart = parts.find((part) => /^##\s+Summary\s*$/mi.test(part));
  const overview = summaryPart ? paragraphs(summaryPart.replace(/^##\s+Summary\s*$/mi, ""))[0] : null;
  const sections: LegalDocumentSection[] = parts.flatMap((part, index) => {
    const heading = /^##\s+(\d+)\.\s+(.+)$/m.exec(part);
    if (!heading) return [];
    const body = paragraphs(part.slice((heading.index ?? 0) + heading[0].length));
    return body.length ? [{ number: heading[1] ?? String(index), title: heading[2]!.trim(), paragraphs: body }] : [];
  });
  if (!overview || !sections.length) return null;
  return { format: "KRAVIA_LEGAL_DOCUMENT_V1", overview, keyPoints: paragraphs(summaryPart?.replace(/^##\s+Summary\s*$/mi, "") ?? "").slice(1, 5), sections };
}

export function localLegalPreviewEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.KRAVIA_ENABLE_LEGAL_LOCAL_PREVIEW === "true";
}

export async function loadLocalLegalDraft(slug: string) {
  if (!localLegalPreviewEnabled()) return null;
  const candidate = legalCandidateBySlug(slug);
  const fileName = sourceFiles[slug];
  const configuredDirectory = process.env.KRAVIA_LEGAL_DRAFT_SOURCE_DIR?.trim();
  if (!candidate || !fileName || !configuredDirectory || !path.isAbsolute(configuredDirectory)) return null;
  const sourceDirectory = path.resolve(configuredDirectory);
  const filePath = path.resolve(sourceDirectory, fileName);
  if (path.dirname(filePath) !== sourceDirectory) return null;
  try {
    const body = parseLegalDraftMarkdown(await readFile(filePath, "utf8"));
    return body ? { candidate, body } : null;
  } catch {
    return null;
  }
}
