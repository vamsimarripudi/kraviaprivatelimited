import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../Database/supabase/migrations/202609170001_commercial_handoff.sql", import.meta.url), "utf8");
const stageMigration = readFileSync(new URL("../../Database/supabase/migrations/202609170002_commercial_handoff_request.sql", import.meta.url), "utf8");
const server = readFileSync(new URL("../lib/office/commercial-server.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/office-commercial/route.ts", import.meta.url), "utf8");
const component = readFileSync(new URL("../components/office-commercial-handoff.tsx", import.meta.url), "utf8");
const screen = readFileSync(new URL("../components/internal-workspace-screen.tsx", import.meta.url), "utf8");

describe("Office commercial handoff", () => {
  it("models the won-deal handoff as governed requests instead of autonomous execution", () => {
    expect(migration).toContain("COMMERCIAL_CONTRACT");
    expect(migration).toContain("SUBSCRIPTION_ACTIVATION");
    expect(migration).toContain("INVOICE_PREPARATION");
    expect(migration).toContain("legal.contract.execute");
    expect(migration).toContain("finance.invoice.create");
    expect(stageMigration).toContain("Contract handoff approval is required first");
    expect(stageMigration).toContain("Subscription handoff approval is required first");
    expect(stageMigration).toContain("Approval does not issue, send or mark an invoice paid");
  });

  it("creates stage requests transactionally through a service-role-only RPC", () => {
    expect(stageMigration).toContain("office_commercial_create_stage_request");
    expect(stageMigration).toContain("office_create_request");
    expect(stageMigration).toContain("revoke all on function public.office_commercial_create_stage_request");
    expect(stageMigration).toContain("grant execute on function public.office_commercial_create_stage_request(uuid,uuid,text) to service_role");
    expect(server).toContain("office_commercial_create_stage_request");
  });

  it("requires same-origin mutations and CRM visibility", () => {
    expect(route).toContain("officeMutationIsSameOrigin");
    expect(server).toContain("getOfficeCrmOverview");
    expect(server).toContain("Visible commercial handoff not found");
  });

  it("surfaces the handoff beside CRM without claiming execution", () => {
    expect(screen).toContain("OfficeCommercialHandoff");
    expect(component).toContain("never signs a contract");
    expect(component).toContain("No downstream business action was executed automatically");
  });
});
