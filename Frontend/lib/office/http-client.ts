"use client";

type QueryValue = string | number | boolean | null | undefined;
type QueryParams = Record<string, QueryValue | readonly QueryValue[]>;

type CacheEntry = {
  value: unknown;
  expiresAt: number;
};

const responseCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();
const DEFAULT_STALE_MS = 8_000;

export class OfficeHttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OfficeHttpError";
  }
}

function buildUrl(path: string, query?: QueryParams) {
  const url = new URL(path, window.location.origin);
  if (!query) return url.pathname + url.search;
  for (const [key, raw] of Object.entries(query)) {
    const values = Array.isArray(raw) ? raw : [raw];
    for (const value of values) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.append(key, String(value));
    }
  }
  return url.pathname + url.search;
}

async function parse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await response.json().catch(() => ({}))
    : await response.text().catch(() => "");
  if (!response.ok) {
    const detail =
      body && typeof body === "object" && "detail" in body && typeof body.detail === "string"
        ? body.detail
        : typeof body === "string" && body
          ? body
          : "KRAVIA Office request failed";
    throw new OfficeHttpError(response.status, detail);
  }
  return body as T;
}

export function invalidateOfficeQueries(prefix = "/api/") {
  for (const key of responseCache.keys()) {
    if (key.startsWith(prefix)) responseCache.delete(key);
  }
}

export async function officeQuery<T>(
  path: string,
  query?: QueryParams,
  options: { staleMs?: number; signal?: AbortSignal; force?: boolean } = {},
): Promise<T> {
  const url = buildUrl(path, query);
  const staleMs = Math.max(0, options.staleMs ?? DEFAULT_STALE_MS);
  const now = Date.now();
  const cached = responseCache.get(url);
  if (!options.force && cached && cached.expiresAt > now) return cached.value as T;

  const existing = inFlight.get(url);
  if (!options.force && existing) return existing as Promise<T>;

  const request = fetch(url, {
    method: "GET",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: options.signal,
  })
    .then(parse<T>)
    .then((value) => {
      responseCache.set(url, { value, expiresAt: Date.now() + staleMs });
      return value;
    })
    .finally(() => {
      inFlight.delete(url);
    });

  inFlight.set(url, request);
  return request;
}

export async function officeMutation<T>(
  path: string,
  options: {
    method?: "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    headers?: HeadersInit;
    invalidate?: string | readonly string[];
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const response = await fetch(path, {
    method: options.method ?? "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(options.headers ?? {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
    signal: options.signal,
  });
  const value = await parse<T>(response);
  const prefixes = Array.isArray(options.invalidate)
    ? options.invalidate
    : [options.invalidate ?? path.split("?")[0]];
  for (const prefix of prefixes) if (prefix) invalidateOfficeQueries(prefix);
  return value;
}

export function prewarmOfficeQuery<T>(path: string, query?: QueryParams, staleMs = DEFAULT_STALE_MS) {
  if (typeof window === "undefined") return;
  void officeQuery<T>(path, query, { staleMs }).catch(() => undefined);
}
