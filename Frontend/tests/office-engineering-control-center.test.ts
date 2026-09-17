import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("../../Backend/spec/identity/SUPABASE_ENGINEERING_CONTROL_CENTER.sql", import.meta.url), "utf8");
const server = readFileSync(new URL("../lib/office/engineering-server.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/office-engineering/route.ts", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../components/office-engineering-control-center.tsx", import.meta.url), "utf8");
const screen = readFileSync(new URL("../components/internal-workspace-screen.tsx", import.meta.url), "utf8");

describe("KRAVIA Office engineering control center", () => {
  it("stores engineering references and incident history server-side without provider credentials", () => {
    expect(sql).toContain("office_engineering_services");
    expect(sql).toContain("office_engineering_deployments");
    expect(sql).toContain("office_engineering_incident_events_immutable");
    expect(sql).toContain("secret values are never stored here");
    expect(sql).toContain("revoke all on public.office_engineering_services");
  });

  it("filters service visibility by project infrastructure or repository read permission", () => {
    expect(server).toContain('"engineering.infrastructure.read"');
    expect(server).toContain('"engineering.repo.read"');
    expect(server).toContain("projectRead.allowed || access.repositoryRead?.allowed");
    expect(server).toContain("runtime_redacted");
  });

  it("requires scoped engineering permissions for service and incident mutations", () => {
    expect(server).toContain('"engineering.infrastructure.change"');
    expect(server).toContain('"engineering.issue.manage"');
    expect(route).toContain("officeMutationIsSameOrigin");
    expect(server).toContain('.rpc("office_engineering_register_service"');
    expect(server).toContain('.rpc("office_engineering_create_incident"');
  });

  it("does not fabricate deployment or provider health records", () => {
    expect(workspace).toContain("No deployment evidence recorded");
    expect(workspace).toContain("trusted integration or verified import records a real deployment");
    expect(workspace).toContain("No engineering services registered");
  });

  it("renders engineering as a real Office module", () => {
    expect(screen).toContain("OfficeEngineeringControlCenter");
    expect(screen).toContain('section === "engineering"');
    expect(workspace).toContain("ENGINEERING CONTROL CENTER");
  });
});
