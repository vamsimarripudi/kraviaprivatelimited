import type { PublicContentRecord } from "@/lib/content/types";
import { paginateLegalDocumentForPrint } from "@/lib/legal/print-layout";
import type { LegalDocumentBody } from "@/lib/legal/types";
import styles from "./legal-document.module.css";

type LegalPrintDocumentProps = {
  article: PublicContentRecord;
  document: LegalDocumentBody;
  effective?: string | null;
  updated?: string | null;
};

function labelDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeZone: "Asia/Kolkata" }).format(date);
}

/** Print-only A4 rendering over the supplied KRAVIA corporate letterhead. */
export function LegalPrintDocument({ article, document, effective, updated }: LegalPrintDocumentProps) {
  const pages = paginateLegalDocumentForPrint(document);
  const totalPages = pages.length + 1;
  const effectiveDate = labelDate(effective);
  const updatedDate = labelDate(updated);

  return <div className={styles.printDocument} aria-hidden="true" data-legal-print-document>
    <section className={styles.printPage}>
      <img className={styles.printLetterhead} src="/legal/kravia-letterhead-a4.png" alt="" />
      <div className={styles.printContent}>
        <p className={styles.printKicker}>APPROVED PUBLIC POLICY</p>
        <h1>{article.title}</h1>
        <dl className={styles.printMetadata}>
          <div><dt>Version</dt><dd>{article.version}</dd></div>
          <div><dt>Effective</dt><dd>{effectiveDate ?? "Approved public release"}</dd></div>
          {updatedDate && updatedDate !== effectiveDate ? <div><dt>Updated</dt><dd>{updatedDate}</dd></div> : null}
        </dl>
        <p className={styles.printOverview}>{document.overview}</p>
        {document.keyPoints.length ? <section className={styles.printKeyPoints}><h2>Reading guide</h2><ul>{document.keyPoints.map((point) => <li key={point}>{point}</li>)}</ul></section> : null}
        <nav className={styles.printContents} aria-label="Printed document contents"><h2>Contents</h2><ol>{document.sections.map((section) => <li key={`${section.number}-${section.title}`}><span>{section.number}</span>{section.title}</li>)}</ol></nav>
      </div>
      <p className={styles.printPageNumber}>Page 1 of {totalPages}</p>
    </section>

    {pages.map((page, pageIndex) => <section className={styles.printPage} key={`print-page-${pageIndex + 2}`}>
      <img className={styles.printLetterhead} src="/legal/kravia-letterhead-a4.png" alt="" />
      <div className={styles.printContent}>
        {page.fragments.map((fragment, fragmentIndex) => <section className={styles.printSection} key={`${fragment.number}-${fragmentIndex}`}>
          <div className={styles.printSectionHeading}><p>{fragment.number}</p><h2>{fragment.title}{fragment.continued ? " (continued)" : ""}</h2></div>
          {fragment.paragraphs.map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}
          {fragment.tables.map((table, tableIndex) => <table key={tableIndex}><thead><tr>{table.headers.map((header) => <th key={header} scope="col">{header}</th>)}</tr></thead><tbody>{table.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table>)}
        </section>)}
      </div>
      <p className={styles.printPageNumber}>Page {pageIndex + 2} of {totalPages}</p>
    </section>)}
  </div>;
}
