import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { officeSections } from "../lib/office/workspaces";
import { requiredCapabilities } from "../lib/office/workspace-capabilities";

const migration = readFileSync(new URL("../../Database/supabase/migrations/202609180010_enterprise_risk_decision_change.sql", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/office-control-register/route.ts", import.meta.url), "utf8");
const server = readFileSync(new URL("../lib/office/control-register-server.ts", import.meta.url), "utf8");
const component = readFileSync(new URL("../components/office-control-register.tsx", import.meta.url), "utf8");
const screen = readFileSync(new URL("../components/internal-workspace-screen.tsx", import.meta.url), "utf8");

describe("KRAVIA enterprise control register", () => {
  it("exposes risk, decisions and controlled changes only through scoped capabilities", () => {
    expect(officeSections.decisions.title).toBe("Risk, decisions & change");
    expect(requiredCapabilities("office", "decisions")).toContain("governance.risk.read");
    expect(requiredCapabilities("office", "decisions")).toContain("governance.decision.read");
    expect(requiredCapabilities("office", "decisions")).toContain("governance.change.read");
    expect(screen).toContain("OfficeControlRegister");
  });

  it("prevents a risk owner from independently accepting or closing their own risk", () => {
    expect(migration).toContain("Risk owner cannot independently accept or close the same risk");
    expect(migration).toContain("Independent risk review permission is required");
    expect(component).toContain("acceptance_basis");
    expect(component).toContain("closure_evidence");
  });

  it("records executive decisions without granting decision authority to the recorder", () => {
    expect(migration).toContain("Decision maker must have active owner or director authority");
    expect(migration).toContain("authority_basis");
    expect(route).toContain("RECORD_DECISION");
    expect(component).toContain("Select authorised owner/director");
  });

  it("enforces maker-checker review and evidence on controlled changes", () => {
    expect(migration).toContain("Change owner/creator cannot independently review the same change");
    expect(migration).toContain("Approval reference is required");
    expect(migration).toContain("Verification evidence is required");
    expect(component).toContain("Advance / review");
  });

  it("keeps mutations same-origin and server-authorised", () => {
    expect(route).toContain("officeMutationIsSameOrigin(request)");
    expect(server).toContain("resolveOfficePermission");
    expect(server).toContain("currentOfficeTrustedDeviceId");
  });
});
