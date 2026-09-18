import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const recruitment = readFileSync(new URL("../../Database/supabase/migrations/202609180004_recruitment_onboarding.sql", import.meta.url), "utf8");
const execution = readFileSync(new URL("../../Database/supabase/migrations/202609180005_recruitment_execution.sql", import.meta.url), "utf8");
const integrity = readFileSync(new URL("../../Database/supabase/migrations/202609180006_candidate_document_integrity.sql", import.meta.url), "utf8");
const server = readFileSync(new URL("../lib/office/recruitment-server.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/office-recruitment/route.ts", import.meta.url), "utf8");
const upload = readFileSync(new URL("../app/api/office-recruitment/documents/route.ts", import.meta.url), "utf8");
const component = readFileSync(new URL("../components/office-recruitment-workspace.tsx", import.meta.url), "utf8");
const screen = readFileSync(new URL("../components/internal-workspace-screen.tsx", import.meta.url), "utf8");
const capabilities = readFileSync(new URL("../lib/office/workspace-capabilities.ts", import.meta.url), "utf8");

describe("KRAVIA governed recruitment and pre-onboarding", () => {
  it("separates headcount, candidates, interviews, offers and pre-onboarding", () => {
    for (const table of [
      "office_hiring_requisitions",
      "office_candidates",
      "office_candidate_interviews",
      "office_candidate_interview_feedback",
      "office_offer_proposals",
      "office_candidate_document_requests",
      "office_recruitment_events",
    ]) expect(recruitment).toContain(table);
    expect(recruitment).toContain("HEADCOUNT_APPROVAL");
    expect(recruitment).toContain("EMPLOYMENT_OFFER_APPROVAL");
    expect(recruitment).toContain("PRE_ONBOARDING_ACCESS");
    expect(recruitment).toContain("allow_self_approval,false");
  });

  it("records evidence without silently granting provider access", () => {
    expect(execution).toContain("office-candidate-documents");
    expect(execution).toContain("Finalized candidate document cannot be replaced silently");
    expect(execution).toContain("office_offer_attach_document");
    expect(execution).toContain("office_offer_mark_accepted");
    expect(execution).toContain("PRE_ONBOARDING_ACCESS");
    expect(component).toContain("An accepted offer never creates privileged Office or provider access automatically");
  });

  it("stores candidate uploads privately with content and integrity checks", () => {
    expect(integrity).toContain("sha256");
    expect(integrity).toContain("office_candidate_document_received_v2");
    expect(integrity).toContain("Unsupported candidate document type");
    expect(server).toContain('storage.from("office-candidate-documents").upload');
    expect(server).toContain('createHash("sha256")');
    expect(server).toContain("content does not match an allowed file type");
    expect(upload).toContain("officeMutationIsSameOrigin");
    expect(upload).toContain("26_214_400");
    expect(upload).not.toContain("getPublicUrl");
  });

  it("exposes only capability-gated recruitment actions", () => {
    for (const permission of [
      "hiring.requisition.read",
      "hiring.requisition.manage",
      "hiring.candidate.manage",
      "hiring.interview.manage",
      "hiring.offer.prepare",
      "hiring.offer.review",
      "hiring.onboarding.manage",
    ]) {
      expect(capabilities).toContain(permission);
      expect(server).toContain(permission);
    }
    expect(route).toContain("officeMutationIsSameOrigin");
    expect(route).toContain("CREATE_REQUISITION");
    expect(route).toContain("MARK_OFFER_ACCEPTED");
  });

  it("runs recruitment as a real KRAVIA Office workspace", () => {
    expect(screen).toContain("OfficeRecruitmentWorkspace");
    expect(screen).toContain('section === "recruitment"');
    expect(component).toContain("Headcount to accepted offer, without leaving KRAVIA Office.");
    expect(component).toContain("/api/office-recruitment/documents");
  });
});
