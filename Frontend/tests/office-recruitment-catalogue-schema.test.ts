import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const server = readFileSync(new URL("../lib/office/recruitment-server.ts", import.meta.url), "utf8");
const screen = readFileSync(new URL("../components/office-recruitment-workspace.tsx", import.meta.url), "utf8");

describe("KRAVIA recruitment canonical catalogue schema", () => {
  it("reads only real active position and department catalogue columns", () => {
    expect(server).toContain('.from("office_position_catalog").select("code,label,family,is_manager,active").eq("active", true)');
    expect(server).toContain('.from("office_department_catalog").select("code,label,active").eq("active", true)');
    expect(server).not.toContain('.select("code,label,department_code,is_manager,status")');
    expect(server).not.toContain('.select("code,label,status")');
  });

  it("separates hiring positions from departments without inventing their association", () => {
    expect(screen).toContain("type Position = { code: string; label: string; family: string; is_manager: boolean; active: boolean }");
    expect(screen).toContain('department: data?.departments[0]?.code || ""');
    expect(screen).toContain('onChange={(e)=>setDraft({...draft,department:e.target.value})}');
    expect(screen).not.toContain("pos?.department_code");
    expect(screen).toContain("position:e.target.value");
  });

  it("keeps recruitment permissions and governed approvals in the existing backend", () => {
    expect(server).toContain("resolveOfficePermission");
    expect(server).toContain("hiring.requisition.read");
    expect(server).toContain("hiring.requisition.manage");
    expect(server).toContain("office_hiring_requisition_create");
    expect(server).toContain("office_hiring_requisition_submit");
    expect(server).toContain("Recruitment selection, compensation, offer approval");
  });
});
