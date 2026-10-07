"use client";

import { Printer } from "lucide-react";

function printLegalDocument() {
  const root = document.documentElement;
  const clearPrintMode = () => root.removeAttribute("data-legal-print");
  root.setAttribute("data-legal-print", "true");
  window.addEventListener("afterprint", clearPrintMode, { once: true });
  window.print();
}

export function LegalDocumentActions({ pdfHref, canManageCookies = false }: { pdfHref?: string | null; canManageCookies?: boolean }) {
  return <div className="legal-document-actions" aria-label="Document actions">
    <button type="button" onClick={printLegalDocument}><Printer aria-hidden="true" /> Print</button>
    {canManageCookies ? <button type="button" onClick={() => window.dispatchEvent(new Event("kravia:open-privacy-choices"))}>Manage cookies</button> : null}
    {pdfHref ? <a href={pdfHref} download>Download approved PDF</a> : null}
  </div>;
}
