import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("..", import.meta.url);
const confirmRoute = readFileSync(new URL("app/office/device-approval/confirm/route.ts", root), "utf8");
const actionRoute = readFileSync(new URL("app/api/office-auth/device-approval/action/route.ts", root), "utf8");
const reviewRoute = readFileSync(new URL("app/api/office-auth/device-approval/review/route.ts", root), "utf8");
const form = readFileSync(new URL("components/office-device-approval-form.tsx", root), "utf8");

describe("device approval email review", () => {
  it("stores only an HttpOnly review token until the owner explicitly chooses an action", () => {
    expect(confirmRoute).toContain('"/office/device-approval"');
    expect(confirmRoute).toContain("httpOnly: true");
    expect(confirmRoute).not.toContain("decisionValues");
    expect(actionRoute).toContain('request.json()');
    expect(actionRoute).toContain('decision === "APPROVE"');
    expect(actionRoute).toContain('decision === "DECLINE"');
  });

  it("reviews facts through the same-origin BFF without inventing location", () => {
    expect(reviewRoute).toContain("reviewOfficeDeviceApprovalFromEmail");
    expect(form).toContain("Network address observed by KRAVIA");
    expect(form).toContain("no independently verified location was provided");
    expect(form).toContain("Are you sure you want to trust this device?");
    expect(form).toContain('aria-label="Trust this device"');
    expect(form).toContain('aria-label="Deny this device"');
  });
});
