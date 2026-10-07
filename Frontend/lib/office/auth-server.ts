import "server-only";

import { cookies } from "next/headers";
import { getOfficeRuntimeOrigin } from "@/lib/env/office";
import { isOfficeDepartment, type OfficeDepartment } from "@/lib/office/access-policy";
import { isOfficeRole, type OfficeRole } from "@/lib/office/workspaces";

export const OFFICE_ACCESS_COOKIE = "kravia_office_access";
export const OFFICE_REFRESH_COOKIE = "kravia_office_refresh";
export const OFFICE_LOGIN_DEVICE_COOKIE = "kravia_office_login_device";
export const OFFICE_DEVICE_ACTION_COOKIE = "kravia_office_device_action";

const ACCESS_COOKIE_MAX_AGE_SECONDS = 60 * 60;
const REFRESH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const DEVICE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const PENDING_DEVICE_COOKIE_MAX_AGE_SECONDS = 60 * 60;

export type OfficeIdentity = {
  userId: string;
  email?: string;
  displayName?: string;
  roles: OfficeRole[];
  accessStatus: string;
  department?: OfficeDepartment;
  authzVersion: number;
  aal: "aal1" | "aal2";
  founder?: boolean;
  displayRole?: string;
};

export type OfficeSession = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
};

export type OfficeSessionContext = {
  session: OfficeSession;
  identity: OfficeIdentity;
  mfa: { enrolled: boolean };
};

export type OfficeAuthSessionRecord = {
  id: string;
  status: string;
  aal: "aal1" | "aal2";
  mfa_verified: boolean;
  ip_address?: string | null;
  user_agent_hash?: string | null;
  started_at?: string | null;
  last_seen_at?: string | null;
  expires_at?: string | null;
  revoked_at?: string | null;
  current: boolean;
  provider: "KRAVIA_FIRST_PARTY";
};

export type AuthenticatorActivationRequest = {
  id: string;
  email: string;
  created_at?: string | null;
  expires_at: string;
};

export type PendingOfficeDeviceApproval = {
  approvalId: string;
  status: "PENDING" | "APPROVED" | "DECLINED" | "EXPIRED" | "DELIVERY_FAILED" | "DELIVERY_UNKNOWN" | "TRUSTED";
  expiresAt: string;
  deviceLabel: string;
};

type OfficeLoginDeviceProof = { approvalId: string; proof: string };

type FirstPartyAuthResponse = {
  authenticated: boolean;
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  user_id: string;
  email?: string;
  display_name?: string;
  roles: string[];
  access_status: string;
  department?: string | null;
  authorization_version?: number;
  aal: "aal1" | "aal2";
  founder?: boolean;
  display_role?: string;
  mfa?: { enrolled?: boolean };
  device_approval_pending?: boolean;
  device_approval_id?: string;
  device_proof?: string;
  expires_at?: string;
  device_label?: string;
};

type FastApiValidationItem = { msg?: unknown; loc?: unknown[] };
type ApiErrorBody = { detail?: string | FastApiValidationItem[] };

export class OfficeApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "OfficeApiError";
    this.status = status;
  }
}

function apiErrorMessage(body: ApiErrorBody) {
  if (typeof body.detail === "string" && body.detail.trim()) return body.detail;
  if (Array.isArray(body.detail)) {
    const messages = body.detail
      .map((item) => (typeof item?.msg === "string" ? item.msg.trim() : ""))
      .filter(Boolean);
    if (messages.length > 0) return messages.join("; ");
  }
  return "KRAVIA Office identity request failed";
}

function origin() {
  const value = getOfficeRuntimeOrigin();
  if (!value) throw new Error("KRAVIA Office runtime is not configured");
  return value;
}

