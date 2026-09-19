import "server-only";

import { getOfficeRuntimeOrigin } from "@/lib/env/office";
import { getOfficeSessionContext, officeIdentityIsProvisioned } from "@/lib/office/auth-server";

const ALLOWED_ROOTS = new Set([
  "company",
  "products",
  "customers",
  "commercial",
  "invoices",
  "compliance",
  "contracts",
  "vendors",
  "assets",
]);

export class OfficeRuntimeReadError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OfficeRuntimeReadError";
  }
}

function normalizedPath(path: string) {
  const segments = path.split("/").filter(Boolean);
  if (!segments.length || !ALLOWED_ROOTS.has(segments[0])) return null;
  if (segments.some((segment) =>
    segment === "." ||
    segment === ".." ||
    segment.includes("\\") ||
    segment.includes("?") ||
    segment.includes("#")
  )) return null;
  return segments.map(encodeURIComponent).join("/");
}

export async function readOfficeRuntime<T>(path: string): Promise<T> {
  const normalized = normalizedPath(path);
  if (!normalized) throw new OfficeRuntimeReadError(404, "Office runtime read path is not permitted");

  const origin = getOfficeRuntimeOrigin();
  if (!origin) throw new OfficeRuntimeReadError(503, "KRAVIA Office runtime is not activated on this deployment");

  const session = await getOfficeSessionContext();
  if (!session || !officeIdentityIsProvisioned(session.identity)) {
    throw new OfficeRuntimeReadError(401, "Office sign-in required");
  }
  if (session.identity.aal !== "aal2") {
    throw new OfficeRuntimeReadError(403, "MFA verification required");
  }

  const target = new URL("/api/v1/" + normalized, origin);
  let response: Response;
  try {
    response = await fetch(target, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${session.session.access_token}`,
        "X-Kravia-Gateway": "server-runtime-read",
      },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    throw new OfficeRuntimeReadError(502, "KRAVIA Office runtime is unavailable");
  }

  if (response.status >= 300 && response.status < 400) {
    throw new OfficeRuntimeReadError(502, "Unexpected Office runtime redirect");
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body && typeof body === "object" && typeof (body as Record<string, unknown>).detail === "string"
      ? String((body as Record<string, unknown>).detail)
      : "Canonical Office runtime request failed";
    throw new OfficeRuntimeReadError(response.status, detail);
  }
  return body as T;
}

export async function readOfficeRuntimeResult<T>(path: string): Promise<{
  data: T | null;
  error: { message: string; status: number } | null;
}> {
  try {
    return { data: await readOfficeRuntime<T>(path), error: null };
  } catch (error) {
    if (error instanceof OfficeRuntimeReadError) {
      return { data: null, error: { message: error.message, status: error.status } };
    }
    return { data: null, error: { message: "Canonical Office runtime request failed", status: 502 } };
  }
}
