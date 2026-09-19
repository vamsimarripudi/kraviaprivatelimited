import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { requireOfficeAdminEnvironment } from "@/lib/env/office";
import type { OfficeSession, OfficeSessionContext } from "@/lib/office/auth-server";

const OFFICE_TRACKING_SESSION_COOKIE = "kravia_office_session_id";
const TRACKING_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

type AuthEventType = "MFA_VERIFIED" | "SESSION_SEEN" | "LOGOUT" | "SESSION_REVOKED" | "SESSION_EXPIRED" | "DEVICE_LINKED";

function adminClient() {
  const environment = requireOfficeAdminEnvironment();
  return createClient(environment.OFFICE_SUPABASE_URL, environment.OFFICE_SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const payload = token.split(".")[1];
    if (!payload) return {};
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function providerSessionId(session: OfficeSession) {
  const claims = decodeJwtPayload(session.access_token);
  const rawSessionId = typeof claims.sid === "string" ? claims.sid : claims.session_id;
  const sessionId = typeof rawSessionId === "string" ? rawSessionId.trim() : "";
  if (sessionId) return sessionId.slice(0, 160);
  return `token-hash:${createHash("sha256").update(session.access_token).digest("hex")}`;
}

function requestSecurityMetadata(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const candidateIp = forwarded || realIp || "";
  const ip = isIP(candidateIp) ? candidateIp : null;
  const userAgent = (request.headers.get("user-agent") ?? "").trim().slice(0, 512);
  const userAgentHash = userAgent ? createHash("sha256").update(userAgent).digest("hex") : null;
  return { ip, userAgent, userAgentHash };
}

async function writeTrackingCookie(sessionId: string) {
  const store = await cookies();
  store.set(OFFICE_TRACKING_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: TRACKING_COOKIE_MAX_AGE,
  });
}

export async function clearOfficeTrackingSessionCookie() {
  const store = await cookies();
  store.set(OFFICE_TRACKING_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

export async function trackedOfficeSessionId() {
  const store = await cookies();
  const value = store.get(OFFICE_TRACKING_SESSION_COOKIE)?.value;
  return value && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

export async function beginOfficeAuthSession(request: Request, context: OfficeSessionContext) {
  const admin = adminClient();
  const metadata = requestSecurityMetadata(request);
  const requestedId = randomUUID();
  const { data, error } = await admin.rpc("office_open_auth_session", {
    p_session_id: requestedId,
    p_user: context.identity.userId,
    p_provider_session_id: providerSessionId(context.session),
    p_aal: context.identity.aal,
    p_ip: metadata.ip,
    p_user_agent_hash: metadata.userAgentHash,
    p_user_agent_summary: metadata.userAgent || null,
    p_event_id: randomUUID(),
  });
  if (error || typeof data !== "string") throw new Error("OFFICE_SESSION_LEDGER_UNAVAILABLE");
  await writeTrackingCookie(data);
  return data;
}

async function recordAuthSessionEvent(
  request: Request,
  context: OfficeSessionContext,
  eventType: AuthEventType,
  aal: "aal1" | "aal2",
  metadata: Record<string, unknown> = {},
) {
  const sessionId = await trackedOfficeSessionId();
  if (!sessionId) return false;
  const admin = adminClient();
  const requestMetadata = requestSecurityMetadata(request);
  const { data, error } = await admin.rpc("office_record_auth_session_event", {
    p_session_id: sessionId,
    p_user: context.identity.userId,
    p_event_type: eventType,
    p_aal: aal,
    p_ip: requestMetadata.ip,
    p_user_agent_hash: requestMetadata.userAgentHash,
    p_event_id: randomUUID(),
    p_metadata: metadata,
  });
  if (error) return false;
  return data === true;
}

export async function markOfficeMfaVerified(request: Request, context: OfficeSessionContext) {
  return recordAuthSessionEvent(request, context, "MFA_VERIFIED", "aal2", { factor: "TOTP" });
}

export async function touchOfficeAuthSession(request: Request, context: OfficeSessionContext, aal = context.identity.aal) {
  return recordAuthSessionEvent(request, context, "SESSION_SEEN", aal);
}

export async function closeOfficeAuthSession(request: Request, context: OfficeSessionContext | null, reason: "LOGOUT" | "SESSION_REVOKED" | "SESSION_EXPIRED" = "LOGOUT") {
  if (!context) {
    await clearOfficeTrackingSessionCookie();
    return false;
  }
  const closed = await recordAuthSessionEvent(request, context, reason, context.identity.aal);
  await clearOfficeTrackingSessionCookie();
  return closed;
}

export async function getMyOfficeAuthSessions(context: OfficeSessionContext) {
  const admin = adminClient();
  const { data, error } = await admin
    .from("office_auth_sessions")
    .select("id,status,aal,mfa_verified,risk_level,ip_address,user_agent_summary,started_at,last_seen_at,ended_at,end_reason,device_id")
    .eq("user_id", context.identity.userId)
    .order("started_at", { ascending: false })
    .limit(20);
  if (error) throw new Error("Unable to read Office session history");
  const currentId = await trackedOfficeSessionId();
  return (data ?? []).map((row) => ({ ...row, current: row.id === currentId }));
}
