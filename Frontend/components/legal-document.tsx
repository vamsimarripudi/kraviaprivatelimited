import Link from "next/link";
import { ArrowUpRight, FileText } from "lucide-react";
import { LegalDocumentActions } from "@/components/legal-document-actions";
import type { PublicContentRecord } from "@/lib/content/types";
import { legalSectionAnchor, parseLegalDocumentBody } from "@/lib/legal/document-body";
import type { LegalDocumentBody } from "@/lib/legal/types";
import styles from "./legal-document.module.css";

function dateLabel(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeZone: "Asia/Kolkata" }).format(date);
}

function fallbackBody(article: PublicContentRecord): LegalDocumentBody {
  const paragraphs = typeof article.body === "string"
    ? [article.body]
    : Array.isArray(article.body)
      ? article.body.flatMap((block) => typeof block === "string" ? [block] : block && typeof block === "object" && "text" in block && typeof block.text === "string" ? [block.text] : [])
      : [];
  return {
    format: "KRAVIA_LEGAL_DOCUMENT_V1",
    overview: article.summary ?? "This approved public document is provided for the scope stated below.",
    keyPoints: [],
    sections: [{ number: "1", title: "Document", paragraphs: paragraphs.length ? paragraphs : ["The approved document body is not available in this view."] }],
  };
}

/** A restrained, semantic legal reader. It has no global styles and does not touch the site shell or footer. */
export function LegalDocument({ article }: { article: PublicContentRecord }) {
  const document = parseLegalDocumentBody(article.body) ?? fallbackBody(article);
  const updated = dateLabel(article.updatedAt);
  const effective = dateLabel(document.effectiveDate ?? article.publishedAt);
  return <article className={styles.document} aria-labelledby="legal-document-title">
    <header className={styles.header}>
      <p className="eyebrow">LEGAL &amp; TRUST</p>
      <h1 id="legal-document-title">{article.title}</h1>
      <div className={styles.metadata}>
        {effective ? <span>Effective {effective}</span> : <span>Approved public document</span>}
        {updated && updated !== effective ? <span>Updated {updated}</span> : null}
        <span>Version {article.version}</span>
      </div>
      <p className={styles.overview}>{document.overview}</p>
      <LegalDocumentActions pdfHref={document.approvedPdfPath} />
    </header>

    {document.keyPoints.length ? <section className={styles.keyPoints} aria-labelledby="key-points-title">
      <p className="eyebrow">SUMMARY OF KEY POINTS</p>
      <h2 id="key-points-title">A quick reading guide</h2>
      <ul>{document.keyPoints.map((point) => <li key={point}>{point}</li>)}</ul>
    </section> : null}

    <nav className={styles.contents} aria-label="Document contents">
      <p className="eyebrow">TABLE OF CONTENTS</p>
      <ol>{document.sections.map((section, index) => <li key={legalSectionAnchor(section, index)}><a href={`#${legalSectionAnchor(section, index)}`}><span>{section.number}</span>{section.title}</a></li>)}</ol>
    </nav>

    <div className={styles.reading}>
      {document.sections.map((section, index) => <section key={legalSectionAnchor(section, index)} id={legalSectionAnchor(section, index)} className={styles.section}>
        <p className={styles.number}>{section.number}</p>
        <div><h2>{section.title}</h2>{section.paragraphs.map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}{section.tables?.map((table, tableIndex) => <div className={styles.tableWrap} key={tableIndex}><table><thead><tr>{table.headers.map((header) => <th scope="col" key={header}>{header}</th>)}</tr></thead><tbody>{table.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>)}</div>
      </section>)}
    </div>

    {document.relatedPaths?.length ? <aside className={styles.related} aria-label="Related documents"><p className="eyebrow">RELATED DOCUMENTS</p>{document.relatedPaths.map((path) => <Link key={path} href={path}>Read related document <ArrowUpRight aria-hidden="true" /></Link>)}</aside> : null}
  </article>;
}

export function LegalDocumentUnavailable() {
  return <section className={styles.unavailable}><FileText aria-hidden="true" /><div><p className="eyebrow">PUBLICATION CONTROL</p><h1>No additional legal document is currently published.</h1><p>Review drafts, approval records and evidence remain private until the applicable release gate is complete.</p></div></section>;
}
