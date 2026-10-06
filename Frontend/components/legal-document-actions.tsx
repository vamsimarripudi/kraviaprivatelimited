"use client";

import { Printer } from "lucide-react";

export function LegalDocumentActions({ pdfHref }: { pdfHref?: string | null }) {
  return <div className="legal-document-actions" aria-label="Document actions">
    <button type="button" onClick={() => window.print()}><Printer aria-hidden="true" /> Print</button>
    {pdfHref ? <a href={pdfHref} download>Download approved PDF</a> : null}
  </div>;
}
