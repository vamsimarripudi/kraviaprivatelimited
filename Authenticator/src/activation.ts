import type { AuthenticatorActivationSession, PendingAuthenticatorActivation } from "./storage";
import type { KraviaTotpAccount } from "./types";

export type PendingEmailOtpChallenge = {
  challengeId: string;
  challengeToken: string;
  email: string;
  expiresAt: string;
  resendAvailableAt: string;
};

export class IdentityApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "IdentityApiError";
  }
}

type ChallengeResponse = {
  challenge_id: string;
  challenge_token: string;
  email: string;
  expires_at: string;
  resend_available_at: string;
};

type SessionResponse = {
  authenticated: true;
  email: string;
  access_token: string;
  refresh_token: string;
  refresh_expires_at: string;
  session_purpose: "AUTHENTICATOR_ACTIVATION";
};

type ActivationRequestResponse = {
  request_id: string;
  claim_token: string;
  status: "PENDING" | "APPROVED";
  expires_at: string;
  approval_required: boolean;
};

type ActivationClaimResponse =
  | { status: "PENDING"; expires_at: string }
  | {
    status: "ENROLLED";
    account: string;
    secret: string;
    issuer: "KRAVIA Office";
    algorithm: "SHA1";
    digits: 6;
    period: 30;
    enrolled_at: string;
  };

function apiUrl(path: string) {
  const origin = process.env.EXPO_PUBLIC_OFFICE_API_ORIGIN?.trim();
  if (!origin) throw new Error("Authenticator is not configured. Install a KRAVIA-managed build with the Office identity service configured.");
  let target: URL;
  try { target = new URL(path, origin); } catch { throw new Error("KRAVIA identity service address is invalid."); }
  if (target.protocol !== "https:") throw new Error("Authenticator requires a secure HTTPS identity service.");
  return target;
}

async function requestJson<T>(path: string, body?: unknown, accessToken?: string): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers: {
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json().catch(() => ({} as { detail?: unknown }));
  if (!response.ok) {
    if (response.status === 404) throw new IdentityApiError(response.status, "Authenticator activation has not been enabled by KRAVIA yet.");
    const detail = typeof payload?.detail === "string" ? payload.detail : "Authenticator request could not be completed.";
    throw new IdentityApiError(response.status, detail);
  }
  return payload as T;
}

function toChallenge(result: ChallengeResponse): PendingEmailOtpChallenge {
  if (!result.challenge_id || !result.challenge_token || !Number.isFinite(Date.parse(result.expires_at)) || !Number.isFinite(Date.parse(result.resend_available_at))) throw new Error("The identity service returned an invalid email verification request.");
  return { challengeId: result.challenge_id, challengeToken: result.challenge_token, email: result.email, expiresAt: result.expires_at, resendAvailableAt: result.resend_available_at };
}

function toSession(result: SessionResponse): AuthenticatorActivationSession {
  if (
    !result.access_token || !result.refresh_token || result.session_purpose !== "AUTHENTICATOR_ACTIVATION"
    || !Number.isFinite(Date.parse(result.refresh_expires_at))
  ) throw new Error("The identity service returned an invalid mobile verification session.");
  return {
    version: 1,
    purpose: "AUTHENTICATOR_ACTIVATION",
    email: result.email,
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    expiresAt: result.refresh_expires_at,
  };
}

export async function requestEmailOtp(email: string, password: string) {
  return toChallenge(await requestJson<ChallengeResponse>("/api/v1/auth/email-otp/challenges", { email, password, channel: "authenticator_mobile" }));
}

export async function resendEmailOtp(challenge: PendingEmailOtpChallenge) {
  return toChallenge(await requestJson<ChallengeResponse>(`/api/v1/auth/email-otp/challenges/${encodeURIComponent(challenge.challengeId)}/resend`, { challenge_token: challenge.challengeToken }));
}

export async function verifyEmailOtp(challenge: PendingEmailOtpChallenge, code: string) {
  return toSession(await requestJson<SessionResponse>(`/api/v1/auth/email-otp/challenges/${encodeURIComponent(challenge.challengeId)}/verify`, { challenge_token: challenge.challengeToken, code }));
}

/**
 * Rotates the scoped, 30-day native activation session before an authenticated
 * activation request.  The returned token remains incapable of becoming an
 * Office browser session; the server preserves AUTHENTICATOR_ACTIVATION as
 * the session purpose during rotation.
 */
export async function refreshAuthenticatorSession(session: AuthenticatorActivationSession) {
  return toSession(await requestJson<SessionResponse>("/api/v1/auth/refresh", { refresh_token: session.refreshToken }));
}

export async function requestAuthenticatorActivation(session: AuthenticatorActivationSession): Promise<PendingAuthenticatorActivation> {
  const result = await requestJson<ActivationRequestResponse>("/api/v1/auth/authenticator/activation-requests", undefined, session.accessToken);
  if (!result.request_id || !result.claim_token || !Number.isFinite(Date.parse(result.expires_at))) throw new Error("The identity service returned an invalid phone activation request.");
  return { requestId: result.request_id, claimToken: result.claim_token, expiresAt: result.expires_at };
}

export async function claimAuthenticatorActivation(pending: PendingAuthenticatorActivation): Promise<
  | { status: "PENDING"; expiresAt: string }
  | { status: "ENROLLED"; account: KraviaTotpAccount }
> {
  const result = await requestJson<ActivationClaimResponse>(
    `/api/v1/auth/authenticator/activation-requests/${encodeURIComponent(pending.requestId)}/claim`,
    { claim_token: pending.claimToken },
  );
  if (result.status === "PENDING") return { status: "PENDING", expiresAt: result.expires_at };
  return {
    status: "ENROLLED",
    account: {
      version: 1,
      issuer: result.issuer,
      account: result.account,
      secret: result.secret,
      algorithm: result.algorithm,
      digits: result.digits,
      period: result.period,
      enrolledAt: result.enrolled_at,
    },
  };
}
