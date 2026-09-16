import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { officeSections, roleCanAccessSection, roleCanAccessWorkspace } from "../lib/office/workspaces";

const workHub = readFileSync(new URL("../components/office-work-hub.tsx", import.meta.url), "utf8");
const commandCenter = readFileSync(new URL("../components/office-command-center.tsx", import.meta.url), "utf8");
const workflowServer = readFileSync(new URL("../lib/office/workflow-server.ts", import.meta.url), "utf8");
const permissionEngine = readFileSync(new URL("../lib/office/permission-engine.ts", import.meta.url), "utf8");
const secureEmbed = readFileSync(new URL("../components/secure-embed-frame.tsx", import.meta.url), "utf8");

describe("KRAVIA enterprise Office experience", () => {
  it("admits neutral MEMBER users to the Office shell without business-domain privilege", () => {
    expect(roleCanAccessWorkspace("office", ["MEMBER"])).toBe(true);
    expect(roleCanAccessSection(officeSections.requests, ["MEMBER"])).toBe(true);
    expect(roleCanAccessSection(officeSections.people, ["MEMBER"])).toBe(false);
    expect(roleCanAccessSection(officeSections.access, ["MEMBER"])).toBe(false);
  });

  it("uses the real workflow RPC contract for creation and decisions", () => {
    expect(workflowServer).toContain('admin.rpc("office_create_request"');
    expect(workflowServer).toContain('admin.rpc("office_decide_request"');
    expect(workflowServer).toContain("p_requester");
    expect(workflowServer).toContain("p_decision");
  });

  it("supports searchable workflow selection, board/list views and governed status semantics", () => {
    expect(workHub).toContain("RequestTypePicker");
    expect(workHub).toContain('"list" | "board"');
    expect(workHub).toContain('data-status={status}');
    expect(workHub).toContain("PENDING");
    expect(workHub).toContain("IN_REVIEW");
    expect(workHub).toContain("FULFILLED");
  });

  it("provides keyboard command navigation", () => {
    expect(commandCenter).toContain("metaKey");
    expect(commandCenter).toContain("ctrlKey");
    expect(commandCenter).toContain("/office/requests");
    expect(commandCenter).toContain("/office/approvals");
  });

  it("keeps permission scope and device enforcement server-side", () => {
    expect(permissionEngine).toContain("office_user_access_profiles");
    expect(permissionEngine).toContain("office_user_permission_overrides");
    expect(permissionEngine).toContain("office_device_registry");
    expect(permissionEngine).toContain("OVERRIDE_DENY");
  });

  it("allows only explicit HTTPS embed hosts with sandboxing", () => {
    expect(secureEmbed).toContain('url.protocol !== "https:"');
    expect(secureEmbed).toContain("allowedHosts.includes");
    expect(secureEmbed).toContain('sandbox="allow-forms allow-scripts allow-same-origin allow-popups"');
  });
});
