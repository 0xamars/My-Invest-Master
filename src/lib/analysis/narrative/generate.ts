import { complete, getAiFeatureConfig, isAiConfigured } from "@/lib/ai";
import { logAiEvent, logAiFallback } from "@/lib/ai/log";
import {
  buildNarrativeUserMessage,
  NARRATIVE_BUNDLE_RETRY_SYSTEM,
  NARRATIVE_BUNDLE_SYSTEM,
} from "@/lib/ai/prompts/narrative-bundle";
import { toNarrativePromptSnapshot } from "@/lib/analysis/narrative/context";
import {
  getNarrativeInflight,
  narrativeCacheKey,
  readNarrativeDb,
  readNarrativeMemory,
  setNarrativeInflight,
  writeNarrativeDb,
  writeNarrativeMemory,
} from "@/lib/analysis/narrative/cache";
import {
  fallbackNarrativeBundle,
  hasTradeAdvice,
  hasInaccurateValuationLanguage,
  inventsUnlistedEvents,
  isGenericTemplate,
  isJargonHeavy,
  isOutlookShallow,
  isRecitationHeavy,
  isSummaryShallow,
  isWikiOverview,
  parseNarrativeBundle,
} from "@/lib/analysis/narrative/parse";
import type {
  AnalysisNarrativeBundle,
  NarrativeContext,
  NarrativeResponse,
} from "@/lib/analysis/narrative/types";

function logCacheHit(model: string): void {
  logAiEvent({
    feature: "analysis.narrative_bundle",
    provider: "openrouter",
    model,
    status: "cache_hit",
  });
}

function needsRewrite(
  bundle: AnalysisNarrativeBundle,
  ctx: NarrativeContext,
): boolean {
  if (isRecitationHeavy(bundle)) return true;
  if (isJargonHeavy(bundle)) return true;
  if (hasTradeAdvice(bundle)) return true;
  if (isSummaryShallow(bundle)) return true;
  if (
    isGenericTemplate(bundle, {
      name: ctx.name,
      industry: ctx.industry,
      symbol: ctx.symbol,
    })
  ) {
    return true;
  }
  if (inventsUnlistedEvents(bundle, ctx.recentEvents ?? [])) return true;
  if (isWikiOverview(bundle.fundamentalOverview)) return true;
  if (
    hasInaccurateValuationLanguage(
      bundle,
      ctx.valuationLanguage?.basis ?? "current",
    )
  ) {
    return true;
  }
  if (isOutlookShallow(bundle, ctx)) return true;
  if (bundle.futureOutlook.opportunities.length === 0) return true;
  return false;
}

async function callBundle(
  ctx: NarrativeContext,
  system: string,
): Promise<AnalysisNarrativeBundle | null> {
  const result = await complete({
    feature: "analysis.narrative_bundle",
    system,
    messages: [
      {
        role: "user",
        content: buildNarrativeUserMessage(toNarrativePromptSnapshot(ctx)),
      },
    ],
  });
  return parseNarrativeBundle(result.text);
}

async function generateFresh(
  ctx: NarrativeContext,
): Promise<{ bundle: AnalysisNarrativeBundle; ok: boolean }> {
  let parsed = await callBundle(ctx, NARRATIVE_BUNDLE_SYSTEM);
  if (parsed && needsRewrite(parsed, ctx)) {
    const retry = await callBundle(ctx, NARRATIVE_BUNDLE_RETRY_SYSTEM);
    const ident = {
      name: ctx.name,
      industry: ctx.industry,
      symbol: ctx.symbol,
    };
    if (retry && !needsRewrite(retry, ctx)) parsed = retry;
    else if (
      retry &&
      isGenericTemplate(parsed, ident) &&
      !isGenericTemplate(retry, ident) &&
      !hasTradeAdvice(retry)
    ) {
      parsed = retry;
    } else if (
      retry &&
      retry.futureOutlook.opportunities.length >
        parsed.futureOutlook.opportunities.length
    ) {
      parsed = retry;
    }
  }
  if (!parsed) {
    logAiFallback("analysis.narrative_bundle", "empty");
    return {
      ok: false,
      bundle: fallbackNarrativeBundle(
        "Narrative text was incomplete. Scores above are unchanged.",
      ),
    };
  }
  return { ok: true, bundle: parsed };
}

export async function getNarrativeBundle(
  raw: NarrativeContext,
): Promise<NarrativeResponse> {
  const ctx: NarrativeContext = {
    ...raw,
    recentEvents: Array.isArray(raw.recentEvents) ? raw.recentEvents : [],
    sbcBurden: raw.sbcBurden ?? null,
    valuationLanguage: {
      basis: raw.valuationLanguage?.basis === "includes_forward"
        ? "includes_forward"
        : "current",
    },
    streetTarget:
      raw.streetTarget &&
      typeof raw.streetTarget.average === "number" &&
      Number.isFinite(raw.streetTarget.average) &&
      raw.streetTarget.average > 0
        ? {
            average: raw.streetTarget.average,
            vsPricePct:
              typeof raw.streetTarget.vsPricePct === "number" &&
              Number.isFinite(raw.streetTarget.vsPricePct)
                ? raw.streetTarget.vsPricePct
                : null,
          }
        : null,
  };
  const model = getAiFeatureConfig("analysis.narrative_bundle").model;
  const key = narrativeCacheKey(ctx);

  const mem = readNarrativeMemory(key);
  if (mem) {
    logCacheHit(mem.model || model);
    return {
      bundle: mem.bundle,
      source: "cache",
      configured: isAiConfigured(),
      model: mem.model || model,
    };
  }

  const db = await readNarrativeDb(key);
  if (db) {
    writeNarrativeMemory(key, db.bundle, db.model || model);
    logCacheHit(db.model || model);
    return {
      bundle: db.bundle,
      source: "cache",
      configured: isAiConfigured(),
      model: db.model || model,
    };
  }

  if (!isAiConfigured()) {
    logAiFallback("analysis.narrative_bundle", "no_key");
    return {
      bundle: fallbackNarrativeBundle(
        "AI not configured. Scores above are unchanged.",
      ),
      source: "fallback",
      configured: false,
      model: null,
    };
  }

  const existing = getNarrativeInflight(key);
  const run =
    existing ??
    (async () => {
      try {
        const fresh = await generateFresh(ctx);
        if (fresh.ok) {
          writeNarrativeMemory(key, fresh.bundle, model);
          await writeNarrativeDb({
            key,
            symbol: ctx.symbol,
            model,
            bundle: fresh.bundle,
          });
        }
        return fresh.bundle;
      } catch {
        logAiFallback("analysis.narrative_bundle", "error");
        return fallbackNarrativeBundle(
          "Narrative unavailable right now. Scores above are unchanged.",
        );
      }
    })();

  if (!existing) setNarrativeInflight(key, run);

  const bundle = await run;
  const cached = readNarrativeMemory(key);
  return {
    bundle,
    source: cached ? "ai" : "fallback",
    configured: true,
    model,
  };
}
