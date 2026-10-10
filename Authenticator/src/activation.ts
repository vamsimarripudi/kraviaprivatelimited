import type {
  AuthenticatorDeviceSession,
  AuthenticatorFactor,
  PendingDeviceApproval,
} from "./storage";
import { KRAVIA_ISSUER } from "./types";

export type PendingEmailOtpChallenge = {
  challengeId: string;
  challengeToken: string;
  email: string;
  expiresAt: string;
  resendAvailableAt: string;
  verificationMethod: "EMAIL" | "PLAY_REVIEW";
};

export class IdentityApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

type ChallengeResponse = {
  challenge_id: string;
  challenge_token: string;
  email: string;
  expires_at: string;
  resend_available_at: string;
  verification_method?: "EMAIL" | "PLAY_REVIEW";
};
type ReviewDeviceResponse = {
  device_approval_id: string;
  device_proof: string;
};
type ActiveSessionResponse = {
  authenticated: true;
  email: string;
  access_token: string;
  refresh_token: string;
  refresh_expires_at: string;
  session_purpose: "AUTHENTICATOR_ACTIVATION";
  review_device?: ReviewDeviceResponse;
};
type PendingResponse = {
  authenticated: false;
  device_approval_pending: true;
  device_approval_id: string;
  device_proof: string;
  expires_at: string;
  device_label: string;
  email: string;
  session_purpose: "AUTHENTICATOR_ACTIVATION";
};
type DeviceStatusResponse = {
  approval_id: string;
  status:
    | "PENDING"
    | "APPROVED"
    | "DECLINED"
    | "EXPIRED"
    | "REVOKED"
    | "TRUSTED"
    | "DELIVERY_FAILED"
    | "DELIVERY_UNKNOWN";
  expires_at: string;
  device_label: string;
};
type ActivationRequestResponse = {
  request_id: string;
  claim_token: string;
  status: "APPROVED" | "PENDING";
  expires_at: string;
  approval_required: boolean;
};
type EnrollmentResponse = {
  status: "ENROLLED";
  account: string;
  secret: string;
  issuer: string;
  algorithm: "SHA1";
  digits: 6;
  period: 30;
  enrolled_at: string;
};
type QrSigninStatusResponse = {
  request_id: string;
  status: "PENDING" | "SCANNED" | "APPROVED" | "REJECTED" | "EXPIRED" | "REVOKED" | "CONSUMED";
  expires_at: string;
  browser_label: string;
  source_address: string;
};

export type ParsedQrSignin = {
  requestId: string;
  scanToken: string;
};

export type QrSigninApproval = {
  requestId: string;
  status: "SCANNED" | "APPROVED" | "REJECTED";
  expiresAt: string;
  browserLabel: string;
  sourceAddress: string;
};

function apiUrl(path: string) {
  const origin = process.env.EXPO_PUBLIC_OFFICE_API_ORIGIN?.trim();
  if (!origin) {
    throw new Error(
      "Authenticator is not configured. Install a KRAVIA-managed build with the Office identity service configured.",
    );
  }
  let target: URL;
  try {
    target = new URL(path, origin);
  } catch {
    throw new Error("KRAVIA identity service address is invalid.");
  }
  if (target.protocol !== "https:") {
    throw new Error("Authenticator requires a secure HTTPS identity service.");
  }
  return target;
}

async function requestJson<T>(
  path: string,
  body?: unknown,
  accessToken?: string,
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken) headers.Authorization = "Bearer " + accessToken;
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json().catch(() => ({ detail: undefined }));
  if (!response.ok) {
    if (response.status === 404) {
      throw new IdentityApiError(
        response.status,
        "This KRAVIA device request is not available.",
      );
    }
    throw new IdentityApiError(
      response.status,
      typeof payload?.detail === "string"
        ? payload.detail
        : "Authenticator request could not be completed.",
    );
  }
  return payload as T;
}

function validId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
}
function validSecret(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{32,}$/.test(value);
}
function validAccessToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9._-]{32,}$/.test(value);
}
function validBase32(value: unknown): value is string {
  return typeof value === "string" && /^[A-Z2-7]{16,128}$/.test(value);
}

