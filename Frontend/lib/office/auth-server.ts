import "server-only";

import { cookies } from "next/headers";
import { getOfficeRuntimeOrigin } from "@/lib/env/office";
import { isOfficeDepartment, type OfficeDepartment } from "@/lib/office/access-policy";
import { isOfficeRole, type OfficeRole } from "@/lib/office/workspaces";

export const OFFICE_ACCESS_COOKIE = "kravia_office_access";
export const OFFICE_REFRESH_COOKIE = "kravia_office_refresh";
export const OFFICE_RECOVERY_COOKIE = "kravia_office_recovery";

const ACCESS_COOKIE_MAX_AGE_SECONDS = 60 * 60;
const REFRESH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

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
};

type ApiErrorBody = { detail?: string };

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
    throw new Error(typeof body.detail === "string" ? body.detail : "KRAVIA Office identity request failed");
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

export async function clearOfficeRecoveryCookie() {
  const store = await cookies();
  store.set(OFFICE_RECOVERY_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
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
  store.set(OFFICE_RECOVERY_COOKIE, "", options);
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
  await clearOfficeRecoveryCookie();
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

export async function enrollOfficeMfa(context: OfficeSessionContext) {
  const response = await rawApi("/api/v1/auth/mfa/enroll", {
    method: "POST",
    headers: { Authorization: `Bearer ${context.session.access_token}` },
  });
  return parseOrThrow<{ factor_id: string; qr_code: string; manual_key: string; friendly_name: string }>(response);
}

export async function verifyOfficeMfa(context: OfficeSessionContext, code: string) {
  const response = await rawApi("/api/v1/auth/mfa/verify", {
    method: "POST",
    headers: { Authorization: `Bearer ${context.session.access_token}` },
    body: JSON.stringify({ code }),
  });
  const payload = await parseOrThrow<FirstPartyAuthResponse & { verified: true }>(response);
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
  return next;
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

// Recovery is intentionally administrator-assisted in the first-party rollout.
// No email-based self-service recovery endpoint is exposed until its provider and
// anti-takeover workflow are separately approved.
export async function requestOfficePasswordRecovery() {
  throw new Error("ADMINISTRATOR_ASSISTED_RECOVERY_REQUIRED");
}
export async function verifyOfficeRecoveryToken() {
  throw new Error("ADMINISTRATOR_ASSISTED_RECOVERY_REQUIRED");
}
export async function writeOfficeRecoveryCookie() {
  throw new Error("ADMINISTRATOR_ASSISTED_RECOVERY_REQUIRED");
}
export async function officeRecoveryIsVerified() {
  return false;
}
