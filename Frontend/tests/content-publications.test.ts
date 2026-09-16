import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../supabase/migrations/202608210003_governed_publication_snapshots.sql", import.meta.url), "utf8");

describe("governed public publication snapshots", () => {
  it("keeps a public snapshot separate from a private next revision", () => {
    expect(migration).toContain("create table public.content_publications");
    expect(migration).toContain("snapshot jsonb not null");
    expect(migration).toContain("content editor begins governed revision");
    expect(migration).toContain("create or replace function public.revise_content_record");
    expect(migration).toContain("create or replace function public.publish_content_snapshot");
    expect(migration).toContain("create or replace function public.archive_content_snapshot");
  });

  it("permits anonymous reads only for active approved snapshots", () => {
    expect(migration).toContain('for select using (state = \'PUBLISHED\')');
    expect(migration).not.toMatch(/content_publications[\s\S]{0,240}using \(true\)/i);
  });

  it("backfills existing published records without seeding fabricated company data", () => {
    expect(migration).toContain("from public.content_records");
    expect(migration).toContain("where status = 'PUBLISHED' and visibility = 'PUBLIC'");
    expect(migration).not.toContain("insert into public.content_records");
  });
});