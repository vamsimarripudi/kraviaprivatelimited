import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  signOutAuthenticatorSession,
} from "../src/activation";
import type { AuthenticatorDeviceSession } from "../src/storage";

const originalOrigin = process.env.EXPO_PUBLIC_OFFICE_API_ORIGIN;
const apiOrigin = "https://office.example.test";

function jsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function deviceSession(): AuthenticatorDeviceSession {
  return {
    version: 1,
    purpose: "AUTHENTICATOR_ACTIVATION",
    email: "member@kravia.example",
    accessToken: "a".repeat(48),
    refreshToken: "r".repeat(48),
    expiresAt: "2030-01-01T00:00:00.000Z",
    deviceApprovalId: "00000000-0000-4000-8000-000000000001",
    deviceProof: "p".repeat(48),
  };
}

function refreshedSessionPayload() {
  return {
    authenticated: true,
    email: "member@kravia.example",
    access_token: "n".repeat(48),
    refresh_token: "s".repeat(48),
    refresh_expires_at: "2030-01-02T00:00:00.000Z",
    session_purpose: "AUTHENTICATOR_ACTIVATION",
  };
}

describe("Authenticator secure sign out", () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_OFFICE_API_ORIGIN = apiOrigin;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalOrigin === undefined) delete process.env.EXPO_PUBLIC_OFFICE_API_ORIGIN;
    else process.env.EXPO_PUBLIC_OFFICE_API_ORIGIN = originalOrigin;
  });

  it("refreshes an expired access token and then confirms server-side sign out", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { detail: "Office session is invalid or expired" }))
      .mockResolvedValueOnce(jsonResponse(200, refreshedSessionPayload()))
      .mockResolvedValueOnce(jsonResponse(200, { signed_out: true }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(signOutAuthenticatorSession(deviceSession())).resolves.toEqual({ state: "server_signed_out" });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(`${apiOrigin}/api/v1/auth/sign-out`);
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe(`${apiOrigin}/api/v1/auth/refresh`);
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({
      headers: expect.objectContaining({ Authorization: `Bearer ${"n".repeat(48)}` }),
    });
  });

  it("clears a local session only when the refresh endpoint proves it is already inactive", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { detail: "Office session is invalid or expired" }))
      .mockResolvedValueOnce(jsonResponse(401, { detail: "Office refresh session is invalid or expired" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(signOutAuthenticatorSession(deviceSession())).resolves.toEqual({ state: "already_inactive" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not hide an unavailable or stale server endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(404, { detail: "Not Found" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(signOutAuthenticatorSession(deviceSession())).rejects.toMatchObject({ status: 404 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("persists a rotated session before surfacing a failed final sign-out", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { detail: "Office session is invalid or expired" }))
      .mockResolvedValueOnce(jsonResponse(200, refreshedSessionPayload()))
      .mockResolvedValueOnce(jsonResponse(401, { detail: "Office session is invalid or expired" }));
    vi.stubGlobal("fetch", fetchMock);
    const persistRefreshedSession = vi.fn();

    await expect(
      signOutAuthenticatorSession(deviceSession(), persistRefreshedSession),
    ).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(persistRefreshedSession).toHaveBeenCalledWith(expect.objectContaining({
      accessToken: "n".repeat(48),
      refreshToken: "s".repeat(48),
    }));
  });
});