async function rawApi(path: string, init: RequestInit = {}) {
  const response = await fetch(new URL(path, origin()), {
    ...init,
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(25_000),
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (response.status >= 300 && response.status < 400) {
    throw new Error("KRAVIA Office runtime returned an unexpected redirect");
  }
  return response;
}

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as ApiErrorBody;
  if (!response.ok) {
    throw new OfficeApiError(response.status, apiErrorMessage(body));
  }
  return body as T;
}

function toIdentity(payload: FirstPartyAuthResponse): OfficeIdentity {
  const roles = (payload.roles ?? []).filter(isOfficeRole);
  const departmentCandidate = payload.department;
  return {
    userId: payload.user_id,
    email: payload.email,
    displayName: payload.display_name,
    roles,
    accessStatus: payload.access_status,
    department: isOfficeDepartment(departmentCandidate) ? departmentCandidate : undefined,
    authzVersion: typeof payload.authorization_version === "number" ? payload.authorization_version : 1,
    aal: payload.aal === "aal2" ? "aal2" : "aal1",
    founder: payload.founder === true,
    displayRole: payload.display_role,
  };
}

export function officeIdentityIsProvisioned(identity: OfficeIdentity) {
  return identity.accessStatus === "ACTIVE" && identity.roles.length > 0;
}

export async function writeOfficeSessionCookies(session: OfficeSession) {
  const store = await cookies();
  const secure = process.env.NODE_ENV === "production";
  const common = {
    httpOnly: true,
    secure,
    sameSite: "strict" as const,
    path: "/",
  };
  store.set(OFFICE_ACCESS_COOKIE, session.access_token, {
    ...common,
    maxAge: Math.max(60, session.expires_in ?? ACCESS_COOKIE_MAX_AGE_SECONDS),
  });
  if (session.refresh_token) {
    store.set(OFFICE_REFRESH_COOKIE, session.refresh_token, {
      ...common,
      maxAge: REFRESH_COOKIE_MAX_AGE_SECONDS,
    });
  }
}

export async function clearOfficeSessionCookies() {
  const store = await cookies();
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: 0,
  };
  store.set(OFFICE_ACCESS_COOKIE, "", options);
  store.set(OFFICE_REFRESH_COOKIE, "", options);
}

function parseLoginDeviceCookie(value: string | undefined): OfficeLoginDeviceProof | null {
  if (!value) return null;
  const separator = value.indexOf(".");
  if (separator <= 0) return null;
  const approvalId = value.slice(0, separator);
  const proof = value.slice(separator + 1);
  if (!/^[0-9a-f-]{36}$/i.test(approvalId) || !/^[A-Za-z0-9_-]{32,}$/.test(proof)) return null;
  return { approvalId, proof };
}

