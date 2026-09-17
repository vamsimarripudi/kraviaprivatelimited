import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const lifecycleMigration = readFileSync(new URL("../../Database/supabase/migrations/202609170003_workforce_lifecycle.sql", import.meta.url), "utf8");
const executionMigration = readFileSync(new URL("../../Database/supabase/migrations/202609170004_workforce_offboarding_execution.sql", import.meta.url), "utf8");
const server = readFileSync(new URL("../lib/office/workforce-lifecycle-server.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/office-workforce-lifecycle/route.ts", import.meta.url), "utf8");
const component = readFileSync(new URL("../components/office-workforce-lifecycle.tsx", import.meta.url), "utf8");
const screen = readFileSync(new URL("../components/internal-workspace-screen.tsx", import.meta.url), "utf8");

describe("Office workforce lifecycle", () => {
  it("models onboarding and offboarding as approval-led workflows", () => {
    expect(lifecycleMigration).toContain("EMPLOYEE_ONBOARDING");
    expect(lifecycleMigration).toContain("EMPLOYEE_OFFBOARDING");
    expect(lifecycleMigration).toContain("People readiness");
    expect(lifecycleMigration).toContain("Asset return review");
    expect(lifecycleMigration).toContain("Access revocation approval");
    expect(lifecycleMigration).toContain("Provider/account provisioning remains separate");
  });

  it("executes only approved offboarding and revokes Office access atomically", () => {
    expect(executionMigration).toContain("Approved offboarding request is required");
    expect(executionMigration).toContain("office_revoke_workforce_access");
    expect(lifecycleMigration).toContain("status='REVOKED'");
    expect(lifecycleMigration).toContain("WORKFORCE_OFFBOARDING");
    expect(lifecycleMigration).toContain("WORKFORCE_ACCESS_REVOKED");
  });

  it("keeps lifecycle authority scoped and same-origin", () => {
    expect(server).toContain("people.update");
    expect(server).toContain("people.basic.read");
    expect(server).toContain("Self-offboarding is not allowed");
    expect(route).toContain("officeMutationIsSameOrigin");
  });

  it("surfaces the lifecycle in People without pretending to control external providers", () => {
    expect(screen).toContain("OfficeWorkforceLifecycle");
    expect(component).toContain("External provider accounts remain manual controlled follow-up work");
    expect(component).toContain("It does not silently delete external provider accounts");
  });
});
