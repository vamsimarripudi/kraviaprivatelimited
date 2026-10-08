import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseLegalDocumentBody } from "../lib/legal/document-body";
import { paginateLegalDocumentForPrint } from "../lib/legal/print-layout";
import { formatLegalPrintDate } from "../lib/legal/print-reference";
import { parseLegalPolicyMarkdown } from "../lib/legal/policy-markdown";
import { legalCandidateDocuments } from "../lib/legal/registry";
import { isApprovedForPublicRelease } from "../lib/legal/types";

const releaseMigration = readFileSync(new URL("../../Database/supabase/migrations/202610060002_legal_trust_release_gate.sql", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/[...segments]/page.tsx", import.meta.url), "utf8");
const center = readFileSync(new URL("../components/legal-trust-center.tsx", import.meta.url), "utf8");
const preview = readFileSync(new URL("../app/legal/preview/[slug]/page.tsx", import.meta.url), "utf8");
const previewLoader = readFileSync(new URL("../lib/legal/draft-loader.ts", import.meta.url), "utf8");
const legalStyles = readFileSync(new URL("../components/legal-document.module.css", import.meta.url), "utf8");
const legalCenterStyles = readFileSync(new URL("../components/legal-trust-center.module.css", import.meta.url), "utf8");
const printReader = readFileSync(new URL("../components/legal-print-document.tsx", import.meta.url), "utf8");
const printActions = readFileSync(new URL("../components/legal-document-actions.tsx", import.meta.url), "utf8");
const printRoute = readFileSync(new URL("../app/api/legal/print-jobs/route.ts", import.meta.url), "utf8");
const printConfirmationRoute = readFileSync(new URL("../app/api/legal/print-jobs/[jobId]/route.ts", import.meta.url), "utf8");
const publicPolicyRelease = JSON.parse(readFileSync(new URL("../data/legal/public-policy-release-v1.json", import.meta.url), "utf8")) as { documents: { slug: string; body: string }[] };

describe("Legal & Trust Center publication guard", () => {
  it("keeps source-pack candidate metadata as an unpublishable provenance record", () => {
    expect(legalCandidateDocuments).toHaveLength(26);
    for (const document of legalCandidateDocuments) {
      expect(document.status).toBe("REVIEW_DRAFT");
      expect(document.publish).toBe(false);
      expect(document.approvedContentSha256).toBeNull();
      expect(isApprovedForPublicRelease(document, {
        scope: null,
        legalApprovedBy: null,
        legalApprovedAt: null,
        operationsApprovedBy: null,
        operationsApprovedAt: null,
        releaseApprovedBy: null,
        releaseApprovedAt: null,
      })).toBe(false);
    }
  });

  it("requires matching content, named approvals, scope and an effective date before a policy can be public", () => {
    const candidate = legalCandidateDocuments[0]!;
    const ready = {
      ...candidate,
      status: "CURRENT" as const,
      publish: true,
      approvedContentSha256: candidate.contentSha256,
    };
    const approvals = {
      scope: "Corporate website public policy release",
      legalApprovedBy: "legal-reviewer-id",
      legalApprovedAt: "2026-10-06T10:00:00.000Z",
      operationsApprovedBy: "operations-reviewer-id",
      operationsApprovedAt: "2026-10-06T10:00:00.000Z",
      releaseApprovedBy: "release-owner-id",
      releaseApprovedAt: "2026-10-06T10:00:00.000Z",
    };
    expect(isApprovedForPublicRelease(ready, approvals, new Date("2026-10-31T23:59:59.000Z"))).toBe(false);
    expect(isApprovedForPublicRelease(ready, approvals, new Date("2026-11-01T00:00:00.000Z"))).toBe(true);
  });

  it("renders the legal reader from a structured canonical body with navigable sections", () => {
    expect(parseLegalDocumentBody({
      format: "KRAVIA_LEGAL_DOCUMENT_V1",
      overview: "A controlled, approved document.",
      keyPoints: ["A concise point"],
      sections: [{ number: "1", title: "Scope", paragraphs: ["The approved scope."] }],
      relatedPaths: ["/legal/privacy"],
    })).toEqual(expect.objectContaining({ overview: "A controlled, approved document." }));
    expect(parseLegalDocumentBody({ format: "UNKNOWN", overview: "x", sections: [] })).toBeNull();
  });

  it("uses published records only, keeps local source preview out of production, and isolates legal CSS from the footer", () => {
    expect(page).toContain("content.type === \"POLICY\"");
    expect(center).not.toContain("legalCandidateDocuments");
    expect(center).not.toContain("@/lib/legal/registry");
    expect(preview).toContain("localLegalPreviewEnabled");
    expect(previewLoader).toContain('process.env.NODE_ENV !== "production"');
    expect(legalStyles).not.toContain("footer");
    expect(legalStyles).not.toContain(":global(body)");
  });

  it("keeps the legal reader phone-friendly without forcing a wide policy table", () => {
    expect(legalStyles).toContain("font-family:Helvetica,Arial,sans-serif");
    expect(legalStyles).toContain("table-layout:fixed");
    expect(legalStyles).not.toContain("min-width:34rem");
    expect(legalCenterStyles).toContain("font-family:Helvetica,Arial,sans-serif");
  });

  it("renders a deterministic, letterhead-backed A4 print reader without changing public policy text", () => {
    expect(printReader).toContain('/legal/kravia-letterhead-a4.png');
    expect(printReader).toContain("Page 1 of {totalPages}");
    expect(printReader).toContain("Page {pageIndex + 2} of {totalPages}");
    expect(legalStyles).toContain("@page{size:A4 portrait;margin:0}");
    expect(legalStyles).toContain(".printLetterhead");
    expect(legalStyles).toContain(".printPageNumber");
  });

  it("uses server-issued date and reference fields while preserving the approved letterhead asset", () => {
    expect(printReader).toContain('data-legal-print-reference');
    expect(printReader).toContain('data-legal-print-date');
    expect(printReader).toContain('corporate@kraviaprivatelimited.com');
    expect(printReader).toContain('/legal/kravia-letterhead-a4.png');
    expect(legalStyles).toContain('.printContent{padding-bottom:34mm}');
    expect(formatLegalPrintDate("2026-10-07")).toMatch(/October/);
  });

  it("reserves and confirms legal print jobs without trusting browser results as proof of a completed print", () => {
    expect(printActions).toContain('fetch("/api/legal/print-jobs"');
    expect(printActions).toContain('window.addEventListener("afterprint"');
    expect(printActions).toContain('Mark as printed');
    expect(printActions).toContain('Print again with this reference');
    expect(printRoute).toContain("getPublishedContentByPublicPath");
    expect(printRoute).toContain("consumeLegalPrintRateLimit");
    expect(printRoute).toContain("signLegalPrintReservation");
    expect(printRoute).not.toContain("createAdminClient");
    expect(printConfirmationRoute).toContain("verifyLegalPrintReservation");
    expect(printConfirmationRoute).toContain("completeLegalPrintReservation");
    expect(printConfirmationRoute).not.toContain("createAdminClient");
  });

  it("keeps all canonical paragraphs and table rows when a policy spans print pages", () => {
    const paragraphs = Array.from({ length: 10 }, (_, index) => `Controlled policy paragraph ${index + 1}. ${"Evidence-backed public policy text. ".repeat(14)}`);
    const document = {
      format: "KRAVIA_LEGAL_DOCUMENT_V1" as const,
      overview: "A controlled policy document.",
      keyPoints: [],
      sections: [{ number: "1", title: "Scope", paragraphs, tables: [{ headers: ["Control", "Purpose"], rows: [["A", "First purpose"], ["B", "Second purpose"]] }] }],
    };
    const pages = paginateLegalDocumentForPrint(document);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.flatMap((page) => page.fragments).flatMap((fragment) => fragment.paragraphs)).toEqual(paragraphs);
    expect(pages.flatMap((page) => page.fragments).flatMap((fragment) => fragment.tables).flatMap((table) => table.rows)).toEqual([["A", "First purpose"], ["B", "Second purpose"]]);
  });

  it("creates complete numbered print pages for every published policy", () => {
    for (const record of publicPolicyRelease.documents) {
      const document = parseLegalPolicyMarkdown(record.body);
      expect(document, record.slug).not.toBeNull();
      const pages = paginateLegalDocumentForPrint(document!);
      expect(pages.length, record.slug).toBeGreaterThan(0);
      const sourceParagraphs = document!.sections.flatMap((section) => section.paragraphs);
      const printedParagraphs = pages.flatMap((page) => page.fragments).flatMap((fragment) => fragment.paragraphs);
      expect(printedParagraphs, record.slug).toEqual(sourceParagraphs);
      const sourceRows = document!.sections.flatMap((section) => section.tables ?? []).flatMap((table) => table.rows);
      const printedRows = pages.flatMap((page) => page.fragments).flatMap((fragment) => fragment.tables).flatMap((table) => table.rows);
      expect(printedRows, record.slug).toEqual(sourceRows);
    }
  });

  it("enforces release evidence in the database without seeding or publishing any draft", () => {
    expect(releaseMigration).toContain("create table public.legal_document_releases");
    expect(releaseMigration).toContain("approved_content_sha256 = content_sha256");
    expect(releaseMigration).toContain("legal_document_is_releasable");
    expect(releaseMigration).toContain("new.status in ('SCHEDULED','PUBLISHED')");
    expect(releaseMigration).toContain("alter table public.legal_document_releases enable row level security");
    expect(releaseMigration).not.toMatch(/insert\s+into\s+public\.content_records/i);
    expect(releaseMigration).not.toMatch(/insert\s+into\s+public\.content_publications/i);
  });
});