async function writeOfficeLoginDeviceCookie(device: OfficeLoginDeviceProof, pending: boolean) {
  const store = await cookies();
  store.set(OFFICE_LOGIN_DEVICE_COOKIE, `${device.approvalId}.${device.proof}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: pending ? PENDING_DEVICE_COOKIE_MAX_AGE_SECONDS : DEVICE_COOKIE_MAX_AGE_SECONDS,
  });
}

export async function clearOfficeLoginDeviceCookie() {
  const store = await cookies();
  store.set(OFFICE_LOGIN_DEVICE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

async function currentOfficeLoginDeviceProof() {
  const store = await cookies();
  return parseLoginDeviceCookie(store.get(OFFICE_LOGIN_DEVICE_COOKIE)?.value);
}

async function contextFromPayload(payload: FirstPartyAuthResponse): Promise<OfficeSessionContext> {
  const session = {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expires_in: payload.expires_in,
  };
  return {
    session,
    identity: toIdentity(payload),
    mfa: { enrolled: payload.mfa?.enrolled === true },
  };
}

async function refreshWithToken(refreshToken: string): Promise<OfficeSessionContext | null> {
  try {
    const response = await rawApi("/api/v1/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const payload = await parseOrThrow<FirstPartyAuthResponse>(response);
    const context = await contextFromPayload(payload);
    try { await writeOfficeSessionCookies(context.session); } catch { /* Server Component cookie writes wait for a route handler. */ }
    return context;
  } catch {
    return null;
  }
}

export async function getOfficeSessionContext(): Promise<OfficeSessionContext | null> {
  const store = await cookies();
  const accessToken = store.get(OFFICE_ACCESS_COOKIE)?.value;
  const refreshToken = store.get(OFFICE_REFRESH_COOKIE)?.value;
  if (!accessToken) {
    return refreshToken ? refreshWithToken(refreshToken) : null;
  }

  try {
    const response = await rawApi("/api/v1/auth/session", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (response.status === 401 && refreshToken) return refreshWithToken(refreshToken);
    const payload = await parseOrThrow<FirstPartyAuthResponse>(response);
    const context = await contextFromPayload(payload);
    context.session.access_token = payload.access_token || accessToken;
    try { await writeOfficeSessionCookies(context.session); } catch { /* no-op in Server Components */ }
    return context;
  } catch {
    return refreshToken ? refreshWithToken(refreshToken) : null;
  }
}

export async function signInOffice(email: string, password: string): Promise<OfficeSessionContext> {
  const response = await rawApi("/api/v1/auth/sign-in", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const payload = await parseOrThrow<FirstPartyAuthResponse>(response);
  const context = await contextFromPayload(payload);
  await writeOfficeSessionCookies(context.session);
  return context;
}

export async function founderBootstrapStatus() {
  const response = await rawApi("/api/v1/auth/bootstrap-status");
  return parseOrThrow<{
    registration_open: boolean;
    role: "FOUNDER";
    role_locked: true;
    public_registration_closes_after_success: true;
  }>(response);
}

export async function registerFounder(input: { email: string; display_name: string; password: string }) {
  const bootstrapKey = process.env.OFFICE_AUTH_BOOTSTRAP_SECRET?.trim();
  if (!bootstrapKey) throw new Error("Founder registration is not configured on this deployment");
  const response = await rawApi("/api/v1/auth/register-founder", {
    method: "POST",
    headers: { "X-Kravia-Bootstrap-Key": bootstrapKey },
    body: JSON.stringify(input),
  });
  const payload = await parseOrThrow<FirstPartyAuthResponse>(response);
  const context = await contextFromPayload(payload);
  await writeOfficeSessionCookies(context.session);
  return context;
}

export async function invitationStatus(token: string) {
  const target = new URL("/api/v1/auth/invitation", origin());
  target.searchParams.set("token", token);
  const response = await fetch(target, {
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(25_000),
    headers: { Accept: "application/json" },
  });
  return parseOrThrow<{
    valid: true;
    email: string;
    display_name?: string | null;
    job_title?: string | null;
    department?: string | null;
    roles: OfficeRole[];
    expires_at: string;
  }>(response);
}

export async function registerInvitedOfficeUser(input: { token: string; display_name: string; password: string }) {
  const response = await rawApi("/api/v1/auth/invitation/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const payload = await parseOrThrow<FirstPartyAuthResponse>(response);
  const context = await contextFromPayload(payload);
  await writeOfficeSessionCookies(context.session);
  return context;
}

export async function verifyOfficeMfa(context: OfficeSessionContext, code: string) {
  const device = await currentOfficeLoginDeviceProof();
  const response = await rawApi("/api/v1/auth/mfa/verify", {
    method: "POST",
    headers: { Authorization: `Bearer ${context.session.access_token}` },
    body: JSON.stringify({
      code,
      ...(device ? { device_approval_id: device.approvalId, device_proof: device.proof } : {}),
    }),
  });
  const payload = await parseOrThrow<FirstPartyAuthResponse & { verified: boolean }>(response);
  if (payload.device_approval_pending === true) {
    if (!payload.device_approval_id || !payload.device_proof || !payload.expires_at || !payload.device_label) {
      throw new Error("KRAVIA Office returned an incomplete device approval request");
    }
    await clearOfficeSessionCookies();
    await writeOfficeLoginDeviceCookie({ approvalId: payload.device_approval_id, proof: payload.device_proof }, true);
    return {
      kind: "pending" as const,
      approval: {
        approvalId: payload.device_approval_id,
        status: "PENDING" as const,
        expiresAt: payload.expires_at,
        deviceLabel: payload.device_label,
      },
    };
  }
  if (payload.verified !== true || !payload.access_token) throw new Error("KRAVIA Office did not complete MFA");
  const next: OfficeSessionContext = {
    session: {
      access_token: payload.access_token,
      refresh_token: context.session.refresh_token,
      expires_in: payload.expires_in,
    },
    identity: toIdentity(payload),
    mfa: { enrolled: true },
  };
  await writeOfficeSessionCookies(next.session);
  return { kind: "active" as const, context: next };
}

function toPendingApproval(payload: { approval_id?: unknown; status?: unknown; expires_at?: unknown; device_label?: unknown }): PendingOfficeDeviceApproval {
  const status = typeof payload.status === "string" ? payload.status : "";
  const accepted = new Set(["PENDING", "APPROVED", "DECLINED", "EXPIRED", "DELIVERY_FAILED", "DELIVERY_UNKNOWN", "TRUSTED"]);
  if (
    typeof payload.approval_id !== "string" || !/^[0-9a-f-]{36}$/i.test(payload.approval_id) ||
    !accepted.has(status) || typeof payload.expires_at !== "string" || typeof payload.device_label !== "string"
  ) throw new Error("KRAVIA Office returned an invalid device approval request");
  return {
    approvalId: payload.approval_id,
    status: status as PendingOfficeDeviceApproval["status"],
    expiresAt: payload.expires_at,
    deviceLabel: payload.device_label,
  };
}

export async function getPendingOfficeDeviceApproval() {
  const device = await currentOfficeLoginDeviceProof();
  if (!device) throw new OfficeApiError(401, "Device approval request is not available in this browser");
  const response = await rawApi("/api/v1/auth/device-approvals/status", {
    method: "POST",
    body: JSON.stringify({ device_id: device.approvalId, device_proof: device.proof }),
  });
  return toPendingApproval(await parseOrThrow<{ approval_id?: unknown; status?: unknown; expires_at?: unknown; device_label?: unknown }>(response));
}

export async function completePendingOfficeDeviceApproval() {
  const device = await currentOfficeLoginDeviceProof();
  if (!device) throw new OfficeApiError(401, "Device approval request is not available in this browser");
  const response = await rawApi("/api/v1/auth/device-approvals/complete", {
    method: "POST",
    body: JSON.stringify({ device_id: device.approvalId, device_proof: device.proof }),
  });
  const payload = await parseOrThrow<FirstPartyAuthResponse>(response);
  if (!payload.access_token || !payload.refresh_token) throw new Error("KRAVIA Office did not activate this approved device");
  const context = await contextFromPayload(payload);
  await writeOfficeSessionCookies(context.session);
  await writeOfficeLoginDeviceCookie(device, false);
  return context;
}

export async function decideOfficeDeviceApprovalFromEmail(action: { approvalId: string; actionToken: string; decision: "APPROVE" | "DECLINE" }) {
  const response = await rawApi(`/api/v1/auth/device-approvals/${encodeURIComponent(action.approvalId)}/action`, {
    method: "POST",
    body: JSON.stringify({ action_token: action.actionToken, decision: action.decision }),
  });
  return parseOrThrow<{ decided: true; status: "APPROVED" | "DECLINED" }>(response);
}

export type OfficeDeviceApprovalReview = {
  approvalId: string;
  status: "PENDING" | "APPROVED" | "DECLINED" | "EXPIRED";
  deviceLabel: string;
  sourceAddress: string;
  requestedAt: string;
  expiresAt: string;
  location: null;
};

export async function reviewOfficeDeviceApprovalFromEmail(action: { approvalId: string; actionToken: string }) {
  const response = await rawApi(`/api/v1/auth/device-approvals/${encodeURIComponent(action.approvalId)}/review`, {
    method: "POST",
    body: JSON.stringify({ action_token: action.actionToken }),
  });
  const payload = await parseOrThrow<{
    approval_id?: unknown;
    status?: unknown;
    device_label?: unknown;
    source_address?: unknown;
    requested_at?: unknown;
    expires_at?: unknown;
    location?: unknown;
  }>(response);
  const accepted = new Set(["PENDING", "APPROVED", "DECLINED", "EXPIRED"]);
  if (
    typeof payload.approval_id !== "string" || !/^[0-9a-f-]{36}$/i.test(payload.approval_id) ||
    typeof payload.status !== "string" || !accepted.has(payload.status) ||
    typeof payload.device_label !== "string" || typeof payload.source_address !== "string" ||
    typeof payload.requested_at !== "string" || typeof payload.expires_at !== "string" ||
    payload.location !== null
  ) throw new Error("KRAVIA Office returned an invalid device review request");
  return {
    approvalId: payload.approval_id,
    status: payload.status as OfficeDeviceApprovalReview["status"],
    deviceLabel: payload.device_label,
    sourceAddress: payload.source_address,
    requestedAt: payload.requested_at,
    expiresAt: payload.expires_at,
    location: null,
  } satisfies OfficeDeviceApprovalReview;
}

export async function refreshOfficeIdentity(context: OfficeSessionContext): Promise<OfficeSessionContext> {
  const response = await rawApi("/api/v1/auth/session", {
    headers: { Authorization: `Bearer ${context.session.access_token}` },
  });
  const payload = await parseOrThrow<FirstPartyAuthResponse>(response);
  return {
    session: { ...context.session, access_token: payload.access_token || context.session.access_token },
    identity: toIdentity(payload),
    mfa: { enrolled: payload.mfa?.enrolled === true },
  };
}

export async function changeOfficePassword(
  context: OfficeSessionContext,
  currentPassword: string,
  newPassword: string,
) {
  const response = await rawApi("/api/v1/auth/password", {
    method: "POST",
    headers: { Authorization: `Bearer ${context.session.access_token}` },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  return parseOrThrow<{ changed: true; revoked_other_sessions: number }>(response);
}

export async function completeOfficePasswordRecovery(token: string, newPassword: string) {
  const response = await rawApi("/api/v1/auth/recovery/password", {
    method: "POST",
    body: JSON.stringify({ token, new_password: newPassword }),
  });
  return parseOrThrow<{ recovered: true; revoked_sessions: number }>(response);
}

export async function issueFounderBreakGlassRecovery(recoveryKey: string, reason: string) {
  const response = await rawApi("/api/v1/auth/founder/recovery-link", {
    method: "POST",
    headers: { "X-Kravia-Break-Glass-Key": recoveryKey },
    body: JSON.stringify({ reason }),
  });
  return parseOrThrow<{
    issued: true;
    expires_in: number;
    recovery_token: string;
    recovery_path: string;
    revoked_sessions: number;
    mfa_reset: true;
  }>(response);
}

export async function listOfficeAuthSessions(context: OfficeSessionContext) {
  const response = await rawApi("/api/v1/auth/sessions", {
    headers: { Authorization: `Bearer ${context.session.access_token}` },
  });
  return parseOrThrow<{ sessions: OfficeAuthSessionRecord[] }>(response);
}

export async function revokeOfficeAuthSession(context: OfficeSessionContext, sessionId: string) {
  const response = await rawApi(`/api/v1/auth/sessions/${encodeURIComponent(sessionId)}/revoke`, {
    method: "POST",
    headers: { Authorization: `Bearer ${context.session.access_token}` },
  });
  return parseOrThrow<{ revoked: true; session: OfficeAuthSessionRecord }>(response);
}

export async function listAuthenticatorActivationRequests(context: OfficeSessionContext) {
  const response = await rawApi("/api/v1/auth/authenticator/activation-requests", {
    headers: { Authorization: `Bearer ${context.session.access_token}` },
  });
  return parseOrThrow<{ activation_requests: AuthenticatorActivationRequest[] }>(response);
}

export async function approveAuthenticatorActivationRequest(context: OfficeSessionContext, activationId: string) {
  const response = await rawApi(`/api/v1/auth/authenticator/activation-requests/${encodeURIComponent(activationId)}/approve`, {
    method: "POST",
    headers: { Authorization: `Bearer ${context.session.access_token}` },
  });
  return parseOrThrow<{ approved: true; request_id: string }>(response);
}

export async function signOutOffice(context?: OfficeSessionContext | null) {
  if (context) {
    try {
      await rawApi("/api/v1/auth/sign-out", {
        method: "POST",
        headers: { Authorization: `Bearer ${context.session.access_token}` },
      });
    } catch {
      /* Browser cookies are still cleared below. */
    }
  }
  await clearOfficeSessionCookies();
}
