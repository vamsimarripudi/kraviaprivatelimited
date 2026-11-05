import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { heroStatements, TechnologyHero } from "../components/technology-hero";

const heroCss = readFileSync(resolve(process.cwd(), "components/technology-hero.module.css"), "utf8");
const rotatingTextSource = readFileSync(resolve(process.cwd(), "components/rotating-text.tsx"), "utf8");

afterEach(() => { vi.unstubAllGlobals(); });

describe("technology hero server rendering", () => {
  it("renders its content and real destinations without browser APIs or a motion control", () => {
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("document", undefined);

    const html = renderToString(<TechnologyHero />);

    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html).toContain('id="home-title"');
    expect(html).toContain("Technology for");
    expect(html).toContain("what comes next.");
    expect(html).toContain("Built for");
    expect(html).toContain(heroStatements[0]);
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("We are KRAVIA.");
    expect(html).toContain('href="#products"');
    expect(html).toContain('href="/company/about"');
    expect(html).toContain("Explore our products");
    expect(html).toContain("Meet the company");
    expect(html).toContain("<canvas");
    expect(html).toContain('class="grid-scan"');
    expect(html).toContain('class="grid-scan-canvas" aria-hidden="true"');
    expect(html).toContain('data-scroll-velocity="enabled"');
    expect(html).not.toContain("dark-veil-container");
    expect(html).not.toContain("<video");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("Pause background animation");
    expect(html).not.toContain("Resume background animation");
  });

  it("reserves the measured privacy notice height without adding a second bottom spacer", () => {
    expect(heroCss).toContain("min-height: max(0px, calc(100svh - var(--privacy-notice-height, 0px)))");
    expect(heroCss).not.toContain("padding-bottom: var(--privacy-notice-height, 0px)");
  });

  it("keeps the rotating statement centered in a fixed slot with radiant text", () => {
    expect(heroCss).toContain("display: inline-flex;");
    expect(heroCss).toContain("justify-self: center;");
    expect(heroCss).toContain("--rotator-slot: clamp(15ch, 22vw, 19ch);");
    expect(heroCss).toContain("transform: translateX(calc((var(--rotator-slot) + .12em) / 2));");
    expect(heroCss).toContain("text-align: center;");
    expect(heroCss).toContain("background: linear-gradient(105deg");
    expect(heroCss).toContain(".rotator { display: inline-block; width: var(--rotator-slot);");
    expect(heroCss).toContain("text-align: center;");
  });

  it("keeps scroll momentum bounded to the decorative hero field", () => {
    expect(heroCss).toContain(".velocityField { position: absolute; inset: -3% -1.5%;");
    expect(heroCss).toContain("will-change: transform;");
    expect(heroCss).toContain(".velocityField { transform: none; }");
  });

  it("waits for the current rotating word to exit before the next word enters", () => {
    expect(rotatingTextSource).toContain("<AnimatePresence initial={false} mode=\"wait\">");
    expect(rotatingTextSource).toContain("exit={preset.exit}");
  });

  it.each([false, true])("keeps server markup identical when a browser reports reduced motion as %s", (matches) => {
    vi.stubGlobal("window", undefined);
    const serverHtml = renderToString(<TechnologyHero />);
    const matchMedia = vi.fn(() => ({ matches }));
    vi.stubGlobal("window", { matchMedia });

    expect(renderToString(<TechnologyHero />)).toBe(serverHtml);
    expect(matchMedia).not.toHaveBeenCalled();
  });
});

