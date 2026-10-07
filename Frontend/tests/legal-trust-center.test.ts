import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseLegalDocumentBody } from "../lib/legal/document-body";
import { legalCandidateDocuments } from "../lib/legal/registry";
import { isApprovedForPublicRelease } from "../lib/legal/types";

const releaseMigration = readFileSync(new URL("../../Database/supabase/migrations/202610060002_legal_trust_release_gate.sql", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/[...segments]/page.tsx", import.meta.url), "utf8");
const center = readFileSync(new URL("../components/legal-trust-center.tsx", import.meta.url), "utf8");
const preview = readFileSync(new URL("../app/legal/preview/[slug]/page.tsx", import.meta.url), "utf8");
const previewLoader = readFileSync(new URL("../lib/legal/draft-loader.ts", import.meta.url), "utf8");
const legalStyles = readFileSync(new URL("../components/legal-document.module.css", import.meta.url), "utf8");

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
