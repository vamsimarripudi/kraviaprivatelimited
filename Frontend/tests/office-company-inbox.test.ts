import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("../../Backend/spec/identity/SUPABASE_TASK_ENGINE.sql", import.meta.url), "utf8");
const server = readFileSync(new URL("../lib/office/task-server.ts", import.meta.url), "utf8");
const api = readFileSync(new URL("../app/api/office-tasks/route.ts", import.meta.url), "utf8");
const transition = readFileSync(new URL("../app/api/office-tasks/[id]/transition/route.ts", import.meta.url), "utf8");
const inbox = readFileSync(new URL("../components/office-company-inbox.tsx", import.meta.url), "utf8");
const workspaces = readFileSync(new URL("../lib/office/workspaces.ts", import.meta.url), "utf8");
const screen = readFileSync(new URL("../components/internal-workspace-screen.tsx", import.meta.url), "utf8");

describe("KRAVIA Office Company Inbox", () => {
  it("uses a canonical task ledger with immutable events and deny-by-default browser access", () => {
    expect(sql).toContain("create table if not exists public.office_tasks");
    expect(sql).toContain("create table if not exists public.office_task_events");
    expect(sql).toContain("office_task_events_immutable");
    expect(sql).toContain("office_tasks_deny_client_access");
    expect(sql).toContain("office_task_events_deny_client_access");
  });

  it("allows self, direct-manager or privileged assignment instead of arbitrary cross-team assignment", () => {
    expect(sql).toContain("p_actor=p_assignee");
    expect(sql).toContain("j.reports_to_user_id=p_actor");
    expect(sql).toContain("r.role in ('OWNER','DIRECTOR','ADMIN')");
    expect(sql).toContain("if not v_can_assign then raise exception 'Actor cannot assign work to this user'");
  });

  it("routes all task writes through same-origin server APIs and service-role RPCs", () => {
    expect(api).toContain("officeMutationIsSameOrigin");
    expect(transition).toContain("officeMutationIsSameOrigin");
    expect(server).toContain('.rpc("office_create_task"');
    expect(server).toContain('.rpc("office_transition_task"');
  });

  it("separates actionable tasks from approvals while surfacing both in My Work", () => {
    expect(workspaces).toContain('title: "Company inbox"');
    expect(screen).toContain("OfficeCompanyInbox compact");
    expect(screen).toContain('section === "tasks"');
    expect(inbox).toContain("Tasks are separate from approvals");
    expect(inbox).toContain("Creating a task does not grant permission or approve a regulated action");
  });
});
