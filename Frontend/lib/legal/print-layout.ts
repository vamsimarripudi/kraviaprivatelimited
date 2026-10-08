import type { LegalDocumentBody, LegalDocumentTable } from "./types";

export type LegalPrintTable = {
  headers: readonly string[];
  rows: (readonly string[])[];
};

export type LegalPrintFragment = {
  number: string;
  title: string;
  continued: boolean;
  paragraphs: readonly string[];
  tables: readonly LegalPrintTable[];
};

export type LegalPrintPage = {
  fragments: readonly LegalPrintFragment[];
};

type MutableFragment = {
  number: string;
  title: string;
  continued: boolean;
  paragraphs: string[];
  tables: LegalPrintTable[];
};

type MutablePage = {
  used: number;
  fragments: MutableFragment[];
};

// Conservative units keep content inside the usable A4 letterhead area. Each
// rendered page is explicit, so the page total is deterministic across print UIs.
// The A4 body reaches below the letterhead's second rule and above its footer.
// This matches the actual 54mm top / 34mm bottom print area rather than
// artificially creating a sparse final page.
// Calibrated against the approved A4 letterhead and the rendered browser PDF.
// The prior value forced sparse pages despite there being usable body space.
const PRINT_PAGE_CAPACITY = 2_120;
const SECTION_HEADING_COST = 130;
const TABLE_HEADER_COST = 100;

function paragraphCost(value: string) {
  return Math.max(96, Math.ceil(value.length / 72) * 32 + 32);
}

function rowCost(row: readonly string[]) {
  return Math.max(58, Math.ceil(row.join(" ").length / 70) * 27 + 26);
}

function splitLongParagraph(value: string) {
  if (value.length <= 840) return [value];
  const parts: string[] = [];
  let current = "";
  for (const word of value.split(/\s+/)) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > 760 && current) {
      parts.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function asPrintableTable(table: LegalDocumentTable): LegalPrintTable {
  return { headers: table.headers, rows: [] };
}

/** The web reader and print reader consume the same approved document body. */
export function paginateLegalDocumentForPrint(document: LegalDocumentBody): readonly LegalPrintPage[] {
  const pages: MutablePage[] = [{ used: 0, fragments: [] }];
  const current = () => pages[pages.length - 1]!;
  const nextPage = () => {
    const page: MutablePage = { used: 0, fragments: [] };
    pages.push(page);
    return page;
  };

  for (const section of document.sections) {
    let printedSectionContent = false;

    const fragmentFor = (page: MutablePage) => {
      const last = page.fragments[page.fragments.length - 1];
      if (last?.number === section.number && last.title === section.title) return last;
      const fragment: MutableFragment = {
        number: section.number,
        title: section.title,
        continued: printedSectionContent,
        paragraphs: [],
        tables: [],
      };
      page.fragments.push(fragment);
      page.used += SECTION_HEADING_COST;
      return fragment;
    };

    for (const paragraph of section.paragraphs) {
      for (const part of splitLongParagraph(paragraph)) {
        const cost = paragraphCost(part);
        let page = current();
        const startsFragment = !(page.fragments[page.fragments.length - 1]?.number === section.number && page.fragments[page.fragments.length - 1]?.title === section.title);
        if (page.used > 0 && page.used + cost + (startsFragment ? SECTION_HEADING_COST : 0) > PRINT_PAGE_CAPACITY) page = nextPage();
        const fragment = fragmentFor(page);
        fragment.paragraphs.push(part);
        page.used += cost;
        printedSectionContent = true;
      }
    }

    for (const table of section.tables ?? []) {
      let tableFragment: LegalPrintTable | null = null;
      for (const row of table.rows) {
        const cost = rowCost(row);
        let page = current();
        const startsFragment = !(page.fragments[page.fragments.length - 1]?.number === section.number && page.fragments[page.fragments.length - 1]?.title === section.title);
        const startsTable = tableFragment === null;
        if (page.used > 0 && page.used + cost + (startsFragment ? SECTION_HEADING_COST : 0) + (startsTable ? TABLE_HEADER_COST : 0) > PRINT_PAGE_CAPACITY) {
          page = nextPage();
          tableFragment = null;
        }
        const fragment = fragmentFor(page);
        if (!tableFragment) {
          tableFragment = asPrintableTable(table);
          fragment.tables.push(tableFragment);
          page.used += TABLE_HEADER_COST;
        }
        tableFragment.rows.push(row);
        page.used += cost;
        printedSectionContent = true;
      }
    }
  }

  return pages.filter((page) => page.fragments.length).map((page) => ({ fragments: page.fragments }));
}
