import {
  ASSET_TYPE_LABELS,
  buildAssetTypeBreakdown,
  buildSectorBreakdown,
  getAnalyticsSummary,
  hasAnalyticsData,
} from "@/lib/portfolio/analytics";
import { getHoldingChartLabel } from "@/lib/portfolio/allocation-chart";
import type { PortfolioHoldingWithPrices } from "@/types/portfolio";

export type IntelligenceRiskLevel = "low" | "moderate" | "high";

export type IntelligenceInsightSeverity = "info" | "watch" | "alert";

/**
 * Deterministic insight codes — stable IDs for future rating badges / AI copy.
 * Do not rename casually; UI and future engines can key off these.
 */
export type IntelligenceInsightCode =
  | "single_holding_portfolio"
  | "high_ticker_concentration"
  | "moderate_ticker_concentration"
  | "top3_concentration"
  | "top5_concentration"
  | "heavy_crypto_exposure"
  | "moderate_crypto_exposure"
  | "sector_skew"
  | "low_diversification"
  | "gains_concentrated"
  | "losses_concentrated"
  | "balanced_allocation"
  | "cash_heavy";

export interface IntelligenceInsight {
  id: IntelligenceInsightCode;
  severity: IntelligenceInsightSeverity;
  title: string;
  description: string;
  /** Human-readable metric supporting the claim (e.g. "42% in AAPL"). */
  metric?: string;
}

export interface ConcentrationMetrics {
  top1Weight: number;
  top3Weight: number;
  top5Weight: number;
  top1Holding: PortfolioHoldingWithPrices | null;
  top3Holdings: PortfolioHoldingWithPrices[];
  top5Holdings: PortfolioHoldingWithPrices[];
  level: IntelligenceRiskLevel;
}

export interface PerformanceRow {
  holding: PortfolioHoldingWithPrices;
  label: string;
  profitLoss: number;
  profitLossPercent: number;
  /** Share of absolute portfolio P/L this position represents (0–100). */
  contributionPercent: number | null;
}

export interface PortfolioIntelligence {
  hasData: boolean;
  holdingsCount: number;
  pricedCount: number;
  totalValue: number;
  totalCost: number;
  profitLoss: number;
  profitLossPercent: number;
  concentration: ConcentrationMetrics;
  overallRisk: IntelligenceRiskLevel;
  insights: IntelligenceInsight[];
  topGainers: PerformanceRow[];
  topLosers: PerformanceRow[];
  bestContributors: PerformanceRow[];
  worstContributors: PerformanceRow[];
  assetTypeBreakdown: ReturnType<typeof buildAssetTypeBreakdown>;
  sectorBreakdown: ReturnType<typeof buildSectorBreakdown>;
  analyticsSummary: ReturnType<typeof getAnalyticsSummary>;
}

const RISK_RANK: Record<IntelligenceRiskLevel, number> = {
  low: 0,
  moderate: 1,
  high: 2,
};

function maxRisk(
  a: IntelligenceRiskLevel,
  b: IntelligenceRiskLevel,
): IntelligenceRiskLevel {
  return RISK_RANK[a] >= RISK_RANK[b] ? a : b;
}

function getPricedHoldings(holdings: PortfolioHoldingWithPrices[]) {
  return holdings.filter(
    (holding) => holding.currentValue !== null && holding.currentValue > 0,
  );
}

function formatWeight(percent: number): string {
  return `${percent.toFixed(1)}%`;
}