function toChallenge(result: ChallengeResponse): PendingEmailOtpChallenge {
  if (
    !validId(result.challenge_id) ||
    !validSecret(result.challenge_token) ||
    typeof result.email !== "string" ||
    !Number.isFinite(Date.parse(result.expires_at)) ||
    !Number.isFinite(Date.parse(result.resend_available_at))
  ) {
    throw new Error(
      "The identity service returned an invalid email verification request.",
    );
  }
  return {
    challengeId: result.challenge_id,
    challengeToken: result.challenge_token,
    email: result.email,
    expiresAt: result.expires_at,
    resendAvailableAt: result.resend_available_at,
    verificationMethod:
      result.verification_method === "PLAY_REVIEW" ? "PLAY_REVIEW" : "EMAIL",
  };
}

function reviewDevice(result: ActiveSessionResponse): Pick<
  AuthenticatorDeviceSession,
  "deviceApprovalId" | "deviceProof"
> | null {
  const device = result.review_device;
  if (!device) return null;
  if (!validId(device.device_approval_id) || !validSecret(device.device_proof)) {
    throw new Error("The identity service returned an invalid review-device session.");
  }
  return {
    deviceApprovalId: device.device_approval_id,
    deviceProof: device.device_proof,
  };
}

function toSession(
  result: ActiveSessionResponse,
  device: Pick<
    AuthenticatorDeviceSession,
    "deviceApprovalId" | "deviceProof"
  >,
): AuthenticatorDeviceSession {
  if (
    !validAccessToken(result.access_token) ||
    !validSecret(result.refresh_token) ||
    typeof result.email !== "string" ||
    result.session_purpose !== "AUTHENTICATOR_ACTIVATION" ||
    !Number.isFinite(Date.parse(result.refresh_expires_at))
  ) {
    throw new Error(
      "The identity service returned an invalid trusted-device session.",
    );
  }
  return {
    version: 1,
    purpose: "AUTHENTICATOR_ACTIVATION",
    email: result.email,
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    expiresAt: result.refresh_expires_at,
    deviceApprovalId: device.deviceApprovalId,
    deviceProof: device.deviceProof,
  };
}

function toQrSigninApproval(result: QrSigninStatusResponse, expectedRequestId: string): QrSigninApproval {
  const statuses = new Set(["SCANNED", "APPROVED", "REJECTED"]);
  if (
    !validId(result.request_id) || result.request_id !== expectedRequestId ||
    !statuses.has(result.status) || !Number.isFinite(Date.parse(result.expires_at)) ||
    typeof result.browser_label !== "string" || !result.browser_label.trim() ||
    typeof result.source_address !== "string" || !result.source_address.trim()
  ) {
    throw new Error("The identity service returned an invalid QR sign-in request.");
  }
  return {
    requestId: result.request_id,
    status: result.status as QrSigninApproval["status"],
    expiresAt: result.expires_at,
    browserLabel: result.browser_label,
    sourceAddress: result.source_address,
  };
}

export function parseQrSigninPayload(value: string): ParsedQrSignin {
  const match = /^kraviaauth:\/\/signin\?request=([0-9a-f-]{36})&token=([A-Za-z0-9_-]{32,})$/i.exec(value.trim());
  if (!match || !validId(match[1]) || !validSecret(match[2])) {
    throw new Error("This is not a KRAVIA Office sign-in QR code.");
  }
  return { requestId: match[1].toLowerCase(), scanToken: match[2] };
}

function toPending(result: PendingResponse): PendingDeviceApproval {
  if (
    !validId(result.device_approval_id) ||
    !validSecret(result.device_proof) ||
    typeof result.email !== "string" ||
    !Number.isFinite(Date.parse(result.expires_at)) ||
    typeof result.device_label !== "string" ||
    !result.device_label.trim()
  ) {
    throw new Error(
      "The identity service returned an invalid device approval request.",
    );
  }
  return {
    version: 1,
    email: result.email,
    approvalId: result.device_approval_id,
    deviceProof: result.device_proof,
    expiresAt: result.expires_at,
    deviceLabel: result.device_label,
  };
}

