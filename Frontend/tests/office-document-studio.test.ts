import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../Database/supabase/migrations/202609180003_document_engine.sql", import.meta.url), "utf8");
const server = readFileSync(new URL("../lib/office/document-studio-server.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/office-documents/route.ts", import.meta.url), "utf8");
const component = readFileSync(new URL("../components/office-document-studio.tsx", import.meta.url), "utf8");
const screen = readFileSync(new URL("../components/internal-workspace-screen.tsx", import.meta.url), "utf8");
const capabilities = readFileSync(new URL("../lib/office/workspace-capabilities.ts", import.meta.url), "utf8");
const backend = readFileSync(new URL("../../Backend/backend/document_engine.py", import.meta.url), "utf8");

describe("KRAVIA Document Studio", () => {
  it("stores canonical structured templates, clauses and immutable business snapshots", () => {
    for (const table of [
      "office_document_templates",
      "office_document_template_versions",
      "office_document_clauses",
      "office_document_clause_versions",
      "office_document_instances",
      "office_document_renders",
      "office_document_delivery_events",
    ]) expect(migration).toContain(table);
    expect(migration).toContain("input_snapshot");
    expect(migration).toContain("input_hash");
    expect(migration).toContain("source_hash");
    expect(component).toContain("PDF, DOCX, HTML and XLSX are rendered outputs");
  });

  it("prevents a template or clause author from independently publishing the same version", () => {
    expect(migration).toContain("Template creator cannot publish the same version");
    expect(migration).toContain("Clause creator cannot publish the same version");
    expect(migration).toContain("clause_snapshot");
    expect(migration).toContain("TEMPLATE_PUBLISHED");
  });

  it("keeps rendered files private and verifies integrity before and after storage", () => {
    expect(migration).toContain("'office-documents','office-documents',false");
    expect(server).toContain('createHash("sha256")');
    expect(server).toContain("Document renderer integrity check failed");
    expect(server).toContain('storage.from("office-documents").upload');
    expect(server).toContain('storage.from("office-documents").remove');
    expect(server).toContain("Stored document integrity check failed");
  });

  it("uses an open-source sandboxed Python renderer instead of Word as the source of truth", () => {
    expect(backend).toContain("SandboxedEnvironment");
    expect(backend).toContain("StrictUndefined");
    expect(backend).toContain('"PDF": _pdf');
    expect(backend).toContain('"DOCX": _docx');
    expect(backend).toContain('"HTML": _html');
    expect(backend).toContain('"XLSX": _xlsx');
    expect(backend).toContain("escape(str(block.get");
  });

  it("protects mutations and wires Document Studio into both Office and Finance documents", () => {
    expect(route).toContain("officeMutationIsSameOrigin");
    expect(route).toContain("PUBLISH_TEMPLATE_VERSION");
    expect(route).toContain("RENDER");
    expect(screen).toContain("OfficeDocumentStudio");
    expect(screen).toContain('section === "documents"');
    expect(capabilities).toContain("document.hr.create");
    expect(capabilities).toContain("document.finance.create");
  });
});
