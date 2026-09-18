import { createHash } from "node:crypto";
import { resolveAiFeature } from "@/lib/ai/config";
import { EARLY_OPP_PROMPT_VERSION } from "@/lib/ai/prompts/early-opp";
import type { EarlyOppQualitativeOverlay } from "@/lib/analysis/early-opp/types";

const MEMORY_TTL_MS = 18 * 60 * 60_000;

type MemEntry = {
  overlay: EarlyOppQualitativeOverlay;
  expiresAt: number;
  model: string;
};

const memory = new Map<string, MemEntry>();
const inflight = new Map<string, Promise<EarlyOppQualitativeOverlay | null>>();

export function earlyOppAiCacheKey(input: {
  symbol: string;
  factStamp: string;
}): string {
  const day = new Date().toISOString().slice(0, 10);
  const resolved = resolveAiFeature("analysis.early_opp");
  const payload = {
    feature: "analysis.early_opp" as const,
    s: input.symbol,
    day,
    model: resolved.config.model,
    prompt: EARLY_OPP_PROMPT_VERSION,
    f: input.factStamp,
  };
  const hash = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 16);
  return `analysis.early_opp:${resolved.config.model}:${input.symbol}:${day}:${hash}`;
}

export function getEarlyOppAiInflight(
  key: string,
): Promise<EarlyOppQualitativeOverlay | null> | undefined {
  return inflight.get(key);
}

export function setEarlyOppAiInflight(
  key: string,
  run: Promise<EarlyOppQualitativeOverlay | null>,
): void {
  inflight.set(key, run);
  void run.finally(() => inflight.delete(key));
}

export function readEarlyOppAiMemory(key: string): MemEntry | null {
  const hit = memory.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    memory.delete(key);
    return null;
  }
  return hit;
}

export function writeEarlyOppAiMemory(
  key: string,
  overlay: EarlyOppQualitativeOverlay,
  model: string,
): void {
  memory.set(key, {
    overlay,
    model,
    expiresAt: Date.now() + MEMORY_TTL_MS,
  });
  if (memory.size > 200) {
    const first = memory.keys().next().value;
    if (first) memory.delete(first);
  }
}
