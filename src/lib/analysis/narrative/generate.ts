import { complete, isAiConfigured } from "@/lib/ai";
import { getNarrativeTimeoutMs, resolveAiFeature } from "@/lib/ai/config";
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
  hasBannedProfitWording,
  hasSoftenedLosses,
  parseNarrativeBundle,
  stripUnhookedSectorGenericItems,
} from "@/lib/analysis/narrative/parse";
import { fillMissingOutlookThemes } from "@/lib/analysis/narrative/outlook-fallback";
import { stripForeignOutlookItems } from "@/lib/analysis/narrative/outlook-lock";
import type {
  AnalysisNarrativeBundle,
  NarrativeContext,
  NarrativeCopyLanguage,
  NarrativePackageFact,
  NarrativeResponse,
} from "@/lib/analysis/narrative/types";

const UNKNOWN_COPY: NarrativeCopyLanguage = {
  earnings: "unknown",
  cash: "unknown",
  margins: "unknown",
  growth: "unknown",
  balanceSheet: "unknown",
  valuationConstraint: "unknown",
};

function sanitizeCopyLanguage(raw: unknown): NarrativeCopyLanguage {
  if (!raw || typeof raw !== "object") return { ...UNKNOWN_COPY };
  const o = raw as Record<string, unknown>;
  const pick = <T extends string>(
    value: unknown,
    allowed: readonly T[],
  ): T | "unknown" =>
    typeof value === "string" && (allowed as readonly string[]).includes(value)
      ? (value as T)
      : "unknown";
  return {
    earnings: pick(o.earnings, ["unprofitable", "profitable", "treasury_marks"]),
    cash: pick(o.cash, ["burning", "converting"]),
    margins: pick(o.margins, ["strong", "compressed"]),
    growth: pick(o.growth, ["elite", "solid", "slow"]),
    balanceSheet: pick(o.balanceSheet, ["fortress", "adequate", "weak"]),
    valuationConstraint: pick(o.valuationConstraint, [
      "expensive",
      "full",
      "not_the_story",
    ]),
  };
}

function sanitizePackageFacts(raw: unknown): NarrativePackageFact[] {
  if (!Array.isArray(raw)) return [];
  const out: NarrativePackageFact[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as { id?: unknown; label?: unknown; display?: unknown };
    const id = typeof o.id === "string" ? o.id.trim().slice(0, 48) : "";
    const label = typeof o.label === "string" ? o.label.trim().slice(0, 64) : "";
    const display =
      typeof o.display === "string" ? o.display.trim().slice(0, 24) : "";
    if (!id || !label || !display) continue;
    out.push({ id, label, display });
    if (out.length >= 16) break;
  }
  return out;
}

function logCacheHit(model: string, source: "AI_FEATURES" | "ENV_OVERRIDE"): void {
  logAiEvent({
    feature: "analysis.narrative_bundle",
    provider: "openrouter",
    model,
    source,
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
  if (hasBannedProfitWording(bundle)) return true;
  if (hasSoftenedLosses(bundle, ctx.copyLanguage)) return true;
  if (
    hasInaccurateValuationLanguage(
      bundle,
      ctx.valuationLanguage?.basis ?? "current",
    )
  ) {
    return true;
  }
  if (isOutlookShallow(bundle, ctx)) return true;
  return false;
}

async function callBundle(
  ctx: NarrativeContext,
  system: string,
  timeoutMs: number,
): Promise<AnalysisNarrativeBundle | null> {
  if (timeoutMs < 1500) return null;
  const result = await complete({
    feature: "analysis.narrative_bundle",
    system,
    timeoutMs,
    messages: [
      {
        role: "user",
        content: buildNarrativeUserMessage(toNarrativePromptSnapshot(ctx)),
      },
    ],
  });
  return parseNarrativeBundle(result.text);
}

function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (/timed out/i.test(error.message) ||
      ("status" in error && (error as { status?: number }).status === 504))
  );
}

