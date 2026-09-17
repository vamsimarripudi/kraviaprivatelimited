import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { cookies } from "next/headers";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireOfficeAdminEnvironment } from "@/lib/env/office";
import { trackedOfficeSessionId } from "@/lib/office/auth-session-server";

const OFFICE_DEVICE_COOKIE = "kravia_office_device_binding";
const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function serviceClient() {
  const environment = requireOfficeAdminEnvironment();
  return createClient(environment.OFFICE_SUPABASE_URL, environment.OFFICE_SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function requestMetadata(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const candidate = forwarded || realIp || "";
  const ip = isIP(candidate) ? candidate : null;
  const userAgent = (request.headers.get("user-agent") ?? "").trim().slice(0, 512);
  return { ip, userAgentHash: userAgent ? sha256(userAgent) : null };
}

function parseBinding(value: string | undefined) {
  if (!value) return null;
  const separator = value.indexOf(".");
  if (separator <= 0) return null;
  const deviceId = value.slice(0, separator);
  const token = value.slice(separator + 1);
  if (!/^[0-9a-f-]{36}$/i.test(deviceId) || !/^[A-Za-z0-9_-]{32,}$/.test(token)) return null;
  return { deviceId, token };
}

async function setBindingCookie(deviceId: string, token: string) {
  const store = await cookies();
  store.set(OFFICE_DEVICE_COOKIE, `${deviceId}.${token}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: DEVICE_COOKIE_MAX_AGE,
  });
}

export async function clearOfficeDeviceBindingCookie() {
  const store = await cookies();
  store.set(OFFICE_DEVICE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

export async function currentOfficeTrustedDeviceId(admin: SupabaseClient, userId: string) {
  const store = await cookies();
  const parsed = parseBinding(store.get(OFFICE_DEVICE_COOKIE)?.value);
  if (!parsed) return null;
  const { data, error } = await admin.rpc("office_validate_device_binding", {
    p_user: userId,
    p_device: parsed.deviceId,
    p_token_hash: sha256(parsed.token),
  });
  return !error && data === true ? parsed.deviceId : null;
}

export async function bindCurrentOfficeDevice(request: Request, userId: string, deviceId: string, aal: "aal1" | "aal2") {
  if (aal !== "aal2") throw new Error("AAL2 verification is required to bind a device");
  const admin = serviceClient();
  const token = randomBytes(32).toString("base64url");
  const metadata = requestMetadata(request);
  const { data, error } = await admin.rpc("office_bind_trusted_device", {
    p_user: userId,
    p_device: deviceId,
    p_token_hash: sha256(token),
    p_user_agent_hash: metadata.userAgentHash,
  });
  if (error || data !== true) throw new Error(error?.message || "Unable to bind trusted device");

  await setBindingCookie(deviceId, token);
  const sessionId = await trackedOfficeSessionId();
  if (sessionId) {
    await admin.from("office_auth_sessions").update({ device_id: deviceId, updated_at: new Date().toISOString() }).eq("id", sessionId).eq("user_id", userId).eq("status", "ACTIVE");
    await admin.rpc("office_record_auth_session_event", {
      p_session_id: sessionId,
      p_user: userId,
      p_event_type: "DEVICE_LINKED",
      p_aal: aal,
      p_ip: metadata.ip,
      p_user_agent_hash: metadata.userAgentHash,
      p_event_id: randomUUID(),
      p_metadata: { device_id: deviceId },
    });
  }
  return deviceId;
}

export async function unbindCurrentOfficeDevice(userId: string) {
  const admin = serviceClient();
  const store = await cookies();
  const parsed = parseBinding(store.get(OFFICE_DEVICE_COOKIE)?.value);
  if (parsed) {
    await admin.from("office_device_registry")
      .update({ binding_token_hash: null, bound_at: null, bound_user_agent_hash: null, updated_at: new Date().toISOString() })
      .eq("id", parsed.deviceId)
      .eq("user_id", userId);
    const sessionId = await trackedOfficeSessionId();
    if (sessionId) await admin.from("office_auth_sessions").update({ device_id: null, updated_at: new Date().toISOString() }).eq("id", sessionId).eq("user_id", userId);
  }
  await clearOfficeDeviceBindingCookie();
}

export async function getMyOfficeDevices(userId: string) {
  const admin = serviceClient();
  const currentDeviceId = await currentOfficeTrustedDeviceId(admin, userId);
  const { data, error } = await admin.from("office_device_registry")
    .select("id,device_label,device_kind,platform,trust_state,company_managed,approved_at,revoked_at,last_seen_at,bound_at,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Unable to load registered Office devices");
  return (data ?? []).map((device) => ({ ...device, current: device.id === currentDeviceId }));
}
