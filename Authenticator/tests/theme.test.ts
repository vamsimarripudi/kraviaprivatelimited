import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { colors } from "../src/theme";

describe("KRAVIA Authenticator Harbor Reserve theme", () => {
  it("keeps the premium security palette as the shared native UI source of truth", () => {
    expect(colors).toMatchObject({
      primary: "#102A43",
      accent: "#2F6F9F",
      background: "#F5F7FA",
      surface: "#FFFFFF",
      text: "#16212B",
      onPrimary: "#FFFFFF",
      timerAccent: "#B8893E",
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
