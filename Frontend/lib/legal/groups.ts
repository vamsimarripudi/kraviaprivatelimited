import type { LegalDocumentGroup } from "./types";

/** Public-safe category labels; no draft policy metadata or candidate body lives here. */
export const legalDocumentGroupLabels: Record<LegalDocumentGroup, { title: string; description: string }> = {
  COMPANY_AND_TRUST: { title: "Company & trust", description: "How corporate information, public commitments and controlled documents are governed." },
  PRIVACY_AND_DATA_RIGHTS: { title: "Privacy & data rights", description: "Information choices, request handling, retention and transparent processing." },
  AI_AND_ACCEPTABLE_USE: { title: "AI & acceptable use", description: "Responsible use, limitations and safe use of Kravia services." },
  COMMERCIAL_TERMS: { title: "Commercial terms", description: "Service terms, subscriptions, changes and customer protections." },
  SECURITY_AND_REPORTING: { title: "Security & reporting", description: "Security information, responsible reporting and service safeguards." },
  REGIONAL_RIGHTS: { title: "Regional rights", description: "Supplements that apply only after the relevant legal and factual review." },
};
