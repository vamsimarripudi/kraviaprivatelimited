import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const careers = read("../components/careers-public.module.css");
const nav = read("../components/site-nav.module.css");
const navComponent = read("../components/site-nav.tsx");

function luminance(hex: string): number {
  const rgb = hex.match(/[0-9a-f]{2}/gi);
  if (!rgb || rgb.length !== 3) throw new Error("Expected RGB color");
  const [r, g, b] = rgb.map(piece => {
    const value = Number.parseInt(piece, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return .2126 * r + .7152 * g + .0722 * b;
}
function contrast(a: string, b: string): number {
  const l1 = luminance(a), l2 = luminance(b);
  return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05);
}

describe("KRAVIA Careers iOS and mobile text visibility", () => {
  it("keeps readable headings, descriptions, form labels and placeholders on light surfaces", () => {
    expect(contrast("#18263f", "#ffffff")).toBeGreaterThanOrEqual(7);
    expect(contrast("#26334e", "#ffffff")).toBeGreaterThanOrEqual(7);
    expect(contrast("#52627b", "#faf9f5")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#63728a", "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(careers).toContain("color-scheme:light");
    expect(careers).toContain("color:#26334e");
    expect(careers).toContain("background:#fff");
    expect(careers).toContain("::placeholder");
  });

  it("does not mix system-Dark-Mode near-white copy with the public site's light canvas", () => {
    expect(careers).not.toMatch(/@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)/i);
    expect(careers).not.toContain("--ink:#e8eeff");
  });

  it("shields Careers hero text from the translucent sticky header while scrolling", () => {
    expect(navComponent).toContain('pathname === "/careers"');
    expect(navComponent).toContain('pathname.startsWith("/careers/")');
    expect(navComponent).toContain("isCareers ? styles.careers");
    expect(nav).toContain(".root.careers");
    expect(nav).toContain("background: rgba(248, 250, 255, .97)");
    expect(nav).toContain("border-bottom: 1px solid");
  });

  it("keeps the header and logo dark on the light Careers surface even after a scroll transition", () => {
    expect(nav).toContain("--nav-foreground: #071e45;");
    expect(nav).toContain(".careers.onDark .logo { filter: none; }");
    expect(navComponent).toContain('overDarkSurface && !isCareers ? styles.onDark : ""');
  });
});
