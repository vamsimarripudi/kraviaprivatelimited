import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { cookies } from "next/headers";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getOfficeRuntimeOrigin, requireOfficeAdminEnvironment } from "@/lib/env/office";
import { getOfficeSessionContext, officeIdentityIsProvisioned } from "@/lib/office/auth-server";

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

async function requireCurrentDeviceActor(userId: string, accessToken: string) {
  const context = await getOfficeSessionContext();
  if (!context || !officeIdentityIsProvisioned(context.identity)) throw new Error("Office sign-in required");
  if (context.identity.userId !== userId) throw new Error("Office device identity does not match the current session");
  if (context.identity.aal !== "aal2") throw new Error("AAL2 verification is required for trusted-device changes");
  if (context.session.access_token !== accessToken) throw new Error("Office device token does not match the current session");
  return context;
}

function requestMetadata(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const candidate = forwarded || realIp || "";
  const ip = isIP(candidate) ? candidate : null;
  const userAgent = (request.headers.get("user-agent") ?? "").trim().slice(0, 512);
  return { ip, userAgent, userAgentHash: userAgent ? sha256(userAgent) : null };
}

async function recordFirstPartyDeviceEvent(
  request: Request,
  accessToken: string,
  deviceId: string,
  action: "LINKED" | "UNLINKED",
) {
  const origin = getOfficeRuntimeOrigin();
  if (!origin) throw new Error("KRAVIA Office identity runtime is not configured");
  const metadata = requestMetadata(request);
  const headers = new Headers({
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "X-Kravia-Gateway": "device-binding-bff",
  });
  if (metadata.userAgent) headers.set("User-Agent", metadata.userAgent);
  if (metadata.ip) headers.set("X-Forwarded-For", metadata.ip);

  const response = await fetch(new URL("/api/v1/auth/device-event", origin), {
    method: "POST",
    headers,
    body: JSON.stringify({ device_id: deviceId, action }),
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status >= 300 && response.status < 400) {
    throw new Error("Unexpected KRAVIA Office identity redirect");
  }
  const payload = await response.json().catch(() => ({})) as { detail?: string };
  if (!response.ok) {
    throw new Error(typeof payload.detail === "string" ? payload.detail : "Unable to record trusted-device event");
  }
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

export async function bindCurrentOfficeDevice(
  request: Request,
  userId: string,
  deviceId: string,
  aal: "aal1" | "aal2",
  accessToken: string,
) {
  if (aal !== "aal2") throw new Error("AAL2 verification is required to bind a device");
  await requireCurrentDeviceActor(userId, accessToken);
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

  try {
    await recordFirstPartyDeviceEvent(request, accessToken, deviceId, "LINKED");
  } catch (error) {
    await admin.from("office_device_registry")
      .update({ binding_token_hash: null, bound_at: null, bound_user_agent_hash: null, updated_at: new Date().toISOString() })
      .eq("id", deviceId)
      .eq("user_id", userId);
    throw error;
  }

  await setBindingCookie(deviceId, token);
  return deviceId;
}

export async function unbindCurrentOfficeDevice(request: Request, userId: string, accessToken: string) {
  await requireCurrentDeviceActor(userId, accessToken);
  const admin = serviceClient();
  const store = await cookies();
  const parsed = parseBinding(store.get(OFFICE_DEVICE_COOKIE)?.value);
  if (!parsed) {
    await clearOfficeDeviceBindingCookie();
    return;
  }

  const metadata = requestMetadata(request);
  const { error } = await admin.from("office_device_registry")
    .update({ binding_token_hash: null, bound_at: null, bound_user_agent_hash: null, updated_at: new Date().toISOString() })
    .eq("id", parsed.deviceId)
    .eq("user_id", userId);
  if (error) throw new Error("Unable to clear trusted-device binding");

  try {
    await recordFirstPartyDeviceEvent(request, accessToken, parsed.deviceId, "UNLINKED");
  } catch (eventError) {
    await admin.rpc("office_bind_trusted_device", {
      p_user: userId,
      p_device: parsed.deviceId,
      p_token_hash: sha256(parsed.token),
      p_user_agent_hash: metadata.userAgentHash,
    });
    throw eventError;
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