function buildConcentration(
  priced: PortfolioHoldingWithPrices[],
): ConcentrationMetrics {
  const sorted = [...priced].sort(
    (a, b) => (b.currentValue ?? 0) - (a.currentValue ?? 0),
  );

  const weightOf = (slice: PortfolioHoldingWithPrices[]) =>
    slice.reduce((sum, h) => sum + (h.portfolioPercent ?? 0), 0);

  const top1Holdings = sorted.slice(0, 1);
  const top3Holdings = sorted.slice(0, 3);
  const top5Holdings = sorted.slice(0, 5);

  const top1Weight = weightOf(top1Holdings);
  const top3Weight = weightOf(top3Holdings);
  const top5Weight = weightOf(top5Holdings);

  let level: IntelligenceRiskLevel = "low";
  if (priced.length <= 1 || top1Weight >= 40 || top3Weight >= 75) {
    level = "high";
  } else if (top1Weight >= 25 || top3Weight >= 60 || top5Weight >= 80) {
    level = "moderate";
  }

  return {
    top1Weight,
    top3Weight,
    top5Weight,
    top1Holding: top1Holdings[0] ?? null,
    top3Holdings,
    top5Holdings,
    level,
  };
}

function buildInsights(
  priced: PortfolioHoldingWithPrices[],
  concentration: ConcentrationMetrics,
  assetTypes: ReturnType<typeof buildAssetTypeBreakdown>,
  sectors: ReturnType<typeof buildSectorBreakdown>,
  profitLoss: number,
): IntelligenceInsight[] {
  const insights: IntelligenceInsight[] = [];

  if (priced.length === 1) {
    const only = priced[0];
    insights.push({
      id: "single_holding_portfolio",
      severity: "alert",
      title: "Single-holding portfolio",
      description:
        "All portfolio value sits in one position. Adding more holdings usually lowers concentration risk.",
      metric: only
        ? `${getHoldingChartLabel(only)} · ${formatWeight(only.portfolioPercent ?? 100)}`
        : undefined,
    });
  } else if (priced.length > 0 && priced.length <= 3) {
    insights.push({
      id: "low_diversification",
      severity: "watch",
      title: "Low diversification",
      description: `Only ${priced.length} priced holdings. A small number of names can amplify swings.`,
      metric: `${priced.length} holdings`,
    });
  }

  const top1 = concentration.top1Holding;
  if (top1 && priced.length > 1) {
    if (concentration.top1Weight >= 40) {
      insights.push({
        id: "high_ticker_concentration",
        severity: "alert",
        title: "High concentration in one ticker",
        description: `${getHoldingChartLabel(top1)} is a large share of portfolio value. A sharp move there would dominate results.`,
        metric: formatWeight(concentration.top1Weight),
      });
    } else if (concentration.top1Weight >= 25) {
      insights.push({
        id: "moderate_ticker_concentration",
        severity: "watch",
        title: "Elevated single-ticker weight",
        description: `${getHoldingChartLabel(top1)} is a meaningful share of the portfolio. Worth monitoring if it grows further.`,
        metric: formatWeight(concentration.top1Weight),
      });
    }
  }

  if (priced.length >= 3 && concentration.top3Weight >= 75) {
    insights.push({
      id: "top3_concentration",
      severity: "alert",
      title: "Top 3 holdings dominate",
      description:
        "Your three largest positions make up most of the portfolio. Outcomes are tightly tied to those names.",
      metric: formatWeight(concentration.top3Weight),
    });
  } else if (priced.length >= 5 && concentration.top5Weight >= 85) {
    insights.push({
      id: "top5_concentration",
      severity: "watch",
      title: "Value clustered in top 5",
      description:
        "Most portfolio value sits in the five largest holdings. Smaller positions have limited impact.",
      metric: formatWeight(concentration.top5Weight),
    });
  }

  const crypto = assetTypes.find((item) => item.id === "crypto");
  if (crypto) {
    if (crypto.percent >= 50) {
      insights.push({
        id: "heavy_crypto_exposure",
        severity: "alert",
        title: "Heavy crypto exposure",
        description:
          "Crypto is more than half of portfolio value. Crypto can move faster than equities or cash.",
        metric: formatWeight(crypto.percent),
      });
    } else if (crypto.percent >= 30) {
      insights.push({
        id: "moderate_crypto_exposure",
        severity: "watch",
        title: "Meaningful crypto exposure",
        description:
          "Crypto is a sizable slice of the portfolio. Volatility may run higher than a stock-heavy mix.",
        metric: formatWeight(crypto.percent),
      });
    }
  }

  const cash = assetTypes.find((item) => item.id === "cash");
  if (cash && cash.percent >= 40) {
    insights.push({
      id: "cash_heavy",
      severity: "info",
      title: "Cash-heavy allocation",
      description:
        "A large cash share lowers market risk but may lag if markets rise. Useful as dry powder or a buffer.",
      metric: formatWeight(cash.percent),
    });
  }

  const topSector = sectors[0];
  if (
    topSector &&
    sectors.length >= 1 &&
    priced.length >= 2 &&
    topSector.percent >= 50 &&
    topSector.label !== "Other" &&
    topSector.label !== "Cash & Liquidity" &&
    topSector.label !== "Crypto" &&
    topSector.label !== "Blockchain"
  ) {
    insights.push({
      id: "sector_skew",
      severity: topSector.percent >= 65 ? "alert" : "watch",
      title: `Skewed to ${topSector.label}`,
      description: `More than half of portfolio value is tagged as ${topSector.label}. Sector shocks can hit multiple holdings at once.`,
      metric: formatWeight(topSector.percent),
    });
  }

  const withPl = priced.filter(
    (h) => h.profitLoss !== null && h.type !== "cash",
  );
  const winners = withPl
    .filter((h) => (h.profitLoss ?? 0) > 0)
    .sort((a, b) => (b.profitLoss ?? 0) - (a.profitLoss ?? 0));
  const losers = withPl
    .filter((h) => (h.profitLoss ?? 0) < 0)
    .sort((a, b) => (a.profitLoss ?? 0) - (b.profitLoss ?? 0));

  const totalPositivePl = winners.reduce(
    (sum, h) => sum + (h.profitLoss ?? 0),
    0,
  );
  if (winners.length >= 2 && totalPositivePl > 0) {
    const topTwoGains =
      (winners[0]?.profitLoss ?? 0) + (winners[1]?.profitLoss ?? 0);
    const share = (topTwoGains / totalPositivePl) * 100;
    if (share >= 80) {
      insights.push({
        id: "gains_concentrated",
        severity: "watch",
        title: "Unrealized gains concentrated",
        description:
          "Most unrealized gains come from just a couple of names. Broader results may look different if those cool off.",
        metric: `${formatWeight(share)} of gains in top 2`,
      });
    }
  }

  const totalNegativePl = losers.reduce(
    (sum, h) => sum + Math.abs(h.profitLoss ?? 0),
    0,
  );
  if (losers.length >= 2 && totalNegativePl > 0 && profitLoss < 0) {
    const topTwoLosses =
      Math.abs(losers[0]?.profitLoss ?? 0) +
      Math.abs(losers[1]?.profitLoss ?? 0);
    const share = (topTwoLosses / totalNegativePl) * 100;
    if (share >= 80) {
      insights.push({
        id: "losses_concentrated",
        severity: "watch",
        title: "Losses concentrated in few names",
        description:
          "Most unrealized losses sit in a small set of holdings. Addressing those positions would move overall P/L the most.",
        metric: `${formatWeight(share)} of losses in top 2`,
      });
    }
  }

  if (insights.length === 0 && priced.length >= 4) {
    insights.push({
      id: "balanced_allocation",
      severity: "info",
      title: "No major concentration flags",
      description:
        "Based on simple weight rules, no single ticker, sector, or asset type is dominating at alert levels. Keep reviewing as the mix changes.",
      metric: `Overall risk · ${concentration.level}`,
    });
  }

  const severityOrder: Record<IntelligenceInsightSeverity, number> = {
    alert: 0,
    watch: 1,
    info: 2,
  };

  return insights.sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
  );
}

