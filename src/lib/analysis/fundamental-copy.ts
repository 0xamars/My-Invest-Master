import type {
  FundamentalResult,
  MetricScore,
  PillarScore,
} from "@/lib/analysis/rating/types";

function strengthWord(score: number | null): string {
  if (score == null) return "Unavailable";
  if (score >= 80) return "Strong";
  if (score >= 65) return "Solid";
  if (score >= 45) return "Mixed";
  if (score >= 30) return "Weak";
  return "Poor";
}

function simplifyNote(note: string | null | undefined): string | null {
  if (!note) return null;
  const n = note.toLowerCase();

  if (n.includes("de-emphasized") || n.includes("not primary risk")) {
    return "Leverage is less important for this business type";
  }
  if (n.includes("higher structural leverage") || n.includes("infra bands")) {
    return "Higher leverage is common for this industry";
  }
  if (n.includes("early-growth") || n.includes("liquidity over")) {
    return "Liquidity matters more than earnings here";
  }
  if (n.includes("regulatory capital")) {
    return "Using capital-efficiency proxies for this business type";
  }
  if (n.includes("top quartile")) {
    return "Ahead of industry peers";
  }
  if (n.includes("bottom quartile")) {
    return "Behind industry peers";
  }
  if (n.includes("mid-pack")) {
    return "About average versus peers";
  }
  if (n.includes("growth softens expensive") || n.includes("softens expensive")) {
    return "Expensive vs peers, partly supported by growth";
  }
  if (n.includes("cheap multiple with weak")) {
    return "Looks cheap, but growth is weak";
  }
  if (n.includes("computed roic") || n.includes("roic unavailable")) {
    return null; // methodology — hide from takeaway
  }
  if (n.includes("scored vs") || n.includes("industry frame")) {
    return "Compared with industry peers";
  }
  return null;
}

function topMetrics(pillar: PillarScore, limit = 3): MetricScore[] {
  return pillar.metrics
    .filter((m) => !m.skipped && m.score != null)
    .sort((a, b) => Math.abs((b.score ?? 0) - 50) - Math.abs((a.score ?? 0) - 50))
    .slice(0, limit);
}

