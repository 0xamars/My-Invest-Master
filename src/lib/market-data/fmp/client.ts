import { FMP_API_BASE, getFmpApiKey } from "@/lib/market-data/config";

export class FmpConfigError extends Error {
  constructor(message = "FMP_API_KEY is not configured") {
    super(message);
    this.name = "FmpConfigError";
  }
}

export class FmpRequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "FmpRequestError";
    this.status = status;
  }
}

type FmpFetchOptions = {
  /**
   * Stable path, e.g. "/quote" or "/profile".
   * Symbol and other params go in `query`.
   */
  path: string;
  query?: Record<string, string | number | undefined | null>;
  /**
   * Desired freshness in seconds.
   * Filings/ratios: 3600+. Quotes: ~30.
   * Process memory cache honors this (capped at 6h).
   */
  revalidate?: number;
};

type CacheEntry = {
  expiresAt: number;
  data: unknown;
};

/** Process-level cache — collapses duplicate calls within/across page loads. */
const memoryCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

/** Soft circuit breaker after HTTP 429. */
let rateLimitedUntil = 0;

/** Max memory-cache TTL (filings stay warm across Analysis navigations). */
const MAX_MEMORY_TTL_MS = 6 * 60 * 60_000;
const MAX_CACHE_ENTRIES = 500;

export type FmpCallCategory =
  | "quote"
  | "profile"
  | "income"
  | "balance"
  | "cashflow"
  | "ratios"
  | "key_metrics"
  | "scores"
  | "historical"
  | "intraday"
  | "other";

export type FmpCallStats = {
  label: string;
  startedAt: number;
  networkCalls: number;
  cacheHits: number;
  coalesced: number;
  byCategory: Partial<Record<FmpCallCategory, number>>;
  paths: string[];
};

type CallScope = FmpCallStats;

const scopeStack: CallScope[] = [];

function categorize(path: string): FmpCallCategory {
  const p = path.toLowerCase();
  if (p.includes("quote")) return "quote";
  if (p.includes("profile")) return "profile";
  if (p.includes("income-statement")) return "income";
  if (p.includes("balance-sheet")) return "balance";
  if (p.includes("cash-flow") || p.includes("cashflow")) return "cashflow";
  if (p.includes("key-metrics")) return "key_metrics";
  if (p.includes("ratio")) return "ratios";
  if (p.includes("financial-score") || p.includes("score")) return "scores";
  if (p.includes("historical-chart") || p.includes("1hour")) return "intraday";
  if (p.includes("historical")) return "historical";
  return "other";
}

function record(
  kind: "network" | "cache" | "coalesced",
  path: string,
): void {
  const scope = scopeStack[scopeStack.length - 1];
  if (!scope) return;
  const cat = categorize(path);
  if (kind === "network") {
    scope.networkCalls += 1;
    scope.byCategory[cat] = (scope.byCategory[cat] ?? 0) + 1;
    if (scope.paths.length < 40) scope.paths.push(path);
  } else if (kind === "cache") {
    scope.cacheHits += 1;
  } else {
    scope.coalesced += 1;
  }
}

/**
 * Begin a scoped call counter (e.g. one Analysis page load).
 * Nestable; always pair with endFmpCallScope / runWithFmpCallScope.
 */
export function beginFmpCallScope(label: string): FmpCallStats {
  const scope: CallScope = {
    label,
    startedAt: Date.now(),
    networkCalls: 0,
    cacheHits: 0,
    coalesced: 0,
    byCategory: {},
    paths: [],
  };
  scopeStack.push(scope);
  return scope;
}

export function endFmpCallScope(): FmpCallStats | null {
  const scope = scopeStack.pop() ?? null;
  if (scope && process.env.NODE_ENV === "development") {
    const ms = Date.now() - scope.startedAt;
    console.info(
      `[FMP] ${scope.label} · network=${scope.networkCalls} cacheHits=${scope.cacheHits} coalesced=${scope.coalesced} (${ms}ms)`,
      scope.byCategory,
    );
  }
  return scope;
}

