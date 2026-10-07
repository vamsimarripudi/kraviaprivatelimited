import type { LegalDocumentBody, LegalDocumentSection, LegalDocumentTable } from "./types";

function paragraphs(value: string) {
  return value
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.replace(/\r?\n/g, " ").trim())
    .filter((paragraph) => paragraph && !paragraph.startsWith("**") && !paragraph.startsWith("---"));
}

function parseTable(lines: readonly string[]): LegalDocumentTable | null {
  if (lines.length < 2) return null;
  const rows = lines.map((line) => line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()));
  if (!rows[0]?.length || !rows[1]?.every((cell) => /^:?-{3,}:?$/.test(cell))) return null;
  const headers = rows[0];
  const body = rows.slice(2).filter((row) => row.length === headers.length);
  return body.length ? { headers, rows: body } : null;
}

function contentBlocks(value: string) {
  const tables: LegalDocumentTable[] = [];
  const prose: string[] = [];
  for (const block of value.split(/\r?\n\s*\r?\n/)) {
    const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length && lines.every((line) => line.startsWith("|"))) {
      const table = parseTable(lines);
      if (table) {
        tables.push(table);
        continue;
      }
    }
    prose.push(...paragraphs(block));
  }
  return { paragraphs: prose, tables };
}

/** Parses a P-series Markdown body into the shared web/PDF reader schema. */
export function parseLegalPolicyMarkdown(markdown: string): LegalDocumentBody | null {
  const parts = markdown.split(/(?=^##\s+)/m);
  const summaryPart = parts.find((part) => /^##\s+Summary\s*$/mi.test(part));
  const summary = summaryPart ? paragraphs(summaryPart.replace(/^##\s+Summary\s*$/mi, "")) : [];
  const overview = summary[0] ?? null;
  const sections: LegalDocumentSection[] = parts.flatMap((part, index) => {
    const heading = /^##\s+(\d+)\.\s+(.+)$/m.exec(part);
    if (!heading) return [];
    const body = contentBlocks(part.slice((heading.index ?? 0) + heading[0].length));
    if (!body.paragraphs.length && !body.tables.length) return [];
    return [{ number: heading[1] ?? String(index), title: heading[2]!.trim(), paragraphs: body.paragraphs, tables: body.tables }];
  });
  if (!overview || !sections.length) return null;
  return { format: "KRAVIA_LEGAL_DOCUMENT_V1", overview, keyPoints: summary.slice(1, 5), sections };
}
