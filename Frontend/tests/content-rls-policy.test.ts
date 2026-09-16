import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../supabase/migrations/202608140011_content_platform.sql", import.meta.url), "utf8");
describe("content platform RLS migration", () => {
  it("enables RLS and limits anonymous reads to published public records", () => { expect(migration).toContain("alter table public.content_records enable row level security"); expect(migration).toContain("status = 'PUBLISHED' and visibility = 'PUBLIC'"); expect(migration).not.toMatch(/content_records[\s\S]{0,200}using \(true\)/i); });
  it("keeps versions append-only and protects drafts from unauthorised reads", () => { expect(migration).toContain("Content versions are append-only"); expect(migration).toContain("content_can_read_private"); });
});
