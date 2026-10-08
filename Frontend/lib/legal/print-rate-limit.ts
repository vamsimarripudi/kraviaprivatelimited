import { createHash } from "node:crypto";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 12;
const MAX_TRACKED_CLIENTS = 5_000;

type Window = { openedAt: number; count: number };

const windows = new Map<string, Window>();

function prune(now: number) {
  if (windows.size < MAX_TRACKED_CLIENTS) return;
  for (const [key, window] of windows) {
    if (now - window.openedAt >= WINDOW_MS) windows.delete(key);
  }
  while (windows.size >= MAX_TRACKED_CLIENTS) {
    const oldestKey = windows.keys().next().value;
    if (!oldestKey) return;
    windows.delete(oldestKey);
  }
}

export function legalPrintRateLimitKey(identity: string, userAgent: string | null): string {
  return createHash("sha256").update(`${identity}\n${userAgent ?? ""}`).digest("hex");
}

/**
 * A bounded per-instance safety valve. It intentionally does not treat the
 * browser fingerprint as a durable record or personal-data store.
 */
export function consumeLegalPrintRateLimit(key: string, now = Date.now()): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  prune(now);
  const existing = windows.get(key);
  if (!existing || now - existing.openedAt >= WINDOW_MS) {
    windows.set(key, { openedAt: now, count: 1 });
    return { allowed: true };
  }
  if (existing.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((WINDOW_MS - (now - existing.openedAt)) / 1000)) };
  }
  existing.count += 1;
  return { allowed: true };
}
