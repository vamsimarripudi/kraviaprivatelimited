import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const migration = read("../Database/supabase/migrations/202611130031_governed_interview_changes.sql");
const route = read("app/api/office-recruitment/route.ts");
const server = read("lib/office/recruitment-server.ts");
const ui = read("components/office-recruitment-workspace.tsx");

describe("Governed recruitment interview changes", () => {
  it("requires active interviews, a genuine future time, and recruiter authority", () => {
    expect(migration).toContain("Only scheduled interviews may be changed");
    expect(migration).toContain("Provide a distinct, future interview time");
    expect(migration).toContain("'hiring.interview.manage'");
    expect(migration).toContain("'INTERVIEW_RESCHEDULED'");
    expect(migration).toContain("'INTERVIEW_CANCELLED'");
    expect(migration).toContain("A substantive audit explanation is required");
  });
  it("exposes protected actions through the existing Office permission boundary", () => {
    expect(route).toContain('action: z.literal("CHANGE_INTERVIEW")');
    expect(route).toContain('decision: z.enum(["RESCHEDULE","CANCEL"])');
    expect(route).toContain("officeMutationIsSameOrigin(request)");
    expect(server).toContain('permission("hiring.interview.manage")');
    expect(server).toContain('rpc("office_interview_change"');
  });
  it("requires a reason in the employee interface and never sends an email implicitly", () => {
    expect(ui).toContain("CHANGE_INTERVIEW");
    expect(ui).toContain('maxLength={1000}');
    expect(ui).toContain("No candidate email will be sent");
    expect(migration).not.toContain("office_lifecycle_mail_enqueue(");
  });
});