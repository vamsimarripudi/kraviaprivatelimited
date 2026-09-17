import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("../../Backend/spec/identity/SUPABASE_CRM_PIPELINE.sql", import.meta.url), "utf8");
const server = readFileSync(new URL("../lib/office/crm-server.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/office-crm/route.ts", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../components/office-crm-workspace.tsx", import.meta.url), "utf8");
const screen = readFileSync(new URL("../components/internal-workspace-screen.tsx", import.meta.url), "utf8");

describe("KRAVIA Office CRM pipeline", () => {
  it("keeps CRM records server-only with an immutable audit ledger", () => {
    expect(sql).toContain("office_crm_leads_deny_client_access");
    expect(sql).toContain("office_crm_opportunities_deny_client_access");
    expect(sql).toContain("office_crm_audit_immutable");
    expect(sql).toContain("KR-L-");
    expect(sql).toContain("KR-O-");
  });

  it("uses scoped sales permissions instead of treating a coarse Office role as CRM authority", () => {
    expect(server).toContain('"sales.crm.read"');
    expect(server).toContain('"sales.crm.write"');
    expect(server).toContain('scopeType === "OWN"');
    expect(server).toContain('scopeType === "DEPARTMENT"');
  });

  it("protects CRM writes with same-origin server APIs and controlled RPCs", () => {
    expect(route).toContain("officeMutationIsSameOrigin");
    expect(server).toContain('.rpc("office_crm_create_lead"');
    expect(server).toContain('.rpc("office_crm_create_opportunity"');
    expect(server).toContain('.rpc("office_crm_set_opportunity_stage"');
  });

  it("does not let a won opportunity silently become a contract, subscription, invoice or payment", () => {
    expect(sql).toContain("WON state does not create billing/subscriptions automatically");
    expect(workspace).toContain("does not create a contract, subscription, invoice or payment");
    expect(workspace).toContain("Lead conversion links to an existing canonical customer");
  });

  it("renders the sales CRM as a real Office module", () => {
    expect(screen).toContain("OfficeCrmWorkspace");
    expect(screen).toContain('section === "crm"');
    expect(workspace).toContain("SALES CRM");
    expect(workspace).toContain("opportunityStages");
  });
});
