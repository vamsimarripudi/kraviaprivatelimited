import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component=readFileSync(new URL("../components/office-operations-monitoring.tsx",import.meta.url),"utf8");
const screen=readFileSync(new URL("../components/internal-workspace-screen.tsx",import.meta.url),"utf8");
const gateway=readFileSync(new URL("../app/api/office-runtime/[...path]/route.ts",import.meta.url),"utf8");
const readiness=readFileSync(new URL("../lib/office/readiness-server.ts",import.meta.url),"utf8");
const backend=readFileSync(new URL("../../Backend/backend/main.py",import.meta.url),"utf8");

describe("KRAVIA Office runtime observability",()=>{
  it("routes protected operations through the same-origin Office runtime gateway",()=>{
    expect(gateway).toContain('"operations"');
    expect(gateway).toContain("officeMutationIsSameOrigin(request)");
    expect(component).toContain('runtime<OperationsSummary>("operations/summary")');
    expect(component).toContain('runtime<OperationalAlert[]>("operations/alerts")');
  });

  it("keeps Supabase-owned readiness evidence separate from backend-owned legacy tables",()=>{
    expect(readiness).toContain('office_oncall_rotations');
    expect(readiness).toContain('office_maintenance_windows');
    expect(readiness).toContain('office_retention_rules');
    expect(readiness).not.toContain('admin.from("integration_registry")');
    expect(readiness).not.toContain('admin.from("operational_alerts")');
  });

  it("does not fabricate SLO attainment without telemetry",()=>{
    expect(backend).toContain('"measured_availability_percent": None');
    expect(backend).toContain('"measured_latency_p95_ms": None');
    expect(backend).toContain("does not claim measured SLO attainment");
    expect(component).toContain("Not measured");
  });

  it("evaluates backend-owned runtime alert conditions",()=>{
    expect(backend).toContain('runtime:event-outbox-backlog');
    expect(backend).toContain('runtime:workflow-failures');
    expect(backend).toContain('runtime:integration-readiness');
    expect(backend).toContain('runtime:slo-telemetry');
    expect(component).toContain("Evaluate alerts");
  });

  it("renders monitoring alongside executive readiness",()=>{
    expect(screen).toContain("OfficeOperationsMonitoring");
    expect(screen).toContain('section === "readiness"');
  });
});
