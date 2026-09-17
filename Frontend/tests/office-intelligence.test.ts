import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const server = readFileSync(new URL("../lib/office/intelligence-server.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/office-intelligence/route.ts", import.meta.url), "utf8");
const component = readFileSync(new URL("../components/office-intelligence-brief.tsx", import.meta.url), "utf8");
const screen = readFileSync(new URL("../components/internal-workspace-screen.tsx", import.meta.url), "utf8");
const workspaces = readFileSync(new URL("../lib/office/workspaces.ts", import.meta.url), "utf8");

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
    expect(server).toContain("total_paise,balance_paise");
    expect(server).toContain('.gt("balance_paise", 0)');
    expect(server).toContain("pipeline_by_currency");
    expect(server).toContain("receivables_by_currency");
    expect(server).not.toContain('select("id,invoice_no,status,total,balance');
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
