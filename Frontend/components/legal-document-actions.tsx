"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import { formatLegalPrintDate, type LegalPrintReservation } from "@/lib/legal/print-reference";

type PrintState = "idle" | "preparing" | "confirming" | "saving" | "saved" | "error";

function setPrintedRecord(job: LegalPrintReservation) {
  document.querySelectorAll<HTMLElement>("[data-legal-print-reference]").forEach((element) => { element.textContent = job.referenceNo; });
  document.querySelectorAll<HTMLElement>("[data-legal-print-date]").forEach((element) => { element.textContent = formatLegalPrintDate(job.issuedOn); });
}

function waitForPrintLayout() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

export function LegalDocumentActions({ pdfHref, canManageCookies = false }: { pdfHref?: string | null; canManageCookies?: boolean }) {
  const [printState, setPrintState] = useState<PrintState>("idle");
  const [reservation, setReservation] = useState<LegalPrintReservation | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const recordOutcome = async (job: LegalPrintReservation, status: "PRINTED" | "RETRY") => {
    setPrintState("saving");
    setMessage(null);
    try {
      const response = await fetch(`/api/legal/print-jobs/${job.jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error || "We could not update the print record.");
      if (status === "PRINTED") {
        setPrintState("saved");
        setMessage(`Print reference ${job.referenceNo} has been marked as printed.`);
      } else {
        setPrintState("idle");
        setMessage(`Print reference ${job.referenceNo} remains reserved and will be reused when you print again.`);
      }
      return true;
    } catch (error) {
      setPrintState("error");
      setMessage(error instanceof Error ? error.message : "We could not update the print record.");
      return false;
    }
  };

  const printLegalDocument = async () => {
    setPrintState("preparing");
    setMessage(null);
    try {
      const response = await fetch("/api/legal/print-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: window.location.pathname }),
      });
      const body = await response.json().catch(() => null) as (LegalPrintReservation & { error?: string }) | null;
      if (!response.ok || !body?.jobId || !body.referenceNo || !body.issuedOn) throw new Error(body?.error || "We could not prepare this document for printing.");
      const job: LegalPrintReservation = { jobId: body.jobId, referenceNo: body.referenceNo, issuedOn: body.issuedOn, attemptCount: body.attemptCount };
      setReservation(job);
      setPrintedRecord(job);

      const root = document.documentElement;
      const clearPrintMode = () => {
        root.removeAttribute("data-legal-print");
        setPrintState("confirming");
        setMessage(`Did ${job.referenceNo} print successfully? Confirm only after the document has actually printed.`);
      };
      root.setAttribute("data-legal-print", "true");
      window.addEventListener("afterprint", clearPrintMode, { once: true });
      await waitForPrintLayout();
      window.print();
    } catch (error) {
      setPrintState("error");
      setMessage(error instanceof Error ? error.message : "We could not prepare this document for printing.");
    }
  };

  return <div className="legal-document-actions" aria-label="Document actions">
    <button type="button" onClick={() => void printLegalDocument()} disabled={printState === "preparing" || printState === "saving"}><Printer aria-hidden="true" /> {printState === "preparing" ? "Preparing print…" : "Print"}</button>
    {canManageCookies ? <button type="button" onClick={() => window.dispatchEvent(new Event("kravia:open-privacy-choices"))}>Manage cookies</button> : null}
    {pdfHref ? <a href={pdfHref} download>Download approved PDF</a> : null}
    {printState === "confirming" && reservation ? <span className="legal-document-actions__confirmation">
      <button type="button" onClick={() => void recordOutcome(reservation, "PRINTED")}>Mark as printed</button>
      <button type="button" onClick={() => void (async () => { if (await recordOutcome(reservation, "RETRY")) await printLegalDocument(); })()}>Print again with this reference</button>
    </span> : null}
    {message ? <p className="legal-document-actions__status" role={printState === "error" ? "alert" : "status"}>{message}</p> : null}
  </div>;
}
