import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const printService = readFileSync(new URL("../lib/legal/print-service.ts", import.meta.url), "utf8");
const adminClient = readFileSync(new URL("../lib/supabase/admin.ts", import.meta.url), "utf8");

describe("legal print control-plane boundary", () => {
  it("uses only the server-side Office client for durable reservations and events", () => {
    expect(adminClient).toContain("export function createOfficeAdminClient");
    expect(adminClient).toContain("getOfficeAdminEnvironment");
    expect(adminClient).toContain("OFFICE_SUPABASE_SECRET_KEY");
    expect(printService).toContain('import { createOfficeAdminClient } from "@/lib/supabase/admin"');
    expect(printService).toContain("const supabase = createOfficeAdminClient()");
    expect(printService).not.toContain("createAdminClient()");
  });
});
