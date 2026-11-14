import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const clock = readFileSync(new URL("../components/office-ist-clock.tsx",import.meta.url),"utf8");
const shell = readFileSync(new URL("../components/office-workspace-shell.tsx",import.meta.url),"utf8");
const css = readFileSync(new URL("../app/office/office-shell-next.css",import.meta.url),"utf8");
const config = readFileSync(new URL("../next.config.ts",import.meta.url),"utf8");

describe("Office IST clock stays inside the existing compact top bar",()=>{
  it("formats real device time in Asia/Kolkata rather than inventing a timestamp",()=>{
    expect(clock).toContain('timeZone: zone');
    expect(clock).toContain('const zone = "Asia/Kolkata"');
    expect(clock).toContain('new Date()');
    expect(clock).toContain('window.setInterval(tick, 1000)');
    expect(clock).toContain('window.clearInterval(timer)');
    expect(clock).toContain("visibilitychange");
    expect(clock).not.toMatch(/Date\(202[0-9]/);
  });
  it("uses time, date and IST on desktop and mobile without changing toolbar height",()=>{
    expect(shell).toContain("<OfficeIstClock/>");
    expect(shell).toContain('office-topbar office-topbar-compact');
    expect(css).toContain(".office-ist-clock-date-small");
    expect(css).toContain(".office-ist-clock-seconds{display:none}");
    expect(css).toContain("font-variant-numeric:tabular-nums");
    expect(css).not.toContain("office-ist-clock{height:58px");
  });
  it("permits browser location for consented Office sessions but not public pages",()=>{
    expect(config).toContain('geolocation=()');
    expect(config).toContain('geolocation=(self)');
    expect(config).toContain('source: "/office/:path*"');
    expect(config).toContain('source: "/finance/:path*"');
  });
  it("formats the same real instant as an IST date on the end-of-day boundary",()=>{
    const time = new Date("2026-11-14T18:45:00.000Z");
    expect(new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kolkata",day:"2-digit",month:"short",year:"numeric"}).format(time)).toBe("15 Nov 2026");
  });
});