export async function runWithFmpCallScope<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<{ result: T; stats: FmpCallStats }> {
  const scope = beginFmpCallScope(label);
  try {
    const result = await fn();
    return { result, stats: scope };
  } finally {
    endFmpCallScope();
  }
}

export function isFmpRateLimited(): boolean {
  return Date.now() < rateLimitedUntil;
}

export function markFmpRateLimited(ms = 60_000): void {
  rateLimitedUntil = Math.max(rateLimitedUntil, Date.now() + ms);
}

function cacheKey(path: string, query: Record<string, string>): string {
  const q = Object.keys(query)
    .sort()
    .map((k) => `${k}=${query[k]}`)
    .join("&");
  return `${path}?${q}`;
}

function pruneCache(): void {
  if (memoryCache.size <= MAX_CACHE_ENTRIES) return;
  const now = Date.now();
  for (const [k, v] of memoryCache) {
    if (v.expiresAt <= now) memoryCache.delete(k);
  }
  if (memoryCache.size <= MAX_CACHE_ENTRIES) return;
  // Drop oldest half of remaining entries
  const keys = [...memoryCache.keys()];
  const drop = Math.ceil(keys.length / 2);
  for (let i = 0; i < drop; i++) {
    memoryCache.delete(keys[i]!);
  }
}

function hasFmpErrorPayload(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  const msg =
    (typeof obj["Error Message"] === "string" && obj["Error Message"]) ||
    (typeof obj["error"] === "string" && obj["error"]) ||
    (typeof obj["message"] === "string" &&
      /invalid|limit|denied|unauthorized|too many/i.test(obj["message"]) &&
      obj["message"]) ||
    null;
  return msg;
}

/**
 * Low-level FMP GET helper. Server-side only (uses FMP_API_KEY).
 * Targets the stable API: https://financialmodelingprep.com/stable/...
 *
 * Features:
 * - In-flight coalescing for identical path+query
 * - Process memory cache with TTL matching revalidate (up to 6h)
 * - Soft 429 circuit breaker
 * - Dev call-scope accounting
 */
export async function fmpFetch<T>(options: FmpFetchOptions): Promise<T> {
  const apiKey = getFmpApiKey();
  if (!apiKey) {
    throw new FmpConfigError();
  }

  if (isFmpRateLimited()) {
    throw new FmpRequestError(
      `FMP rate limited — retry after ${Math.ceil((rateLimitedUntil - Date.now()) / 1000)}s`,
      429,
    );
  }

  const base = FMP_API_BASE.replace(/\/$/, "");
  const path = options.path.startsWith("/") ? options.path : `/${options.path}`;
  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value == null || value === "") continue;
    query[key] = String(value);
  }

  const key = cacheKey(path, query);
  const cached = memoryCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    record("cache", path);
    return cached.data as T;
  }

  const existing = inflight.get(key);
  if (existing) {
    record("coalesced", path);
    return existing as Promise<T>;
  }

  const revalidateSec = options.revalidate ?? 300;
  const ttlMs = Math.min(Math.max(revalidateSec, 1) * 1000, MAX_MEMORY_TTL_MS);

  const run = (async () => {
    const url = new URL(`${base}${path}`);
    url.searchParams.set("apikey", apiKey);
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, v);
    }

    record("network", path);

    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: revalidateSec },
    });

    if (response.status === 429) {
      markFmpRateLimited(90_000);
      throw new FmpRequestError(
        `FMP request failed (429) for ${options.path}`,
        429,
      );
    }

    if (!response.ok) {
      throw new FmpRequestError(
        `FMP request failed (${response.status}) for ${options.path}`,
        response.status,
      );
    }

    const data = (await response.json()) as T;
    const errMsg = hasFmpErrorPayload(data);
    if (errMsg) {
      if (/limit|too many|429/i.test(errMsg)) {
        markFmpRateLimited(90_000);
      }
      throw new FmpRequestError(`FMP error for ${options.path}: ${errMsg}`, 400);
    }

    memoryCache.set(key, { data, expiresAt: Date.now() + ttlMs });
    pruneCache();
    return data;
  })();

  inflight.set(key, run);
  try {
    return (await run) as T;
  } finally {
    inflight.delete(key);
  }
}

export function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
