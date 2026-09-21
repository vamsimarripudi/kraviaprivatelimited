import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_BUCKETS = new Set([
  "office-quarantine",
  "corporate-private",
  "office-documents",
  "office-candidate-documents",
]);
const PUBLIC_KEY_B64 = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEZsjNzn15B7PpWi49zIBscmXvHWxjuWDouCKauXKnP5AbpQu9h5HD0KLEkDfhoX+eKZsdRyoNneJ1y+bsK8Whuw==";
const MAX_SKEW_SECONDS = 90;

function b64ToBytes(value: string): Uint8Array {
  const raw = atob(value);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
function safePath(path: string): boolean {
  return path.length > 0 &&
    path.length <= 1024 &&
    !path.startsWith("/") &&
    !path.includes("..") &&
    !path.includes("\\") &&
    path.split("/").every((part) => part.length > 0 && part.length <= 255);
}
async function verifyRequest(req: Request, rawBody: string): Promise<boolean> {
  const ts = req.headers.get("x-kravia-timestamp") ?? "";
  const sig = req.headers.get("x-kravia-signature") ?? "";
  if (!/^\d{10}$/.test(ts) || !sig) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(ts)) > MAX_SKEW_SECONDS) return false;
  try {
    const key = await crypto.subtle.importKey(
      "spki",
      b64ToBytes(PUBLIC_KEY_B64),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const payload = new TextEncoder().encode(ts + "." + rawBody);
    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      b64ToBytes(sig),
      payload,
    );
  } catch {
    return false;
  }
}
function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const modern = Deno.env.get("SUPABASE_SECRET_KEYS");
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  let secret = legacy ?? "";
  if (modern) {
    try {
      const parsed = JSON.parse(modern);
      if (typeof parsed.default === "string" && parsed.default) secret = parsed.default;
    } catch {}
  }
  if (!url || !secret) throw new Error("SUPABASE_ADMIN_KEY_UNAVAILABLE");
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return Response.json({ detail: "Method not allowed" }, { status: 405 });
  const rawBody = await req.text();
  if (!(await verifyRequest(req, rawBody))) {
    return Response.json({ detail: "Invalid KRAVIA broker signature" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = JSON.parse(rawBody || "{}"); }
  catch { return Response.json({ detail: "Invalid JSON body" }, { status: 400 }); }

  const action = String(body.action ?? "");
  if (action === "ping") {
    return Response.json({ ok: true, broker: "KRAVIA_STORAGE_BROKER", ts: new Date().toISOString() });
  }

  const bucket = String(body.bucket ?? "");
  const path = String(body.path ?? "");
  if (!ALLOWED_BUCKETS.has(bucket) || !safePath(path)) {
    return Response.json({ detail: "Invalid storage target" }, { status: 400 });
  }

  try {
    const supabase = adminClient();
    const storage = supabase.storage.from(bucket);

    if (action === "signed_upload") {
      const upsert = body.upsert === true;
      const { data, error } = await storage.createSignedUploadUrl(path, { upsert });
      if (error || !data?.token) throw error ?? new Error("SIGNED_UPLOAD_UNAVAILABLE");
      return Response.json({ token: data.token, path: data.path ?? path });
    }

    if (action === "signed_download") {
      const requested = Number(body.expires_in ?? 60);
      const expiresIn = Math.max(15, Math.min(Number.isFinite(requested) ? requested : 60, 300));
      const { data, error } = await storage.createSignedUrl(path, expiresIn, { download: false });
      if (error || !data?.signedUrl) throw error ?? new Error("SIGNED_DOWNLOAD_UNAVAILABLE");
      return Response.json({ url: data.signedUrl, expires_in: expiresIn });
    }

    if (action === "delete") {
      const { error } = await storage.remove([path]);
      if (error) throw error;
      return Response.json({ deleted: true });
    }

    return Response.json({ detail: "Unsupported action" }, { status: 400 });
  } catch (error) {
    const name = error instanceof Error ? error.name : "StorageBrokerError";
    return Response.json({ detail: "Storage broker operation failed", code: name }, { status: 502 });
  }
});
