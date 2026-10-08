"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { formatLegalPrintDate, type LegalPrintReservation } from "@/lib/legal/print-reference";

type PrintState = "idle" | "preparing" | "opening" | "submitting" | "submitted" | "error";
type Toast = { tone: "success" | "error"; message: string };

function setPrintedRecord(job: LegalPrintReservation) {
  document.querySelectorAll<HTMLElement>("[data-legal-print-reference]").forEach((element) => { element.textContent = job.referenceNo; });
  document.querySelectorAll<HTMLElement>("[data-legal-print-date]").forEach((element) => { element.textContent = formatLegalPrintDate(job.issuedOn); });
}

function waitForPrintLayout() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

export function LegalDocumentActions({ pdfHref, canManageCookies = false }: { pdfHref?: string | null; canManageCookies?: boolean }) {
  const [printState, setPrintState] = useState<PrintState>("idle");
  const [, setReservation] = useState<LegalPrintReservation | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(null), 6_000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const recordPrintEvent = async (job: LegalPrintReservation, event: "DIALOG_OPENED" | "DIALOG_CLOSED") => {
    try {
      const response = await fetch(`/api/legal/print-jobs/${job.jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event }),
      });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error || "We could not update the print request.");
      return true;
    } catch {
      return false;
    }
  };

  const printLegalDocument = async () => {
    setPrintState("preparing");
    setToast(null);
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

      setPrintState("opening");
      if (!await recordPrintEvent(job, "DIALOG_OPENED")) {
        throw new Error("We could not prepare the print request. Please try again.");
      }

      let settled = false;
      const recordDialogClosed = async () => {
        if (settled) return;
        settled = true;
        setPrintState("submitting");
        if (await recordPrintEvent(job, "DIALOG_CLOSED")) {
          setPrintState("submitted");
          setToast({ tone: "success", message: "Print request completed." });
        } else {
          setPrintState("error");
          setToast({ tone: "error", message: "We could not record this print request. Please try again." });
        }
      };
      window.addEventListener("afterprint", () => { void recordDialogClosed(); }, { once: true });
      await waitForPrintLayout();
      window.print();
    } catch (error) {
      setPrintState("error");
      setToast({ tone: "error", message: error instanceof Error ? error.message : "We could not prepare this document for printing." });
    }
  };

  return <div className="legal-document-actions" aria-label="Document actions">
    <button type="button" onClick={() => void printLegalDocument()} disabled={printState === "preparing" || printState === "opening" || printState === "submitting"}><Printer aria-hidden="true" /> {printState === "preparing" || printState === "opening" ? "Preparing print…" : printState === "submitting" ? "Saving print request…" : "Print"}</button>
    {canManageCookies ? <button type="button" onClick={() => window.dispatchEvent(new Event("kravia:open-privacy-choices"))}>Manage cookies</button> : null}
    {pdfHref ? <a href={pdfHref} download>Download approved PDF</a> : null}
    {toast ? <p className={`legal-document-actions__toast legal-document-actions__toast--${toast.tone}`} role={toast.tone === "error" ? "alert" : "status"}>{toast.message}</p> : null}
  </div>;
}