export async function requestEmailOtp(email: string, password: string) {
  return toChallenge(
    await requestJson<ChallengeResponse>("/api/v1/auth/email-otp/challenges", {
      email,
      password,
      channel: "authenticator_mobile",
    }),
  );
}

export async function resendEmailOtp(challenge: PendingEmailOtpChallenge) {
  return toChallenge(
    await requestJson<ChallengeResponse>(
      "/api/v1/auth/email-otp/challenges/" +
        encodeURIComponent(challenge.challengeId) +
        "/resend",
      { challenge_token: challenge.challengeToken },
    ),
  );
}

export async function verifyEmailOtp(
  challenge: PendingEmailOtpChallenge,
  code: string,
  trustedDevice: Pick<
    AuthenticatorDeviceSession,
    "deviceApprovalId" | "deviceProof"
  > | null,
) {
  const result = await requestJson<ActiveSessionResponse | PendingResponse>(
    "/api/v1/auth/email-otp/challenges/" +
      encodeURIComponent(challenge.challengeId) +
      "/verify",
    {
      challenge_token: challenge.challengeToken,
      code,
      ...(trustedDevice
        ? {
            device_approval_id: trustedDevice.deviceApprovalId,
            device_proof: trustedDevice.deviceProof,
          }
        : {}),
    },
  );
  if (
    result.authenticated === false &&
    result.device_approval_pending === true
  ) {
    return { kind: "pending" as const, pending: toPending(result) };
  }
  const sessionDevice = trustedDevice ?? (result.authenticated === true ? reviewDevice(result) : null);
  if (result.authenticated !== true || !sessionDevice) {
    throw new Error(
      "The identity service did not establish a trusted-device session.",
    );
  }
  return {
    kind: "active" as const,
    session: toSession(result, sessionDevice),
  };
}

export async function checkDeviceApproval(pending: PendingDeviceApproval) {
  const result = await requestJson<DeviceStatusResponse>(
    "/api/v1/auth/device-approvals/status",
    { device_id: pending.approvalId, device_proof: pending.deviceProof },
  );
  if (
    !validId(result.approval_id) ||
    result.approval_id !== pending.approvalId ||
    !Number.isFinite(Date.parse(result.expires_at))
  ) {
    throw new Error(
      "The identity service returned an invalid device approval status.",
    );
  }
  return result;
}

export async function completeDeviceApproval(pending: PendingDeviceApproval) {
  return toSession(
    await requestJson<ActiveSessionResponse>(
      "/api/v1/auth/device-approvals/complete",
      { device_id: pending.approvalId, device_proof: pending.deviceProof },
    ),
    {
      deviceApprovalId: pending.approvalId,
      deviceProof: pending.deviceProof,
    },
  );
}

export async function refreshAuthenticatorSession(session: AuthenticatorDeviceSession) {
  const refreshed = toSession(
    await requestJson<ActiveSessionResponse>("/api/v1/auth/refresh", {
      refresh_token: session.refreshToken,
    }),
    session,
  );
  if (refreshed.email !== session.email) {
    throw new Error("The identity service returned a session for a different account.");
  }
  return refreshed;
}

export type AuthenticatorSignOutResult =
  | { state: "server_signed_out" }
  | { state: "already_inactive" };

export async function signOutAuthenticatorSession(
  session: AuthenticatorDeviceSession,
  persistRefreshedSession?: (session: AuthenticatorDeviceSession) => Promise<void> | void,
): Promise<AuthenticatorSignOutResult> {
  try {
    await requestJson<{ signed_out: true }>(
      "/api/v1/auth/sign-out",
      undefined,
      session.accessToken,
    );
    return { state: "server_signed_out" };
  } catch (error) {
    // Access tokens are intentionally short-lived. A valid 30-day device
    // refresh session is enough to obtain one final access token and revoke
    // the server session; do not make a user sign in again merely to sign out.
    if (!(error instanceof IdentityApiError) || error.status !== 401) throw error;
  }

  let refreshed: AuthenticatorDeviceSession;
  try {
    refreshed = await refreshAuthenticatorSession(session);
  } catch (error) {
    // A failed refresh means the authoritative server session is already
    // expired or revoked. Clearing the local copy is then safe. Other errors
    // (network, 403, 404, or an invalid fresh access token) stay visible so
    // the phone never pretends that a live session was revoked.
    if (error instanceof IdentityApiError && error.status === 401) {
      return { state: "already_inactive" };
    }
    throw error;
  }

  // Refresh-token rotation invalidates the old secure-storage value. Persist
  // the replacement before another network call so an interrupted sign-out
  // remains retryable instead of being misclassified as already inactive.
  await persistRefreshedSession?.(refreshed);

  // A fresh access token rejected here is not interchangeable with a failed
  // refresh. Preserve the error rather than clearing local state, because the
  // server may still hold a session that was not successfully revoked.
  await requestJson<{ signed_out: true }>(
    "/api/v1/auth/sign-out",
    undefined,
    refreshed.accessToken,
  );
  return { state: "server_signed_out" };
}

