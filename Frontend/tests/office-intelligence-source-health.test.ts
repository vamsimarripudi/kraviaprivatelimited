import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const server = readFileSync(new URL("../lib/office/intelligence-server.ts", import.meta.url), "utf8");
const peek = readFileSync(new URL("../components/office-intelligence-peek.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../components/office-intelligence-peek.module.css", import.meta.url), "utf8");

describe("KRAVIA executive intelligence source health", () => {
  it("derives availability from real source query errors without treating failures as zero", () => {
    expect(server).toContain("source_health: sources.map");
    expect(server).toContain('status: result.error ? "UNAVAILABLE" : "AVAILABLE"');
    expect(server).toContain("unavailable_metrics:");
    expect(server).not.toContain("last_record_at:");
  });
  it("never invents record freshness from request time when timestamps are missing", () => {
    expect(server).toContain("function newestRecordTimestamp(data: unknown): string | null");
    expect(server).toContain("return Number.isFinite(newest) ? new Date(newest).toISOString() : null;");
    expect(server).toContain("checked_at: checkedAt");
    expect(server).toContain("latest_record_at: result.error ? null : newestRecordTimestamp(result.data)");
  });
  it("keeps source health a collapsed, keyboard-accessible executive disclosure", () => {
    expect(peek).toContain("<details className={styles.sources}>");
    expect(peek).toContain("Source status");
    expect(peek).toContain("Record freshness unknown");
    expect(peek).toContain("Latest observed record");
    expect(styles).toContain(".sources summary:focus-visible");
    expect(server).toContain('role === "OWNER" || role === "DIRECTOR"');
  });
});
