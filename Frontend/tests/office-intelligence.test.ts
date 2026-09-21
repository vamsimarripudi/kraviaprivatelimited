import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const server = readFileSync(new URL("../lib/office/intelligence-server.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/office-intelligence/route.ts", import.meta.url), "utf8");
const component = readFileSync(new URL("../components/office-intelligence-brief.tsx", import.meta.url), "utf8");
const screen = readFileSync(new URL("../components/internal-workspace-screen.tsx", import.meta.url), "utf8");
const workspaces = readFileSync(new URL("../lib/office/workspaces.ts", import.meta.url), "utf8");
const backend = readFileSync(new URL("../../Backend/backend/main.py", import.meta.url), "utf8");

describe("KRAVIA Intelligence", () => {
  it("is executive-only and read-only", () => {
    expect(server).toContain('role === "OWNER" || role === "DIRECTOR"');
    expect(server).toContain("Read-only intelligence");
    expect(route).toContain("export async function GET");
    expect(route).not.toContain("export async function POST");
    expect(route).not.toContain("export async function PATCH");
    expect(route).not.toContain("export async function DELETE");
  });

  it("uses canonical finance monetary columns and never combines different currencies", () => {
    expect(server).toContain('readOfficeRuntimeResult<Array<Record<string,unknown>>>("invoices")');
    expect(server).toContain("Number(row.balance_paise||0)>0");
    expect(backend).toContain('"total_paise": inv.total_paise');
    expect(backend).toContain('"balance_paise": inv.balance_paise');
    expect(server).toContain("pipeline_by_currency");
    expect(server).toContain("receivables_by_currency");
    expect(server).not.toContain('select("id,invoice_no,status,total,balance');
  });

  it("uses canonical first-party sessions without fabricated risk scoring", () => {
    expect(server).toContain('from("office_auth_sessions_v2")');
    expect(server).not.toContain('from("office_auth_sessions")');
    expect(server).toContain("auth_sessions_without_aal2");
    expect(server).not.toContain("risk_level");
    expect(server).not.toContain("high_risk_auth_sessions");
  });

  it("surfaces operational exceptions without claiming legal or provider conclusions", () => {
    expect(server).toContain("it is not a legal conclusion about compliance");
    expect(server).toContain("does not independently probe provider uptime");
    expect(server).toContain("No material exception triggered by current stored data");
  });

  it("renders a real executive workspace and compact founder dashboard brief", () => {
    expect(workspaces).toContain("intelligence:");
    expect(workspaces).toContain('title: "KRAVIA Intelligence"');
    expect(screen).toContain("OfficeIntelligenceBrief");
    expect(screen).toContain('section === "intelligence"');
    expect(screen).toContain("<OfficeIntelligenceBrief compact />");
    expect(component).toContain("No autonomous writes");
  });
});
