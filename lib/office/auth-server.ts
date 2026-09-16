import "server-only";
import { cookies } from "next/headers";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { requireOfficeEnvironment } from "@/lib/env/office";
import { isOfficeRole, type OfficeRole } from "@/lib/office/workspaces";

export const OFFICE_ACCESS_COOKIE = "kravia_office_access";
export const OFFICE_REFRESH_COOKIE = "kravia_office_refresh";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type OfficeIdentity = {
  userId: string;
  email?: string;
  roles: OfficeRole[];
  accessStatus: string;
  aal: "aal1" | "aal2";
};

export type OfficeSessionContext = {
  client: SupabaseClient;
  session: Session;
  identity: OfficeIdentity;
};

function createOfficeAuthClient() {
  const environment = requireOfficeEnvironment();
  return createClient(environment.OFFICE_SUPABASE_URL, environment.OFFICE_SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
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

function identityFromSession(session: Session): OfficeIdentity {
  const claims = decodeJwtPayload(session.access_token);
  const rawRoles = Array.isArray(claims.office_roles) ? claims.office_roles : [];
  const roles = rawRoles.filter(isOfficeRole);
  const aal = claims.aal === "aal2" ? "aal2" : "aal1";
  return {
    userId: session.user.id,
    email: session.user.email,
    roles,
    accessStatus: typeof claims.office_access_status === "string" ? claims.office_access_status : "UNASSIGNED",
    aal,
  };
}

export function officeIdentityIsProvisioned(identity: OfficeIdentity) {
  return identity.accessStatus === "ACTIVE" && identity.roles.length > 0;
}

export async function writeOfficeSessionCookies(session: Session) {
  const store = await cookies();
  const secure = process.env.NODE_ENV === "production";
  const options = {
    httpOnly: true,
    secure,
    sameSite: "strict" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
  store.set(OFFICE_ACCESS_COOKIE, session.access_token, options);
  store.set(OFFICE_REFRESH_COOKIE, session.refresh_token, options);
}

export async function clearOfficeSessionCookies() {
  const store = await cookies();
  const secure = process.env.NODE_ENV === "production";
  const options = { httpOnly: true, secure, sameSite: "strict" as const, path: "/", maxAge: 0 };
  store.set(OFFICE_ACCESS_COOKIE, "", options);
  store.set(OFFICE_REFRESH_COOKIE, "", options);
}

/**
 * Restores and verifies the dedicated KRAVIA Office session. A cookie alone is
 * never considered proof of identity: Supabase Auth verifies the user before a
 * protected workspace receives the session context.
 */
export async function getOfficeSessionContext(): Promise<OfficeSessionContext | null> {
  let client: SupabaseClient;
  try {
    client = createOfficeAuthClient();
  } catch {
    return null;
  }

  const store = await cookies();
  const accessToken = store.get(OFFICE_ACCESS_COOKIE)?.value;
  const refreshToken = store.get(OFFICE_REFRESH_COOKIE)?.value;
  if (!accessToken || !refreshToken) return null;

  const { data: restored, error: restoreError } = await client.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (restoreError || !restored.session) return null;

  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) return null;

  const session = restored.session;
  // setSession may transparently refresh an expired access token. Persist the
  // refreshed pair where the current execution context allows cookie writes.
  if (session.access_token !== accessToken || session.refresh_token !== refreshToken) {
    try {
      await writeOfficeSessionCookies(session);
    } catch {
      // Server Components cannot mutate cookies; a route-handler call will
      // refresh/persist them on the next interactive auth request.
    }
  }

  return { client, session, identity: identityFromSession(session) };
}

export async function signInOffice(email: string, password: string): Promise<OfficeSessionContext> {
  const client = createOfficeAuthClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error("INVALID_CREDENTIALS");

  const identity = identityFromSession(data.session);
  if (!officeIdentityIsProvisioned(identity)) {
    await client.auth.signOut({ scope: "local" });
    throw new Error("ACCESS_NOT_PROVISIONED");
  }
  await writeOfficeSessionCookies(data.session);
  return { client, session: data.session, identity };
}

export async function refreshOfficeIdentity(context: OfficeSessionContext): Promise<OfficeSessionContext> {
  const { data, error } = await context.client.auth.refreshSession(context.session.refresh_token);
  if (error || !data.session) throw new Error("SESSION_REFRESH_FAILED");
  const identity = identityFromSession(data.session);
  await writeOfficeSessionCookies(data.session);
  return { client: context.client, session: data.session, identity };
}

export async function signOutOffice(context?: OfficeSessionContext | null) {
  if (context) {
    try {
      await context.client.auth.signOut({ scope: "local" });
    } catch {
      // Local cookie destruction below is the authoritative browser logout.
    }
  }
  await clearOfficeSessionCookies();
}
