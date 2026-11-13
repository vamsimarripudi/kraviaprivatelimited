import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration=readFileSync(
  new URL("../../Database/supabase/migrations/202611130022_office_lifecycle_mail_router.sql",import.meta.url),"utf8",
);
const manifest=JSON.parse(readFileSync(
  new URL("../../Backend/backend/generated_office_lifecycle_templates.json",import.meta.url),"utf8",
));
const vercel=JSON.parse(readFileSync(new URL("../vercel.json",import.meta.url),"utf8"));
const worker=readFileSync(
  new URL("../../Backend/backend/office_lifecycle_mail_worker.py",import.meta.url),"utf8",
);

describe("KRAVIA Office lifecycle and single-release invariants",()=>{
  it("retains all 81 distinct templates without activating provider delivery",()=>{
    const codes=Object.keys(manifest.templates);
    expect(codes).toHaveLength(81);
    expect(new Set(codes).size).toBe(81);
    expect(manifest.dispatchEnabled).toBe(false);
    expect(migration).toContain("enabled boolean NOT NULL DEFAULT false");
    expect(migration).toContain("source_ready boolean NOT NULL DEFAULT false");
    expect(worker).toContain('KRAVIA_LIFECYCLE_MAIL_DISPATCH_ENABLED');
    expect(worker).toContain('PROVIDER_NOT_CONFIGURED');
  });
  it("never represents unmapped notifications as working event sources",()=>{
    const mapped=[...migration.matchAll(/\('([A-Z]+-\d{2})','P[0-2]',true,/g)].map(match=>match[1]);
    expect(mapped.length).toBeGreaterThanOrEqual(27);
    expect(mapped.length).toBeLessThanOrEqual(81);
    expect(new Set(mapped).size).toBe(mapped.length);
    for(const eventCode of mapped)expect(manifest.templates[eventCode]).toBeDefined();
    expect(migration).toContain("IF p_enabled AND NOT v_ready THEN");
    expect(migration).toContain("FOR UPDATE OF o SKIP LOCKED");
    expect(migration).toContain("STALE_UNKNOWN");
    expect(migration).toContain("FROM PUBLIC,anon,authenticated,service_role");
  });
  it("keeps the main-branch Vercel build behind exactly one explicit release marker",()=>{
    expect(vercel.git.deploymentEnabled.main).toBe(true);
    expect(vercel.git.deploymentEnabled["*"]).toBe(false);
    expect(vercel.ignoreCommand).toContain("feat(Office): complete KRAVIA Office release");
    expect(vercel.ignoreCommand).toContain("^deploy(frontend):");
    expect(vercel.ignoreCommand).toContain("then exit 0;");
    expect(vercel.ignoreCommand).toContain("then exit 1;");
  });
});