export async function revokeAuthenticatorTrustedDevice(session: AuthenticatorDeviceSession) {
  await requestJson<{ revoked: true }>(
    "/api/v1/auth/device-approvals/revoke",
    { device_id: session.deviceApprovalId, device_proof: session.deviceProof },
    session.accessToken,
  );
}

export async function scanQrSignin(
  session: AuthenticatorDeviceSession,
  request: ParsedQrSignin,
): Promise<QrSigninApproval> {
  return toQrSigninApproval(
    await requestJson<QrSigninStatusResponse>(
      "/api/v1/auth/qr-signins/scan",
      {
        request_id: request.requestId,
        scan_token: request.scanToken,
        device_approval_id: session.deviceApprovalId,
        device_proof: session.deviceProof,
      },
      session.accessToken,
    ),
    request.requestId,
  );
}

export async function decideQrSignin(
  session: AuthenticatorDeviceSession,
  approval: QrSigninApproval,
  decision: "APPROVE" | "REJECT",
): Promise<QrSigninApproval> {
  return toQrSigninApproval(
    await requestJson<QrSigninStatusResponse>(
      "/api/v1/auth/qr-signins/decision",
      {
        request_id: approval.requestId,
        device_approval_id: session.deviceApprovalId,
        device_proof: session.deviceProof,
        decision,
      },
      session.accessToken,
    ),
    approval.requestId,
  );
}

export async function requestAuthenticatorActivation(accessToken: string) {
  const result = await requestJson<ActivationRequestResponse>(
    "/api/v1/auth/authenticator/activation-requests",
    undefined,
    accessToken,
  );
  if (result.status === "PENDING" || result.approval_required !== false) {
    throw new Error(
      "This identity service still requires a legacy administrator approval. Update the paired service before trusting this phone.",
    );
  }
  if (
    !validId(result.request_id) ||
    !validSecret(result.claim_token) ||
    result.status !== "APPROVED" ||
    !Number.isFinite(Date.parse(result.expires_at))
  ) {
    throw new Error(
      "The identity service returned an invalid Authenticator activation request.",
    );
  }
  return {
    requestId: result.request_id,
    claimToken: result.claim_token,
  };
}

export async function claimAuthenticatorActivation(request: {
  requestId: string;
  claimToken: string;
}): Promise<AuthenticatorFactor> {
  const result = await requestJson<EnrollmentResponse>(
    "/api/v1/auth/authenticator/activation-requests/" +
      encodeURIComponent(request.requestId) +
      "/claim",
    { claim_token: request.claimToken },
  );
  if (
    result.status !== "ENROLLED" ||
    typeof result.account !== "string" ||
    !validBase32(result.secret) ||
    result.issuer !== KRAVIA_ISSUER ||
    result.algorithm !== "SHA1" ||
    result.digits !== 6 ||
    result.period !== 30 ||
    !Number.isFinite(Date.parse(result.enrolled_at))
  ) {
    throw new Error(
      "The identity service returned an invalid Authenticator factor.",
    );
  }
  return {
    version: 1,
    account: result.account.trim().toLowerCase(),
    secret: result.secret,
    issuer: KRAVIA_ISSUER,
    algorithm: result.algorithm,
    digits: result.digits,
    period: result.period,
    enrolledAt: result.enrolled_at,
  };
}
