import type { PublicContentRecord, PublicContentType } from "./types";

/** Public-hub collections are type-governed and receive only records from the public repository. */
export const publicHubContentTypes: Partial<Record<string, readonly PublicContentType[]>> = {
  company: ["COMPANY", "MILESTONE", "PRINCIPLE", "LEADERSHIP"],
  products: ["PRODUCT"],
  technology: ["TECHNOLOGY", "ENGINEERING_ARTICLE", "RESEARCH"],
  trust: ["TRUST_DOCUMENT", "POLICY"],
  governance: ["CORPORATE_DISCLOSURE"],
  disclosures: ["CORPORATE_DISCLOSURE", "REPORT"],
  careers: ["CAREER"],
};

export function publicContentForHub(key: string, records: readonly PublicContentRecord[]) {
  const types = publicHubContentTypes[key];
  return types ? records.filter((record) => types.includes(record.type)) : [];
}