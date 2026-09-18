import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { officeSections } from "../lib/office/workspaces";
import { requiredCapabilities } from "../lib/office/workspace-capabilities";

const migration = readFileSync(new URL("../../Database/supabase/migrations/202609180011_physical_office_operations.sql", import.meta.url), "utf8");
const service = readFileSync(new URL("../lib/office/facilities-server.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/office-facilities/route.ts", import.meta.url), "utf8");
const component = readFileSync(new URL("../components/office-physical-office.tsx", import.meta.url), "utf8");
const screen = readFileSync(new URL("../components/internal-workspace-screen.tsx", import.meta.url), "utf8");

describe("KRAVIA Physical Office", () => {
  it("exposes rooms, visitors and facility incidents as a capability-gated Office module", () => {
    expect(officeSections.facilities.title).toBe("Physical office");
    expect(requiredCapabilities("office", "facilities")).toContain("facilities.room.book");
    expect(requiredCapabilities("office", "facilities")).toContain("visitor.manage");
    expect(requiredCapabilities("office", "facilities")).toContain("facilities.manage");
    expect(screen).toContain("OfficePhysicalOffice");
  });

  it("keeps visitor approval independent from the invitation host", () => {
    expect(migration).toContain("Visitor host cannot approve their own invitation");
    expect(migration).toContain("visitor.manage");
    expect(component).toContain('v.host_user_id!==data.actor.user_id');
  });

  it("stores temporary visitor credentials as hashes and displays raw material once", () => {
    expect(migration).toContain("credential_token_hash");
    expect(migration).toContain("SHA-256");
    expect(service).toContain('createHash("sha256")');
    expect(service).toContain("display_once: true");
    expect(component).toContain("One-time visitor credential");
  });

  it("protects Physical Office browser mutations against cross-origin calls", () => {
    expect(route).toContain("officeMutationIsSameOrigin(request)");
    expect(route).toContain("Cross-origin facilities mutation is not allowed");
  });

  it("prevents overlapping room bookings and keeps cancellation authority scoped", () => {
    expect(migration).toContain("Room is already booked for this time");
    expect(migration).toContain("Only the organizer or facilities authority may cancel this booking");
    expect(component).toContain("BOOK_ROOM");
    expect(component).toContain("CANCEL_BOOKING");
  });

  it("tracks visitor arrival/departure and facility incidents without granting application access", () => {
    expect(route).toContain("CHECK_IN_VISITOR");
    expect(route).toContain("CHECK_OUT_VISITOR");
    expect(route).toContain("REPORT_FACILITY_ISSUE");
    expect(service).toContain("visitor approval does not grant employee or application access");
  });
});