function overallRiskFromInsights(
  concentration: ConcentrationMetrics,
  insights: IntelligenceInsight[],
): IntelligenceRiskLevel {
  let level = concentration.level;
  for (const insight of insights) {
    if (insight.severity === "alert") level = maxRisk(level, "high");
    if (insight.severity === "watch") level = maxRisk(level, "moderate");
  }
  return level;
}

function toPerformanceRows(
  holdings: PortfolioHoldingWithPrices[],
  totalAbsPl: number,
): PerformanceRow[] {
  return holdings.map((holding) => {
    const profitLoss = holding.profitLoss ?? 0;
    return {
      holding,
      label: getHoldingChartLabel(holding),
      profitLoss,
      profitLossPercent: holding.profitLossPercent ?? 0,
      contributionPercent:
        totalAbsPl > 0 ? (Math.abs(profitLoss) / totalAbsPl) * 100 : null,
    };
  });
}

/**
 * Build a full Portfolio Intelligence snapshot from enriched holdings.
 * Pure / deterministic — no AI, no network.
 */
export function buildPortfolioIntelligence(
  holdings: PortfolioHoldingWithPrices[],
  totals: {
    costValue: number;
    currentValue: number;
    profitLoss: number;
  },
): PortfolioIntelligence {
  const priced = getPricedHoldings(holdings);
  const hasData = hasAnalyticsData(holdings);
  const concentration = buildConcentration(priced);
  const assetTypeBreakdown = buildAssetTypeBreakdown(holdings);
  const sectorBreakdown = buildSectorBreakdown(holdings);
  const analyticsSummary = getAnalyticsSummary(holdings, totals);
  const profitLossPercent =
    totals.costValue > 0 ? (totals.profitLoss / totals.costValue) * 100 : 0;

  const insights = hasData
    ? buildInsights(
        priced,
        concentration,
        assetTypeBreakdown,
        sectorBreakdown,
        totals.profitLoss,
      )
    : [];

  const withPl = priced.filter(
    (h) => h.profitLoss !== null && h.type !== "cash",
  );
  const totalAbsPl = withPl.reduce(
    (sum, h) => sum + Math.abs(h.profitLoss ?? 0),
    0,
  );

  const byReturnPct = [...withPl].sort(
    (a, b) => (b.profitLossPercent ?? 0) - (a.profitLossPercent ?? 0),
  );
  const byPl = [...withPl].sort(
    (a, b) => (b.profitLoss ?? 0) - (a.profitLoss ?? 0),
  );

  return {
    hasData,
    holdingsCount: holdings.length,
    pricedCount: priced.length,
    totalValue: totals.currentValue,
    totalCost: totals.costValue,
    profitLoss: totals.profitLoss,
    profitLossPercent,
    concentration,
    overallRisk: hasData
      ? overallRiskFromInsights(concentration, insights)
      : "low",
    insights,
    topGainers: toPerformanceRows(byReturnPct.slice(0, 5), totalAbsPl),
    topLosers: toPerformanceRows(
      [...byReturnPct].reverse().slice(0, 5).filter((h) => (h.profitLossPercent ?? 0) < 0),
      totalAbsPl,
    ),
    bestContributors: toPerformanceRows(
      byPl.filter((h) => (h.profitLoss ?? 0) > 0).slice(0, 5),
      totalAbsPl,
    ),
    worstContributors: toPerformanceRows(
      [...byPl]
        .reverse()
        .filter((h) => (h.profitLoss ?? 0) < 0)
        .slice(0, 5),
      totalAbsPl,
    ),
    assetTypeBreakdown,
    sectorBreakdown,
    analyticsSummary,
  };
}

export function riskLevelLabel(level: IntelligenceRiskLevel): string {
  if (level === "high") return "High";
  if (level === "moderate") return "Moderate";
  return "Low";
}

export function riskLevelDescription(level: IntelligenceRiskLevel): string {
  if (level === "high") {
    return "Concentration or asset-mix rules flagged elevated risk. Review the insights below.";
  }
  if (level === "moderate") {
    return "Some weights or exposures are elevated. Not necessarily a problem — worth watching.";
  }
  return "No major concentration alerts from the current rules. Diversification looks reasonable.";
}

export { ASSET_TYPE_LABELS };
