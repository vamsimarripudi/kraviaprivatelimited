import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ledgerSql = readFileSync(new URL("../../Backend/spec/identity/SUPABASE_SESSION_LEDGER.sql", import.meta.url), "utf8");
const ledgerServer = readFileSync(new URL("../lib/office/auth-session-server.ts", import.meta.url), "utf8");
const signInRoute = readFileSync(new URL("../app/api/office-auth/sign-in/route.ts", import.meta.url), "utf8");
const mfaRoute = readFileSync(new URL("../app/api/office-auth/mfa/route.ts", import.meta.url), "utf8");
const signOutRoute = readFileSync(new URL("../app/api/office-auth/sign-out/route.ts", import.meta.url), "utf8");
const heartbeatRoute = readFileSync(new URL("../app/api/office-auth/heartbeat/route.ts", import.meta.url), "utf8");
const sessionsRoute = readFileSync(new URL("../app/api/office-auth/sessions/route.ts", import.meta.url), "utf8");

describe("KRAVIA Office authentication session ledger", () => {
  it("stores security session metadata without storing authentication tokens", () => {
    expect(ledgerSql).toContain("office_auth_sessions");
    expect(ledgerSql).toContain("provider_session_id");
    expect(ledgerSql).toContain("user_agent_hash");
    expect(ledgerSql).not.toContain("access_token");
    expect(ledgerSql).not.toContain("refresh_token");
    expect(ledgerServer).toContain("token-hash:");
  });

  it("keeps authentication events immutable and hidden from browser database roles", () => {
    expect(ledgerSql).toContain("office_auth_event_immutable_guard");
    expect(ledgerSql).toContain("enable row level security");
    expect(ledgerSql).toContain("revoke all on public.office_auth_sessions, public.office_auth_events");
    expect(ledgerSql).toContain("grant execute on function public.office_open_auth_session");
    expect(ledgerSql).toContain("grant execute on function public.office_record_auth_session_event");
  });

  it("opens the ledger only after a provisioned sign-in and fails closed when audit tracking is unavailable", () => {
    expect(signInRoute).toContain("beginOfficeAuthSession");
    expect(signInRoute).toContain("await signOutOffice(context)");
    expect(signInRoute).toContain("KRAVIA Office sign-in is temporarily unavailable");
  });

  it("records MFA, heartbeat and logout as security-session events", () => {
    expect(mfaRoute).toContain("markOfficeMfaVerified");
    expect(heartbeatRoute).toContain("touchOfficeAuthSession");
    expect(heartbeatRoute).toContain("officeMutationIsSameOrigin");
    expect(signOutRoute).toContain("closeOfficeAuthSession");
    expect(ledgerSql).toContain("'MFA_VERIFIED','SESSION_SEEN','LOGOUT'");
  });

  it("exposes only the current user's recent session history behind AAL2", () => {
    expect(sessionsRoute).toContain("context.identity.aal !== \"aal2\"");
    expect(sessionsRoute).toContain("getMyOfficeAuthSessions");
    expect(ledgerServer).toContain('.eq("user_id", context.identity.userId)');
  });
});