async function generateFresh(
  ctx: NarrativeContext,
): Promise<{ bundle: AnalysisNarrativeBundle; ok: boolean; error: string | null }> {
  const budgetMs = getNarrativeTimeoutMs();
  const deadline = Date.now() + budgetMs;
  const remaining = () => Math.max(0, deadline - Date.now());

  try {
    let parsed = await callBundle(ctx, NARRATIVE_BUNDLE_SYSTEM, remaining());
    // Same-model copy rewrite only. Never switch models. Skip if the budget
    // cannot finish another flagship call; keep the first draft on retry timeout.
    if (parsed && needsRewrite(parsed, ctx) && remaining() >= 45_000) {
      try {
        const retry = await callBundle(
          ctx,
          NARRATIVE_BUNDLE_RETRY_SYSTEM,
          remaining(),
        );
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
        }
      } catch (error) {
        if (!isTimeoutError(error)) throw error;
      }
    }
    if (!parsed) {
      logAiFallback("analysis.narrative_bundle", "empty");
      return {
        ok: false,
        error: "incomplete",
        bundle: fallbackNarrativeBundle(
          "Narrative text was incomplete. Scores above are unchanged.",
          ctx,
        ),
      };
    }
    parsed = ensureOutlookCoverage(parsed, ctx);
    return { ok: true, bundle: parsed, error: null };
  } catch (error) {
    if (isTimeoutError(error)) {
      return {
        ok: false,
        error: "timeout",
        bundle: fallbackNarrativeBundle(
          "Narrative timed out. Scores above are unchanged.",
          ctx,
        ),
      };
    }
    throw error;
  }
}

function sanitizeOutlook(
  outlook: AnalysisNarrativeBundle["futureOutlook"],
  ctx: NarrativeContext,
): AnalysisNarrativeBundle["futureOutlook"] {
  const stripped = stripUnhookedSectorGenericItems(
    stripForeignOutlookItems(outlook, ctx),
    ctx,
  );
  const filled = fillMissingOutlookThemes(stripped, ctx);
  return {
    opportunities: filled.opportunities,
    risks: filled.risks,
  };
}

function ensureOutlookCoverage(
  bundle: AnalysisNarrativeBundle,
  ctx: NarrativeContext,
): AnalysisNarrativeBundle {
  return {
    ...bundle,
    futureOutlook: sanitizeOutlook(bundle.futureOutlook, ctx),
  };
}

function coverBundle(
  bundle: AnalysisNarrativeBundle,
  ctx: NarrativeContext,
): AnalysisNarrativeBundle {
  return {
    ...bundle,
    futureOutlook: sanitizeOutlook(bundle.futureOutlook, ctx),
  };
}

export async function getNarrativeBundle(
  raw: NarrativeContext,
): Promise<NarrativeResponse> {
  const ctx: NarrativeContext = {
    ...raw,
    recentEvents: Array.isArray(raw.recentEvents) ? raw.recentEvents : [],
    packageFacts: sanitizePackageFacts(raw.packageFacts),
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
    copyLanguage: sanitizeCopyLanguage(raw.copyLanguage),
  };
  const resolved = resolveAiFeature("analysis.narrative_bundle");
  const model = resolved.config.model;
  const key = narrativeCacheKey(ctx);
  const configured = isAiConfigured();

  const asResponse = (
    bundle: AnalysisNarrativeBundle,
    source: NarrativeResponse["source"],
    usedModel: string | null,
    error: string | null = null,
  ): NarrativeResponse => ({
    bundle: coverBundle(bundle, ctx),
    source,
    configured,
    model: usedModel,
    error,
  });

  const mem = readNarrativeMemory(key);
  if (mem) {
    logCacheHit(mem.model || model, resolved.source);
    return asResponse(mem.bundle, "cache", mem.model || model);
  }

  const existing = getNarrativeInflight(key);
  if (existing) {
    const shared = await existing;
    return asResponse(shared.bundle, shared.source, shared.model, shared.error ?? null);
  }

  const run = (async (): Promise<NarrativeResponse> => {
    const db = await readNarrativeDb(key);
    if (db) {
      writeNarrativeMemory(key, db.bundle, db.model || model);
      logCacheHit(db.model || model, resolved.source);
      return {
        bundle: db.bundle,
        source: "cache",
        configured,
        model: db.model || model,
        error: null,
      };
    }

    if (!configured) {
      logAiFallback("analysis.narrative_bundle", "no_key");
      return {
        bundle: fallbackNarrativeBundle(
          "AI not configured. Scores above are unchanged.",
          ctx,
        ),
        source: "fallback",
        configured: false,
        model: null,
        error: "not_configured",
      };
    }

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
      return {
        bundle: fresh.bundle,
        source: fresh.ok ? "ai" : "fallback",
        configured: true,
        model,
        error: fresh.error,
      };
    } catch {
      logAiFallback("analysis.narrative_bundle", "error");
      return {
        bundle: fallbackNarrativeBundle(
          "Narrative unavailable right now. Scores above are unchanged.",
          ctx,
        ),
        source: "fallback",
        configured: true,
        model,
        error: "unavailable",
      };
    }
  })();

  setNarrativeInflight(key, run);
  const result = await run;
  return asResponse(result.bundle, result.source, result.model, result.error ?? null);
}
