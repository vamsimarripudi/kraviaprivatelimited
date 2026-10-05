import type { OfficeMobileSession } from "./storage";

export type PendingEmailOtpChallenge = {
  challengeId: string;
  challengeToken: string;
  email: string;
  expiresAt: string;
  resendAvailableAt: string;
};

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
};

function apiUrl(path: string) {
  const origin = process.env.EXPO_PUBLIC_OFFICE_API_ORIGIN?.trim();
  if (!origin) throw new Error("Email sign-in is not configured. Install a KRAVIA-managed build with the Office identity service configured.");
  let target: URL;
  try { target = new URL(path, origin); } catch { throw new Error("KRAVIA identity service address is invalid."); }
  if (target.protocol !== "https:") throw new Error("KRAVIA requires a secure HTTPS identity service.");
  return target;
}

async function requestJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(apiUrl(path), { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => ({} as { detail?: unknown }));
  if (!response.ok) {
    if (response.status === 404) throw new Error("Email verification has not been enabled by KRAVIA yet.");
    const detail = typeof payload?.detail === "string" ? payload.detail : "Email verification could not be completed.";
    throw new Error(detail);
  }
  return payload as T;
}

function toChallenge(result: ChallengeResponse): PendingEmailOtpChallenge {
  if (!result.challenge_id || !result.challenge_token || !Number.isFinite(Date.parse(result.expires_at))) throw new Error("The identity service returned an invalid email verification request.");
  return { challengeId: result.challenge_id, challengeToken: result.challenge_token, email: result.email, expiresAt: result.expires_at, resendAvailableAt: result.resend_available_at };
}

function toSession(result: SessionResponse): OfficeMobileSession {
  if (!result.access_token || !result.refresh_token || !Number.isFinite(Date.parse(result.refresh_expires_at))) throw new Error("The identity service returned an invalid signed-in session.");
  return { version: 1, email: result.email, accessToken: result.access_token, refreshToken: result.refresh_token, expiresAt: result.refresh_expires_at };
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
