import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component=readFileSync(new URL("../components/office-financial-assurance.tsx",import.meta.url),"utf8");
const screen=readFileSync(new URL("../components/internal-workspace-screen.tsx",import.meta.url),"utf8");
const backend=readFileSync(new URL("../../Backend/backend/main.py",import.meta.url),"utf8");

describe("KRAVIA Finance assurance workspace",()=>{
 it("uses one evidence model for finance compliance and audit",()=>{
  expect(component).toContain('type Mode="compliance"|"audit"');
  expect(component).toContain('runtime<ComplianceObligation[]>("compliance")');
  expect(component).toContain('runtime<Inspection[]>("inspections")');
  expect(component).toContain('runtime<DocumentRow[]>("documents")');
 });
 it("creates compliance obligations only as unverified records",()=>{
  expect(component).toContain('status:"UNVERIFIED"');
  expect(component).toContain("never creates a “compliant” or “filed” conclusion");
  expect(backend).toContain('@app.post("/api/v1/compliance", status_code=201)');
 });
 it("builds inspection manifests from canonical document versions and hashes",()=>{
  expect(component).toContain("/build-manifest");
  expect(component).toContain("lockedDocs");
  expect(backend).toContain('"sha256":ver.sha256');
  expect(backend).toContain('"readiness":"READY" if not warnings else "READY_WITH_WARNINGS"');
 });
 it("supports tamper-evident audit chain verification without claiming audit opinion",()=>{
  expect(component).toContain('runtime<ChainResult>("audit/verify-chain")');
  expect(component).toContain("it is not a legal or accounting opinion");
  expect(backend).toContain("expected=hashlib.sha256");
 });
 it("is wired to both remaining Finance assurance routes",()=>{
  expect(screen).toContain('section === "compliance" ? <OfficeFinancialAssurance');
  expect(screen).toContain('section === "audit" ? <OfficeFinancialAssurance');
 });
});
