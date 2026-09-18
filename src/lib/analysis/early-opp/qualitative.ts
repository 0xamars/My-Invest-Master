import { complete, isAiConfigured } from "@/lib/ai";
import { resolveAiFeature } from "@/lib/ai/config";
import { EARLY_OPP_SYSTEM } from "@/lib/ai/prompts/early-opp";
import type { EarlyOppFacts } from "@/lib/analysis/early-opp/facts";
import {
  earlyOppAiCacheKey,
  getEarlyOppAiInflight,
  readEarlyOppAiMemory,
  setEarlyOppAiInflight,
  writeEarlyOppAiMemory,
} from "@/lib/analysis/early-opp/cache";
import type {
  EarlyOppAiMeta,
  EarlyOppQualitativeOverlay,
  EarlyOppStatus,
} from "@/lib/analysis/early-opp/types";

const EMPTY_OVERLAY: EarlyOppQualitativeOverlay = {
  secularTheme: null,
  secularStatus: null,
  sCurveNote: null,
  stackRole: null,
  winnerNote: null,
  moatNote: null,
  moatCopyTest: null,
  whyMoving: null,
};

function factStamp(facts: EarlyOppFacts): string {
  return [
    facts.symbol,
    facts.industry ?? "",
    facts.sector ?? "",
    facts.revenueGrowth ?? "",
    facts.fcf ?? "",
    facts.roic ?? "",
    facts.changePercent ?? "",
    facts.ratingLabel ?? "",
    facts.insiderTone,
  ].join("|");
}

function asStatus(value: unknown): EarlyOppStatus | null {
  if (value === "pass" || value === "soft" || value === "fail" || value === "unknown") {
    return value;
  }
  return null;
}

function asCopyTest(
  value: unknown,
): EarlyOppQualitativeOverlay["moatCopyTest"] {
  if (value === "hard_to_copy" || value === "copyable" || value === "unclear") {
    return value;
  }
  return null;
}

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 600) return trimmed.slice(0, 600);
  return trimmed;
}

function parseOverlay(text: string): EarlyOppQualitativeOverlay | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const raw = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    return {
      secularTheme: asText(raw.secularTheme),
      secularStatus: asStatus(raw.secularStatus),
      sCurveNote: asText(raw.sCurveNote),
      stackRole: asText(raw.stackRole),
      winnerNote: asText(raw.winnerNote),
      moatNote: asText(raw.moatNote),
      moatCopyTest: asCopyTest(raw.moatCopyTest),
      whyMoving: asText(raw.whyMoving),
    };
  } catch {
    return null;
  }
}

function factsForPrompt(facts: EarlyOppFacts): Record<string, unknown> {
  return {
    symbol: facts.symbol,
    name: facts.name,
    sector: facts.sector,
    industry: facts.industry,
    description: facts.description?.slice(0, 400) ?? null,
    revenueGrowth: facts.revenueGrowth,
    revenueCagr3y: facts.revenueCagr3y,
    fcf: facts.fcf,
    fcfGrowth: facts.fcfGrowth,
    capexAbs: facts.capexAbs,
    capexRising: facts.capexRising,
    roic: facts.roic,
    pegRatio: facts.pegRatio,
    ratingLabel: facts.ratingLabel,
    changePercent: facts.changePercent,
    volumeVsAverage:
      facts.volume != null && facts.averageVolume != null && facts.averageVolume > 0
        ? facts.volume / facts.averageVolume
        : null,
    insiderTone: facts.insiderTone,
    insiderSummaries: facts.insiderSummaries.slice(0, 2),
    streetConsensus: facts.streetConsensus,
  };
}

async function requestOverlay(
  facts: EarlyOppFacts,
): Promise<EarlyOppQualitativeOverlay | null> {
  const completion = await complete({
    feature: "analysis.early_opp",
    system: EARLY_OPP_SYSTEM,
    timeoutMs: 25_000,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          instruction:
            "Synthesize qualitative Early Opp notes from these loaded facts only. Do not invent numbers.",
          facts: factsForPrompt(facts),
        }),
      },
    ],
  });
  return parseOverlay(completion.text);
}

export async function getEarlyOppQualitative(input: {
  facts: EarlyOppFacts;
}): Promise<{ overlay: EarlyOppQualitativeOverlay | null; ai: EarlyOppAiMeta }> {
  const model = resolveAiFeature("analysis.early_opp").config.model;
  if (!isAiConfigured()) {
    return {
      overlay: null,
      ai: {
        configured: false,
        available: false,
        source: "missing_key",
        model,
      },
    };
  }

  const key = earlyOppAiCacheKey({
    symbol: input.facts.symbol,
    factStamp: factStamp(input.facts),
  });
  const cached = readEarlyOppAiMemory(key);
  if (cached) {
    return {
      overlay: cached.overlay,
      ai: { configured: true, available: true, source: "cache", model: cached.model },
    };
  }

  const existing = getEarlyOppAiInflight(key);
  if (existing) {
    const overlay = await existing;
    return {
      overlay,
      ai: {
        configured: true,
        available: overlay != null,
        source: overlay ? "cache" : "unavailable",
        model,
      },
    };
  }

  const run = (async () => {
    try {
      const overlay = await requestOverlay(input.facts);
      if (overlay) writeEarlyOppAiMemory(key, overlay, model);
      return overlay;
    } catch {
      return null;
    }
  })();
  setEarlyOppAiInflight(key, run);
  const overlay = await run;
  return {
    overlay: overlay ?? null,
    ai: {
      configured: true,
      available: overlay != null,
      source: overlay ? "live" : "unavailable",
      model,
    },
  };
}

export { EMPTY_OVERLAY };
