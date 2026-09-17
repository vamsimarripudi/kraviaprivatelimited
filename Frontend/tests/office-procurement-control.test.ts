import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../Database/supabase/migrations/202609170013_procurement_control.sql", import.meta.url), "utf8");
const server = readFileSync(new URL("../lib/office/procurement-server.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/office-procurement/route.ts", import.meta.url), "utf8");
const component = readFileSync(new URL("../components/office-procurement-control.tsx", import.meta.url), "utf8");
const screen = readFileSync(new URL("../components/internal-workspace-screen.tsx", import.meta.url), "utf8");
const capabilities = readFileSync(new URL("../lib/office/workspace-capabilities.ts", import.meta.url), "utf8");

describe("Office procurement control", () => {
  it("separates sourcing, approval, PO and receipt from payment execution", () => {
    expect(migration).toContain("Approval does not execute payment");
    expect(migration).toContain("Select a quote or approved sourcing basis before submission");
    expect(migration).toContain("Independent purchase approval is not complete");
    expect(migration).toContain("Requester cannot issue the purchase order for their own request");
    expect(migration).toContain("office_procurement_receipts");
    expect(component).toContain("No bank payment was released");
    expect(component).toContain("Finance payment remains a separate workflow");
  });

  it("keeps mutations behind same-origin and service-role controlled RPCs", () => {
    expect(route).toContain("officeMutationIsSameOrigin");
    expect(server).toContain('rpc("office_procurement_create"');
    expect(server).toContain('rpc("office_procurement_issue_po"');
    expect(server).toContain('rpc("office_procurement_record_receipt"');
    expect(migration).toContain("to service_role");
    expect(migration).toContain("from public,anon,authenticated");
  });

  it("tracks renewals as governed records instead of silently renewing services", () => {
    expect(migration).toContain("office_vendor_renewals");
    expect(migration).toContain("RENEWAL_TRACKED");
    expect(server).toContain("createVendorRenewal");
    expect(component).toContain("Renewal execution remains governed and separate from payment");
  });

  it("wires procurement into the vendors workspace with explicit capability gating", () => {
    expect(screen).toContain("OfficeProcurementControl");
    expect(screen).toContain('section === "vendors"');
    expect(capabilities).toContain("operations.procurement.read");
    expect(capabilities).toContain("operations.po.issue");
    expect(capabilities).toContain("operations.receipt.record");
  });
});
