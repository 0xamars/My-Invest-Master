/**
 * FMP display gate and market_cache cleanup decisions.
 *   npx tsx --tsconfig tsconfig.json scripts/test-fmp-display-gate-unit.mts
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  FMP_DISPLAY_UNAVAILABLE,
  apiFailureMessage,
  fmpDisplayAllowsEmail,
  isFmpDisplayGateEnabled,
  parseFmpDisplayAllowlist,
  uiErrorMessage,
} from "../src/lib/market-data/display-gate.ts";
import {
  MARKET_CACHE_PRUNE_DATASETS,
  MARKET_CACHE_PRUNE_INTERVAL_MS,
  MARKET_CACHE_PRUNE_MAX_AGE_MS,
  marketCachePruneCutoff,
  shouldPruneMarketCache,
} from "../src/lib/market-data/warehouse/cache-prune.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const allowlist = parseFmpDisplayAllowlist(
  " Allowed@Example.com , other@example.com ",
);

assert(isFmpDisplayGateEnabled({}) === false, "missing flag leaves the gate off");
assert(
  isFmpDisplayGateEnabled({ FMP_DISPLAY_GATE_ENABLED: "0" }) === false,
  "0 leaves the gate off",
);
assert(
  isFmpDisplayGateEnabled({ FMP_DISPLAY_GATE_ENABLED: "false" }) === false,
  "false leaves the gate off",
);
assert(
  isFmpDisplayGateEnabled({ FMP_DISPLAY_GATE_ENABLED: "1" }) === true,
  "1 turns the gate on",
);
assert(
  isFmpDisplayGateEnabled({ FMP_DISPLAY_GATE_ENABLED: " TRUE " }) === true,
  "true turns the gate on",
);

assert(
  fmpDisplayAllowsEmail(null, { enabled: false, allowlist }) === true,
  "gate off allows a signed-out visitor",
);
assert(
  fmpDisplayAllowsEmail("stranger@example.com", { enabled: false, allowlist }) ===
    true,
  "gate off allows any email",
);
assert(
  fmpDisplayAllowsEmail("allowed@example.com", {
    enabled: true,
    allowlist,
    emailConfirmed: true,
  }) === true,
  "gate on allows a confirmed allowlisted email",
);
assert(
  fmpDisplayAllowsEmail(" Allowed@Example.com ", {
    enabled: true,
    allowlist,
    emailConfirmed: true,
  }) === true,
  "allowlist compare ignores case and surrounding space",
);
assert(
  fmpDisplayAllowsEmail("allowed@example.com", {
    enabled: true,
    allowlist,
    emailConfirmed: false,
  }) === false,
  "gate on denies an unconfirmed allowlisted email",
);
assert(
  fmpDisplayAllowsEmail("stranger@example.com", {
    enabled: true,
    allowlist,
    emailConfirmed: true,
  }) === false,
  "gate on denies an email that is not listed",
);
assert(
  fmpDisplayAllowsEmail(null, { enabled: true, allowlist, emailConfirmed: true }) ===
    false,
  "gate on denies a missing email",
);
assert(
  fmpDisplayAllowsEmail("allowed@example.com", {
    enabled: true,
    allowlist: parseFmpDisplayAllowlist(""),
    emailConfirmed: true,
  }) === false,
  "gate on with an empty allowlist denies everyone",
);
assert(
  !FMP_DISPLAY_UNAVAILABLE.toLowerCase().includes("freedom"),
  "display copy says Retire, not a retired product name",
);

assert(
  apiFailureMessage(
    { prices: {}, error: FMP_DISPLAY_UNAVAILABLE },
    "Failed to fetch prices",
  ) === FMP_DISPLAY_UNAVAILABLE,
  "a 403 body keeps the display sentence",
);
assert(
  apiFailureMessage({ error: "Quote not found" }, "Failed to fetch prices") ===
    "Failed to fetch prices",
  "other API errors keep the existing fallback",
);
assert(
  uiErrorMessage(new Error(FMP_DISPLAY_UNAVAILABLE), "Unable to fetch prices.") ===
    FMP_DISPLAY_UNAVAILABLE,
  "the UI shows the display sentence when that is the failure",
);
assert(
  uiErrorMessage(new Error("Failed to fetch prices"), "Unable to fetch prices.") ===
    "Unable to fetch prices.",
  "the UI keeps its existing copy for other failures",
);

const now = Date.parse("2026-09-24T12:00:00.000Z");
assert(
  marketCachePruneCutoff(now) ===
    new Date(now - MARKET_CACHE_PRUNE_MAX_AGE_MS).toISOString(),
  "cleanup cutoff is 7 days before now",
);
assert(
  MARKET_CACHE_PRUNE_MAX_AGE_MS === 7 * 24 * 60 * 60 * 1000,
  "cleanup age is 7 days",
);
assert(shouldPruneMarketCache(null, now) === true, "the first write may clean up");
assert(
  shouldPruneMarketCache(now - 60_000, now) === false,
  "a recent cleanup is skipped",
);
assert(
  shouldPruneMarketCache(now - MARKET_CACHE_PRUNE_INTERVAL_MS, now) === true,
  "cleanup runs again after the interval",
);
assert(
  [...MARKET_CACHE_PRUNE_DATASETS].join(",") ===
    "symbol_search,news_stock,news_crypto,symbol_news",
  "cleanup covers search and news rows only",
);
const pruneDatasets: readonly string[] = MARKET_CACHE_PRUNE_DATASETS;
assert(
  !pruneDatasets.includes("quote") && !pruneDatasets.includes("price_daily"),
  "cleanup does not target quote or price history datasets",
);

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else if (/\.(ts|tsx)$/.test(entry)) files.push(path);
  }
  return files;
}

const marketCacheReaders = walk("src").filter((file) =>
  readFileSync(file, "utf8").includes('.from("market_cache")'),
);
assert(
  marketCacheReaders.length === 1 &&
    marketCacheReaders[0]?.endsWith("src/lib/market-data/warehouse/store.ts"),
  `only the warehouse store may query market_cache, found ${marketCacheReaders.join(", ")}`,
);
for (const file of walk("src")) {
  const text = readFileSync(file, "utf8");
  if (!text.includes('"use client"') && !text.includes("'use client'")) continue;
  assert(
    !text.includes("market_cache"),
    `${file} is client code and must not read market_cache`,
  );
}

const migration = readFileSync("supabase/migrations/015_market_cache.sql", "utf8");
assert(
  migration.includes("enable row level security"),
  "market_cache keeps RLS enabled",
);
assert(
  migration.includes('drop policy if exists "Public read market_cache"'),
  "migration drops a previously created public read policy",
);
assert(
  !/create policy/i.test(migration),
  "market_cache has no anon or authenticated policy",
);

console.log("fmp display gate unit tests passed");