function avgScore(metrics: MetricScore[]): number | null {
  const scores = metrics
    .filter((m) => m.score != null)
    .map((m) => m.score!);
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/** One plain-language takeaway per pillar for the executive summary. */
export function pillarTakeaway(
  pillar: PillarScore,
  fundamental: FundamentalResult,
): string {
  const score = pillar.score;
  if (score == null) return "Not enough data for this pillar";

  const industry =
    fundamental.classification.industry ??
    fundamental.classification.sector ??
    "this industry";
  const hasPeers = fundamental.peerContext.basis !== "none";
  const model = fundamental.classification.businessModel;
  const shown = topMetrics(pillar, 3);
  const noteHint = shown
    .map((m) => simplifyNote(m.note))
    .find((n): n is string => Boolean(n));

  switch (pillar.id) {
    case "financial_strength": {
      if (model === "brokerage_capital_markets") {
        return score >= 65
          ? "Balance sheet acceptable for a capital-markets business"
          : "Balance sheet needs watching for this business type";
      }
      if (model === "bank_insurance") {
        return score >= 65
          ? "Capital efficiency looks reasonable for a bank/insurer"
          : "Capital efficiency looks soft for a bank/insurer";
      }
      if (model === "reit_utilities") {
        return score >= 65
          ? "Leverage and cash flow look manageable for this industry"
          : "Leverage or cash flow looks stretched for this industry";
      }
      if (model === "early_growth") {
        return score >= 65
          ? "Liquidity looks adequate for a growth business"
          : "Liquidity looks tight for a growth business";
      }
      if (noteHint) return noteHint;
      if (score >= 80) return `Strong balance sheet versus ${industry}`;
      if (score >= 65) {
        return hasPeers
          ? `Balance sheet looks solid among ${industry} peers`
          : "Balance sheet looks solid";
      }
      if (score >= 45) return "Balance sheet is mixed";
      return "Balance sheet looks weak";
    }
    case "profitability": {
      if (noteHint?.includes("peers") || noteHint?.includes("Ahead") || noteHint?.includes("Behind") || noteHint?.includes("average")) {
        if (score >= 80) return `High margins versus industry peers`;
        if (score >= 65) return `Healthy margins versus industry peers`;
        if (score >= 45) return "Margins are about average versus peers";
        return "Margins lag industry peers";
      }
      if (score >= 80) return "High profitability";
      if (score >= 65) return "Solid profitability";
      if (score >= 45) return "Mixed profitability";
      return "Weak profitability";
    }
    case "growth": {
      if (score >= 80) {
        return hasPeers
          ? "Strong growth versus industry peers"
          : "Strong growth";
      }
      if (score >= 65) {
        return hasPeers
          ? "Solid growth, competitive among peers"
          : "Solid growth";
      }
      if (score >= 45) {
        return hasPeers
          ? "Moderate growth, mid-pack among peers"
          : "Moderate growth";
      }
      return "Growth looks soft";
    }
    case "valuation": {
      const growthSoftens = pillar.metrics.some((m) =>
        (m.note ?? "").toLowerCase().includes("softens expensive"),
      );
      const cheapWeak = pillar.metrics.some((m) =>
        (m.note ?? "").toLowerCase().includes("cheap multiple with weak"),
      );
      if (growthSoftens || (score < 45 && score >= 25 && noteHint?.includes("growth"))) {
        return "Expensive vs peers, partly supported by growth";
      }
      if (cheapWeak) return "Looks cheap, but growth is weak";
      if (score >= 80) return "Attractive valuation versus peers";
      if (score >= 65) return "Reasonable valuation";
      if (score >= 45) return "Valuation looks fair to full";
      if (score >= 30) return "Expensive versus peers";
      return "Very expensive versus peers";
    }
    default:
      return `${strengthWord(score)} overall`;
  }
}

/** Short plain-English outlook for the panel header. */
export function shortOutlookLine(fundamental: FundamentalResult): string {
  const { company, industry, adjustment } = fundamental.outlook;
  const adj =
    adjustment === 0
      ? "no score adjustment"
      : `${adjustment > 0 ? "+" : ""}${adjustment} to the score`;

  if (company === "Strong" && industry === "Strong") {
    return `Company and industry outlook are constructive (${adj})`;
  }
  if (company === "Strong" && industry === "Neutral") {
    return `Company outlook is constructive; industry is neutral (${adj})`;
  }
  if (company === "Strong" && industry === "Weak") {
    return `Company looks strong, but the industry outlook is soft (${adj})`;
  }
  if (company === "Weak" && industry === "Weak") {
    return `Company and industry outlook look soft (${adj})`;
  }
  if (company === "Weak") {
    return `Company outlook is cautious; industry is ${industry.toLowerCase()} (${adj})`;
  }
  if (industry === "Strong") {
    return `Industry outlook is constructive; company is neutral (${adj})`;
  }
  return `Outlook is neutral overall (${adj})`;
}

export function peerBasisShort(fundamental: FundamentalResult): string {
  const { basis, peerCount, industry } = fundamental.peerContext;
  const name = industry ?? fundamental.classification.industry ?? "Peers";
  switch (basis) {
    case "sub_industry":
      return `${name} · ${peerCount} peers`;
    case "industry":
      return `${name} group · ${peerCount} peers`;
    case "sector": {
      const sector =
        fundamental.classification.sector ??
        fundamental.peerContext.sector ??
        "Sector";
      return `${sector} (broad) · ${peerCount} peers`;
    }
    default:
      return "Absolute thresholds";
  }
}

export function formatDataAsOf(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export { topMetrics, simplifyNote, avgScore };
