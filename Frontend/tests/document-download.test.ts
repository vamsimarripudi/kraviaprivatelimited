import { describe, expect, it } from "vitest";
import { documentDownloadPath, safeDocumentFilename } from "../lib/corporate/document-download";

describe("authenticated corporate document downloads", () => {
  it("uses a server download route rather than a public storage path", () => {
    expect(documentDownloadPath("11111111-1111-1111-1111-111111111111")).toBe("/api/corporate/documents/11111111-1111-1111-1111-111111111111/download");
  });
  it("does not leak uploaded filenames in the response filename", () => {
    expect(safeDocumentFilename("11111111-1111-1111-1111-111111111111", "application/pdf")).toBe("KRAVIA_Corporate_Document_11111111-1111-1111-1111-111111111111.pdf");
  });
});
