import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { colors } from "../src/theme";

describe("KRAVIA Authenticator Midnight Sapphire theme", () => {
  it("keeps the approved palette as the shared native UI source of truth", () => {
    expect(colors).toMatchObject({
      primary: "#193B5B",
      accent: "#5D809D",
      background: "#EFF3F7",
      surface: "#FFFFFF",
      text: "#172331",
      onPrimary: "#FFFFFF",
    });
  });

  it("keeps UI colors centralized while preserving the artwork-only backdrop", () => {
    const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
    expect(app).toContain('from "./src/theme"');
    expect(app).toContain("colors.primary");
    expect(app).toContain("colors.background");
    expect(app).toContain("colors.artworkBackdrop");
    expect(app).not.toContain('"#123d2e"');
    expect(app).not.toContain('"#087341"');
  });
});
