import type { KraviaTotpAccount } from "./types";

export type PendingAuthenticatorActivation = {
  requestId: string;
  claimToken: string;
  expiresAt: string;
};

type ActivationRequestResponse = {
  request_id: string;
  claim_token: string;
  status: "PENDING" | "APPROVED";
  expires_at: string;
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
  try {
    target = new URL(path, origin);
  } catch {
    throw new Error("Authenticator identity service address is invalid.");
  }
  if (target.protocol !== "https:") throw new Error("Authenticator requires a secure HTTPS identity service.");
  return target;
}

async function requestJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({} as { detail?: unknown }));
  if (!response.ok) {
    const detail = typeof payload?.detail === "string" ? payload.detail : "Authenticator request could not be completed.";
    throw new Error(detail);
  }
  return payload as T;
}

export async function requestAuthenticatorActivation(email: string, password: string): Promise<PendingAuthenticatorActivation> {
  const result = await requestJson<ActivationRequestResponse>("/api/v1/auth/authenticator/activation-requests", { email, password });
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
