import { createHash } from "node:crypto";
import { resolveAiFeature } from "@/lib/ai/config";
import { NARRATIVE_PROMPT_VERSION } from "@/lib/ai/prompts/narrative-bundle";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AnalysisNarrativeBundle,
  NarrativeContext,
  NarrativeResponse,
} from "@/lib/analysis/narrative/types";

const MEMORY_TTL_MS = 18 * 60 * 60_000;
const DB_TTL_MS = 24 * 60 * 60_000;

type MemEntry = {
  bundle: AnalysisNarrativeBundle;
  expiresAt: number;
  model: string;
};

const memory = new Map<string, MemEntry>();
const inflight = new Map<string, Promise<NarrativeResponse>>();

export function narrativeCacheKey(ctx: NarrativeContext): string {
  const day = new Date().toISOString().slice(0, 10);
  const resolved = resolveAiFeature("analysis.narrative_bundle");
  const payload = {
    feature: "analysis.narrative_bundle" as const,
    s: ctx.symbol,
    day,
    model: resolved.config.model,
    prompt: NARRATIVE_PROMPT_VERSION,
    d: (ctx.description ?? "").slice(0, 64),
    o: ctx.scores.overall,
    f: ctx.scores.fundamental,
    t: ctx.scores.technical,
    fs: ctx.scores.financialStrength,
    p: ctx.scores.profitability,
    g: ctx.scores.growth,
    v: ctx.scores.valuation,
    zone: ctx.technical.zoneLabel,
    period: ctx.period,
    ev: (ctx.recentEvents ?? []).map((e) => `${e.type}:${e.date ?? ""}`).join("|"),
    sbc: ctx.sbcBurden,
    vl: ctx.valuationLanguage?.basis ?? "current",
    st:
      ctx.streetTarget?.average != null
        ? Math.round(ctx.streetTarget.average)
        : null,
  };
  const hash = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 16);
  return `analysis.narrative_bundle:${resolved.config.model}:${ctx.symbol}:${day}:${hash}`;
}

export function getNarrativeInflight(
  key: string,
): Promise<NarrativeResponse> | undefined {
  return inflight.get(key);
}

export function setNarrativeInflight(
  key: string,
  run: Promise<NarrativeResponse>,
): void {
  inflight.set(key, run);
  void run.finally(() => inflight.delete(key));
}

export function readNarrativeMemory(
  key: string,
): MemEntry | null {
  const hit = memory.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    memory.delete(key);
    return null;
  }
  return hit;
}

export function writeNarrativeMemory(
  key: string,
  bundle: AnalysisNarrativeBundle,
  model: string,
): void {
  memory.set(key, {
    bundle,
    model,
    expiresAt: Date.now() + MEMORY_TTL_MS,
  });
  if (memory.size > 200) {
    const first = memory.keys().next().value;
    if (first) memory.delete(first);
  }
}

export async function readNarrativeDb(
  key: string,
): Promise<MemEntry | null> {
  const sb = createAdminClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from("analysis_narrative_cache")
    .select("bundle, model, expires_at")
    .eq("cache_key", key)
    .maybeSingle();
  if (error || !data) {
    if (error && process.env.NODE_ENV === "development") {
      console.warn("[narrative-cache] read skipped:", error.message);
    }
    return null;
  }
  const expiresAt = Date.parse(String(data.expires_at));
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  const bundle = data.bundle as AnalysisNarrativeBundle;
  if (!bundle || typeof bundle !== "object") return null;
  return {
    bundle,
    model: typeof data.model === "string" ? data.model : "",
    expiresAt,
  };
}

export async function writeNarrativeDb(input: {
  key: string;
  symbol: string;
  model: string;
  bundle: AnalysisNarrativeBundle;
}): Promise<void> {
  const sb = createAdminClient();
  if (!sb) return;
  const now = new Date();
  const { error } = await sb.from("analysis_narrative_cache").upsert(
    {
      cache_key: input.key,
      symbol: input.symbol,
      model: input.model,
      bundle: input.bundle,
      created_at: now.toISOString(),
      expires_at: new Date(now.getTime() + DB_TTL_MS).toISOString(),
    },
    { onConflict: "cache_key" },
  );
  if (error && process.env.NODE_ENV === "development") {
    console.warn("[narrative-cache] write skipped:", error.message);
  }
}
