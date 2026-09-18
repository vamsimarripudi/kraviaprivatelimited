import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const server=readFileSync(new URL("../lib/office/audit-explorer-server.ts",import.meta.url),"utf8");
const component=readFileSync(new URL("../components/office-audit-explorer.tsx",import.meta.url),"utf8");
const screen=readFileSync(new URL("../components/internal-workspace-screen.tsx",import.meta.url),"utf8");
const backend=readFileSync(new URL("../../Backend/backend/main.py",import.meta.url),"utf8");

describe("KRAVIA corporate audit explorer",()=>{
 it("combines authorized Office evidence with the separate runtime audit stream",()=>{
  expect(server).toContain("getOfficeActivityTimeline");
  expect(server).toContain('from("office_access_audit")');
  expect(server).toContain('from("office_registration_events")');
  expect(server).not.toContain('from("audit_events")');
  expect(component).toContain('/api/office-audit-explorer');
  expect(component).toContain('/api/office-runtime/audit');
  expect(screen).toContain("OfficeAuditExplorer");
 });
 it("keeps cryptographic verification scoped to the runtime chain",()=>{
  expect(component).toContain('/api/office-runtime/audit/verify-chain');
  expect(component).toContain("Office control-plane events are a separate append-oriented source");
  expect(backend).toContain("expected=hashlib.sha256");
 });
 it("does not present either source as a statutory audit opinion",()=>{
  expect(server).toContain("neither source is presented as a statutory audit opinion");
  expect(server).toContain("without reading or granting access to the legacy FastAPI audit table");
 });
 it("requires audit read authority on the Office source",()=>{
  expect(server).toContain('"audit.read"');
  expect(server).toContain('"access.audit.read"');
 });
 it("wires the Office audit route to the specialised explorer",()=>{
  expect(screen).toContain('section === "audit" ? <OfficeAuditExplorer');
 });
});
