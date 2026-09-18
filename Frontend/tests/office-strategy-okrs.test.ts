import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { officeSections } from "../lib/office/workspaces";
import { requiredCapabilities } from "../lib/office/workspace-capabilities";

const migration=readFileSync(new URL("../../Database/supabase/migrations/202609180030_strategy_okrs.sql",import.meta.url),"utf8");
const server=readFileSync(new URL("../lib/office/strategy-server.ts",import.meta.url),"utf8");
const route=readFileSync(new URL("../app/api/office-strategy/route.ts",import.meta.url),"utf8");
const component=readFileSync(new URL("../components/office-strategy.tsx",import.meta.url),"utf8");
const screen=readFileSync(new URL("../components/internal-workspace-screen.tsx",import.meta.url),"utf8");

describe("KRAVIA Strategy and OKRs",()=>{
  it("is capability-gated and wired into Office",()=>{
    expect(officeSections.strategy.title).toBe("Strategy & OKRs");
    expect(requiredCapabilities("office","strategy")).toContain("strategy.read");
    expect(requiredCapabilities("office","strategy")).toContain("strategy.progress.update");
    expect(screen).toContain("OfficeStrategyWorkspace");
  });

  it("uses independent cycle review and evidence-backed closure",()=>{
    expect(migration).toContain("Strategy owner/creator cannot independently review the same cycle");
    expect(migration).toContain("Strategy closure evidence is required");
    expect(migration).toContain("All objectives must be completed or cancelled before cycle closure");
    expect(component).toContain("Advance / review");
  });

  it("requires objective and key-result evidence before achievement",()=>{
    expect(migration).toContain("All key results must be achieved or cancelled before objective completion");
    expect(migration).toContain("Objective completion evidence is required");
    expect(migration).toContain("Achievement evidence is required");
    expect(component).toContain("Achievement evidence");
  });

  it("records explicit human progress rather than deriving automatic scores",()=>{
    expect(migration).toContain("Progress and health are explicitly reported by accountable humans");
    expect(server).toContain("does not derive OKR or employee-performance scores from commits, login time, attendance, task counts or passive activity");
    expect(component).toContain("human-reported outcomes");
    expect(component).toContain("Human-reported status");
  });

  it("requires context notes for at-risk/off-track key results",()=>{
    expect(migration).toContain("Progress note is required for at-risk/off-track key result");
    expect(component).toContain("AT_RISK");
    expect(component).toContain("OFF_TRACK");
  });

  it("protects browser mutations and keeps strategy authorization on the server",()=>{
    expect(route).toContain("officeMutationIsSameOrigin(request)");
    expect(server).toContain("resolveOfficePermission");
  });
});
