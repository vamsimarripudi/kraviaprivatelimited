import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const server=readFileSync(new URL("../lib/office/recruitment-server.ts",import.meta.url),"utf8");
const screen=readFileSync(new URL("../components/office-recruitment-workspace.tsx",import.meta.url),"utf8");

describe("KRAVIA Recruitment catalog compatibility",()=>{
  it("reads only real production catalog columns, not nonexistent status or department_code",()=>{
    expect(server).toContain('select("code,label,family,is_manager,active").eq("active", true)');
    expect(server).toContain('select("code,label,active").eq("active", true)');
    expect(server).not.toContain('select("code,label,department_code,is_manager,status")');
    expect(server).not.toContain('select("code,label,status")');
  });
  it("requires deliberate department choice for new requisitions",()=>{
    expect(screen).toContain('type Position = { code: string; label: string; family: string; is_manager: boolean };');
    expect(screen).toContain('<option value="">Choose department</option>');
    expect(screen).toContain('Choose a position and department.');
    expect(screen).not.toContain('pos?.department_code');
    expect(screen).toContain('data.departments.map');
  });
});
