import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const server = readFileSync(new URL("../lib/office/activity-server.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/office-activity/route.ts", import.meta.url), "utf8");
const component = readFileSync(new URL("../components/office-activity-timeline.tsx", import.meta.url), "utf8");
const screen = readFileSync(new URL("../components/internal-workspace-screen.tsx", import.meta.url), "utf8");

describe("Office activity timeline", () => {
  it("reuses already-authorized domain read models", () => {
    expect(server).toContain("getOfficeTaskInbox");
    expect(server).toContain("getOfficeWorkOverview");
    expect(server).toContain("getOfficeCrmOverview");
    expect(server).toContain("getOfficeEngineeringControlCenter");
    expect(server).toContain("does not bypass record authorization");
  });

  it("is exposed through a read-only API", () => {
    expect(route).toContain("export async function GET");
    expect(route).not.toContain("export async function POST");
    expect(route).not.toContain("export async function PATCH");
    expect(route).not.toContain("export async function DELETE");
  });

  it("renders on the Office dashboard and refuses fabricated events", () => {
    expect(screen).toContain("OfficeActivityTimeline");
    expect(screen).toContain("<OfficeActivityTimeline />");
    expect(component).toContain("The timeline stays empty rather than inventing company events.");
  });
});
