import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const schema = read("../Database/supabase/migrations/202611130103_candidate_event_proofs_and_claims.sql");
const route = read("app/api/office-recruitment/route.ts");
const server = read("lib/office/recruitment-server.ts");
const ui = read("components/office-recruitment-workspace.tsx");

describe("Controlled KRAVIA hiring interview change workflow", () => {
  it("requires recruiter authority and original scheduled state", () => {
    expect(schema).toContain("public.office_interview_reschedule(");
    expect(schema).toContain("public.office_interview_cancel(");
    expect(schema).toContain("v.status<>'SCHEDULED'");
    expect(schema).toContain("'hiring.interview.manage'");
    expect(schema).toContain("INTERVIEW_RESCHEDULED");
    expect(schema).toContain("INTERVIEW_CANCELLED");
    expect(schema).toContain("A different future interview date and reason are required");
  });
  it("requires original Office actor, same-origin mutation and 12-character audit reason", () => {
    expect(route).toContain('action: z.literal("CHANGE_INTERVIEW")');
    expect(route).toContain('decision: z.enum(["RESCHEDULE","CANCEL"])');
    expect(route).toContain("z.string().trim().min(12).max(1000)");
    expect(route).toContain("officeMutationIsSameOrigin");
    expect(server).toContain('permission("hiring.interview.manage")');
    expect(server).toContain('rpc("office_interview_reschedule"');
    expect(server).toContain('rpc("office_interview_cancel"');
  });
  it("exposes functional controls while leaving external candidate emails disabled", () => {
    expect(ui).toContain('kind: "CHANGE_INTERVIEW"');
    expect(ui).toContain('action: "CHANGE_INTERVIEW"');
    expect(ui).toContain("Change / cancel");
    expect(ui).toContain("Candidate emails remain disabled");
    expect(ui).toContain("minLength={12}");
    expect(schema).not.toContain("send_office_candidate_lifecycle_notification(");
  });
});
