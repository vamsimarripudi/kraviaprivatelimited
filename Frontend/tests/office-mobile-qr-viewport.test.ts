import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("KRAVIA mobile Office sign-in viewport", () => {
  it("keeps the mobile document fixed while retaining accessible fallback scrolling inside the card", () => {
    const css = read("components/office-auth-layout.module.css");
    expect(css).toContain("Mobile viewport frame:");
    expect(css).toContain("max-height: 100dvh; overflow: hidden;");
    expect(css).toContain("overflow-x: hidden; overflow-y: auto;");
    expect(css).toContain("env(safe-area-inset-bottom)");
  });

  it("overrides Office Experience 4 desktop-density rules on phones", () => {
    const css = read("app/office/office-experience-4.css");
    expect(css).toContain("Phone-sized Office authentication");
    expect(css).toContain("font-size: clamp(1.375rem, 5.8vw, 1.55rem) !important;");
    expect(css).toContain("padding: 10px 12px !important;");
    expect(css).toContain("min-height: 44px !important;");
  });

  it("reduces QR dimensions and offers a larger scannable display", () => {
    const css = read("components/workspace-login-form.module.css");
    const tsx = read("components/workspace-login-form.tsx");
    expect(css).toContain("width: min(188px, 100%)");
    expect(css).toContain("width: min(168px, 100%)");
    expect(css).toContain(".qrDialog .qrImage");
    expect(tsx).toContain("width: 384,");
    expect(tsx).toContain('aria-label="Enlarge sign-in QR code"');
    expect(tsx).toContain("dialog.showModal()");
  });

  it("shows only the current step label with green, orange and error-red dots", () => {
    const tsx = read("components/workspace-login-form.tsx");
    const css = read("components/workspace-login-form.module.css");
    expect(tsx).toContain('["Credentials", "MFA", "Device trust", "Office"]');
    expect(tsx).toContain('aria-current={index === active ? "step" : undefined}');
    expect(tsx).toContain('error={Boolean(status) && statusTone === "error"}');
    expect(tsx).toContain('index === active ? (');
    expect(tsx).toContain('setPhase("verify");');
    expect(css).toContain('.journeyStep[data-state="complete"] .journeyDot');
    expect(css).toContain('.journeyStep[data-state="error"] .journeyDot');
    expect(css).toContain('background:#ee8f17');
    expect(css).not.toContain('.journey>span:not(:last-child)::after');
  });

  it("uses a natural height mobile form card instead of stretching to fill blank space", () => {
    const css = read("components/office-auth-layout.module.css");
    expect(css).toContain("flex: 0 1 auto;");
    expect(css).toContain("overflow-y: auto;");
    expect(css).toContain("max-height: calc(100dvh - 80px");
  });

  it("retains the four-step journey and existing QR approval endpoints", () => {
    const tsx = read("components/workspace-login-form.tsx");
    expect(tsx).toContain('const steps = ["Credentials", "MFA", "Device trust", "Office"]');
    expect(tsx).toContain("/api/office-auth/qr-signin/status");
    expect(tsx).toContain("/api/office-auth/qr-signin/cancel");
    expect(tsx).toContain("Review this browser, then choose Accept or Reject.");
  });
});
