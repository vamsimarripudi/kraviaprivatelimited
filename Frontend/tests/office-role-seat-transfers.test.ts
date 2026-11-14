import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { financeSections, officeSections, roleCanAccessSection } from "../lib/office/workspaces";
import { capabilityCanAccessSection } from "../lib/office/workspace-capabilities";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const sql = read("../Database/supabase/migrations/202611140001_role_seat_transfer_control.sql");
const permission = read("lib/office/permission-engine.ts");
const snapshot = read("lib/office/capability-server.ts");
const server = read("lib/office/role-seat-server.ts");
const api = read("app/api/office-role-seats/route.ts");
const ui = read("components/office-role-portfolio.tsx");

describe("KRAVIA transferable role-seat authority", () => {
  it("keeps personal role portfolios visible without granting operational write privileges", () => {
    expect("my-portfolio" in officeSections).toBe(true);
    expect("my-portfolio" in financeSections).toBe(true);
    expect(roleCanAccessSection(officeSections["my-portfolio"], ["MEMBER"])).toBe(true);
    expect(capabilityCanAccessSection("office", "my-portfolio", ["MEMBER"], [])).toBe(true);
    expect(capabilityCanAccessSection("finance", "my-portfolio", ["FINANCE"], [])).toBe(true);
    expect(capabilityCanAccessSection("finance", "payments", ["FINANCE"], [])).toBe(false);
    expect(capabilityCanAccessSection("office", "engineering", ["MEMBER"], [])).toBe(false);
  });

  it("never silently creates or transfers a real employee from the schema migration", () => {
    expect(sql).toContain("create table if not exists public.office_role_seats");
    expect(sql).toContain("create table if not exists public.office_role_seat_assignments");
    expect(sql).toContain("no_general_founder_seat");
    expect(sql).toContain("position_code <> 'OWNER_FOUNDER'");
    expect(sql).not.toContain("Vamsi Marripudi");
    expect(sql).not.toContain("Manohar");
    expect(sql).not.toContain("Jaya M");
    expect(sql).not.toContain("satish@");
    expect(sql).not.toContain("on conflict (seat_code) do update");
  });

  it("requires recipient acceptance, independent verification and cutover evidence", () => {
    expect(sql).toContain("office_role_seat_propose_transfer");
    expect(sql).toContain("office_role_seat_accept_transfer");
    expect(sql).toContain("office_role_seat_verify_item");
    expect(sql).toContain("office_role_seat_finalize_transfer");
    expect(sql).toContain("office_role_seat_is_independent_reviewer");
    expect(sql).toContain("Required internal, governance or provider handover evidence is incomplete");
    expect(sql).toContain("Formal department ownership handover has not completed");
    expect(sql).toContain("p_actor<>tr.to_user_id");
    expect(sql).toContain("update public.office_role_seat_assignments");
    expect(sql).toContain("status='FORMER'");
    expect(sql).toContain("office_role_seat_former_holders");
  });

  it("blocks former CTO exclusive write privileges before OWNER and legacy role/profile shortcuts", () => {
    const sqlCheck = sql.indexOf("seat_verdict:=public.office_role_seat_permission_verdict(");
    const sqlOwner = sql.indexOf("if pr.owner_bypass is distinct from false");
    expect(sqlCheck).toBeGreaterThan(0);
    expect(sqlOwner).toBeGreaterThan(sqlCheck);
    expect(sql).toContain("office_role_seat_permission_verdict");
    const deny = permission.indexOf('if (seatVerdict === "DENY")');
    const owner = permission.indexOf('if (permissionResult.data.owner_bypass !== false');
    expect(deny).toBeGreaterThan(0);
    expect(owner).toBeGreaterThan(deny);
    expect(permission).toContain('source: "ROLE_SEAT_DENY"');
    expect(snapshot).toContain("office_role_seat_capability_changes");
    expect(snapshot).toContain('source: "ROLE_SEAT"');
    expect(sql).toContain("current_seat.current_holder_user_id=p_actor");
  });

  it("limits high-risk role grants to independent review", () => {
    expect(sql).toContain("case when pr.high_risk then 'PENDING' else 'ACTIVE'");
    expect(sql).toContain("office_role_seat_review_grant");
    expect(sql).toContain("if not public.office_role_seat_is_independent_reviewer");
    expect(sql).toContain("Role-seat audit history is immutable");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("from public,anon,authenticated");
    expect(sql).toContain("to service_role");
    expect(sql).toContain("seat_grant_scope_key");
  });

  it("exposes no unchecked browser mutation path and filters other employees' records", () => {
    expect(api).toContain("officeMutationIsSameOrigin");
    expect(api).toContain("z.discriminatedUnion");
    expect(server).toContain("requireOfficeActor()");
    expect(server).toContain("visibleSeatIds");
    expect(server).toContain("visibleTransferIds");
    expect(server).toContain("isOwner ? (people.data ?? []).map");
    expect(server).toContain('method = "office_role_seat_finalize_transfer"');
    expect(ui).toContain("Independent evidence review");
    expect(ui).toContain("No new CTO, Developer, CFO or CEO seat is inferred");
    expect(ui).toContain("Recipient acceptance");
    expect(read("components/office-workspace-shell.tsx")).toContain('"my-portfolio"');
  });
});
