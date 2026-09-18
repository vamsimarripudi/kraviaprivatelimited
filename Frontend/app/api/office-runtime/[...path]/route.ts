import { NextRequest, NextResponse } from "next/server";
import { getOfficeRuntimeOrigin } from "@/lib/env/office";
import { getOfficeSessionContext, officeIdentityIsProvisioned } from "@/lib/office/auth-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ROOTS = new Set([
  "command-center",
  "products",
  "customers",
  "commercial",
  "invoices",
  "payments",
  "receipts",
  "credit-notes",
  "refunds",
  "settlements",
  "tax",
  "accounting",
  "banking",
  "ownership",
  "finance",
  "governance",
  "compliance",
  "registrations",
  "documents",
  "contracts",
  "vendors",
  "people",
  "assets",
  "notices",
  "inspections",
  "approvals",
  "integrations",
  "operations",
  "audit",
]);

const BLOCKED_PREFIXES = ["finance/webhooks", "auth", "public"];
const FORWARDED_REQUEST_HEADERS = new Set([
  "accept",
  "content-type",
  "if-match",
  "if-none-match",
  "idempotency-key",
  "x-idempotency-key",
]);
const FORWARDED_RESPONSE_HEADERS = new Set([
  "content-type",
  "content-disposition",
  "etag",
  "last-modified",
]);
const MAX_BODY_BYTES = 26 * 1024 * 1024;

function normalizedPath(segments: string[]) {
  if (!segments.length) return null;
  const decoded = segments.map((segment) => decodeURIComponent(segment));
  if (decoded.some((segment) => !segment || segment === "." || segment === ".." || segment.includes("/") || segment.includes("\\"))) return null;
  const path = decoded.join("/");
  const root = decoded[0];
  if (!ALLOWED_ROOTS.has(root)) return null;
  if (BLOCKED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return null;
  return path;
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  if (!officeMutationIsSameOrigin(request)) {
    return NextResponse.json({ detail: "Cross-origin Office mutation is not allowed" }, { status: 403 });
  }

  const origin = getOfficeRuntimeOrigin();
  if (!origin) {
    return NextResponse.json({ detail: "KRAVIA Office runtime is not activated on this deployment" }, { status: 503 });
  }

  const session = await getOfficeSessionContext();
  if (!session || !officeIdentityIsProvisioned(session.identity)) {
    return NextResponse.json({ detail: "Office sign-in required" }, { status: 401 });
  }
  if (session.identity.aal !== "aal2") {
    return NextResponse.json({ detail: "MFA verification required" }, { status: 403 });
  }

  const { path: segments } = await context.params;
  const path = normalizedPath(segments);
  if (!path) return NextResponse.json({ detail: "Office runtime route is not permitted" }, { status: 404 });

  const target = new URL(`/api/v1/${path}`, origin);
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.append(key, value));

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (FORWARDED_REQUEST_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });
  headers.set("Authorization", `Bearer ${session.session.access_token}`);
  headers.set("X-Kravia-Gateway", "path-workspace-bff");

  let body: ArrayBuffer | undefined;
  if (!["GET", "HEAD"].includes(request.method)) {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ detail: "Request body exceeds the Office gateway limit" }, { status: 413 });
    }
    body = await request.arrayBuffer();
    if (body.byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ detail: "Request body exceeds the Office gateway limit" }, { status: 413 });
    }
  }

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });

    // Never follow a runtime redirect, which would weaken the fixed-origin SSRF boundary.
    if (upstream.status >= 300 && upstream.status < 400) {
      return NextResponse.json({ detail: "Unexpected Office runtime redirect" }, { status: 502 });
    }

    const responseHeaders = new Headers({ "Cache-Control": "no-store" });
    upstream.headers.forEach((value, key) => {
      if (FORWARDED_RESPONSE_HEADERS.has(key.toLowerCase())) responseHeaders.set(key, value);
    });
    return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return NextResponse.json({ detail: "KRAVIA Office runtime is unavailable" }, { status: 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
