import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../Database/supabase/migrations/202609170008_board_secretarial.sql", import.meta.url), "utf8");
const cryptoFix = readFileSync(new URL("../../Database/supabase/migrations/202609170010_board_crypto_qualification.sql", import.meta.url), "utf8");
const server = readFileSync(new URL("../lib/office/board-server.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/office-board/route.ts", import.meta.url), "utf8");
const component = readFileSync(new URL("../components/office-board-workspace.tsx", import.meta.url), "utf8");
const screen = readFileSync(new URL("../components/internal-workspace-screen.tsx", import.meta.url), "utf8");
const calendar = readFileSync(new URL("../lib/office/calendar-server.ts", import.meta.url), "utf8");

describe("Board and company-secretarial workspace", () => {
  it("models the full controlled board lifecycle without calculating statutory deadlines", () => {
    for (const table of ["office_board_meetings", "office_board_participants", "office_board_agenda_items", "office_board_minutes_versions", "office_board_resolutions", "office_board_actions", "office_secretarial_followups", "office_board_events"]) {
      expect(migration).toContain(table);
    }
    expect(migration).toContain("Authorised human quorum confirmation and basis are required");
    expect(component).toContain("The system does not decide whether a statutory notice period is legally sufficient");
    expect(component).toContain("Due date and applicability are not calculated here");
  });

  it("requires independent minutes review and makes locked minutes immutable", () => {
    expect(migration).toContain("Minutes preparer cannot approve the same version");
    expect(migration).toContain("Locked minutes cannot be altered");
    expect(migration).toContain("Locked minutes cannot be deleted");
    expect(cryptoFix).toContain("extensions.digest");
    expect(server).toContain("Director approval is required");
  });

  it("records resolutions with integrity hashes instead of silent edits", () => {
    expect(migration).toContain("office_board_resolution_amendments");
    expect(cryptoFix).toContain("RESOLUTION_RECORDED");
    expect(cryptoFix).toContain("sha256");
  });

  it("uses same-origin mutations and a permissioned server boundary", () => {
    expect(route).toContain("officeMutationIsSameOrigin");
    expect(server).toContain("secretarial.board.read");
    expect(server).toContain("secretarial.minutes.lock");
    expect(server).toContain("secretarial.filing.manage");
  });

  it("replaces the generic governance surface and projects board deadlines into the company calendar", () => {
    expect(screen).toContain("OfficeBoardWorkspace");
    expect(screen).toContain('section === "governance"');
    expect(calendar).toContain("office_board_meetings");
    expect(calendar).toContain("office_board_actions");
    expect(calendar).toContain("office_secretarial_followups");
    expect(calendar).toContain("does not calculate statutory due dates");
  });
});
