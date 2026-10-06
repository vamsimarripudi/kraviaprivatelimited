import type { LegalDocumentBody, LegalDocumentSection } from "./types";

function asText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asSections(value: unknown): LegalDocumentSection[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const title = asText(record.title);
    const paragraphs = Array.isArray(record.paragraphs) ? record.paragraphs.map(asText).filter((paragraph): paragraph is string => Boolean(paragraph)) : [];
    if (!title || !paragraphs.length) return [];
    return [{ number: asText(record.number) ?? String(index + 1), title, paragraphs }];
  });
}

/** Parses only the approved canonical body schema used by the reader and PDF renderer. */
export function parseLegalDocumentBody(body: unknown): LegalDocumentBody | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  if (record.format !== "KRAVIA_LEGAL_DOCUMENT_V1") return null;
  const overview = asText(record.overview);
  const sections = asSections(record.sections);
  if (!overview || !sections.length) return null;
  const keyPoints = Array.isArray(record.keyPoints) ? record.keyPoints.map(asText).filter((point): point is string => Boolean(point)) : [];
  const relatedPaths = Array.isArray(record.relatedPaths) ? record.relatedPaths.filter((path): path is string => typeof path === "string" && path.startsWith("/")) : undefined;
  const approvedPdfPath = typeof record.approvedPdfPath === "string" && record.approvedPdfPath.startsWith("/") ? record.approvedPdfPath : null;
  return { format: "KRAVIA_LEGAL_DOCUMENT_V1", overview, keyPoints, sections, relatedPaths, approvedPdfPath };
}

export function legalSectionAnchor(section: LegalDocumentSection, index: number) {
  const normalized = section.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `section-${section.number.replace(/[^a-z0-9]+/gi, "-")}-${normalized || index + 1}`;
}
