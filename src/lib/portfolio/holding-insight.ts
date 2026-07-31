import { getHoldingChartLabel } from "@/lib/portfolio/allocation-chart";
import { buildAssetTypeBreakdown, buildSectorBreakdown } from "@/lib/portfolio/analytics";
import { normalizeSector } from "@/lib/portfolio/sectors";
import type { PortfolioHoldingWithPrices } from "@/types/portfolio";

export type HoldingConcentrationLevel = "low" | "elevated" | "high";

export type HoldingInsightNote = {
  id: string;
  severity: "info" | "watch" | "alert";
  title: string;
  description: string;
  metric?: string;
};

export type HoldingInsightSnapshot = {
  label: string;
  weight: number | null;
  rank: number | null;
  holdingsCount: number;
  concentrationLevel: HoldingConcentrationLevel;
  concentrationNote: HoldingInsightNote | null;
  riskNotes: HoldingInsightNote[];
  contributionPercent: number | null;
  sectorWeight: number | null;
  assetTypeWeight: number | null;
  /** Extension point for future InvestSalsa Rating engine. */
  ratingPlaceholder: {
    status: "coming_soon";
    title: string;
    description: string;
  };
};

function formatWeight(percent: number): string {
  return `${percent.toFixed(1)}%`;
}

function concentrationLevel(weight: number | null): HoldingConcentrationLevel {
  if (weight == null) return "low";
  if (weight >= 40) return "high";
  if (weight >= 25) return "elevated";
  return "low";
}

/**
 * Deterministic single-holding insight for the Holding Insight popup.
 * Pure portfolio math — no AI.
 */
export function buildHoldingInsight(
  holding: PortfolioHoldingWithPrices,
  portfolioHoldings: PortfolioHoldingWithPrices[],
): HoldingInsightSnapshot {
  const priced = portfolioHoldings.filter(
    (item) => item.currentValue !== null && item.currentValue > 0,
  );
  const sorted = [...priced].sort(
    (a, b) => (b.currentValue ?? 0) - (a.currentValue ?? 0),
  );
  const rankIndex = sorted.findIndex((item) => item.id === holding.id);
  const rank = rankIndex >= 0 ? rankIndex + 1 : null;
  const weight = holding.portfolioPercent;
  const level = concentrationLevel(weight);
  const label = getHoldingChartLabel(holding);

  let concentrationNote: HoldingInsightNote | null = null;
  if (priced.length <= 1 && holding.currentValue && holding.currentValue > 0) {
    concentrationNote = {
      id: "sole_holding",
      severity: "alert",
      title: "Only holding in this portfolio",
      description:
        "All portfolio value sits in this position. Outcomes are fully tied to this name.",
      metric: formatWeight(weight ?? 100),
    };
  } else if (weight != null && weight >= 40) {
    concentrationNote = {
      id: "high_weight",
      severity: "alert",
      title: "High portfolio concentration",
      description: `${label} is a large share of portfolio value. A sharp move here would dominate results.`,
      metric: formatWeight(weight),
    };
  } else if (weight != null && weight >= 25) {
    concentrationNote = {
      id: "elevated_weight",
      severity: "watch",
      title: "Elevated portfolio weight",
      description: `${label} is a meaningful share of the portfolio. Worth monitoring if it grows further.`,
      metric: formatWeight(weight),
    };
  } else if (weight != null && weight > 0) {
    concentrationNote = {
      id: "moderate_weight",
      severity: "info",
      title: "Moderate portfolio contribution",
      description: `${label} is not a dominant weight under the current concentration rules.`,
      metric: formatWeight(weight),
    };
  }

  const riskNotes: HoldingInsightNote[] = [];

  if (holding.type === "crypto" && weight != null && weight >= 15) {
    riskNotes.push({
      id: "crypto_volatility",
      severity: weight >= 30 ? "alert" : "watch",
      title: "Crypto position",
      description:
        "Crypto can move faster than equities or cash. Size this exposure against your overall risk comfort.",
      metric: weight != null ? formatWeight(weight) : undefined,
    });
  }

  if (holding.type === "custom") {
    riskNotes.push({
      id: "manual_price",
      severity: "info",
      title: "Manually priced asset",
      description:
        "Current value depends on the price you set. Refresh it periodically so P/L stays meaningful.",
    });
  }

  if (holding.type === "cash") {
    riskNotes.push({
      id: "cash_buffer",
      severity: "info",
      title: "Cash holding",
      description:
        "Cash lowers market risk and can act as dry powder, but it may lag if markets rise.",
    });
  }

  const withPl = priced.filter(
    (item) => item.profitLoss !== null && item.type !== "cash",
  );
  const totalAbsPl = withPl.reduce(
    (sum, item) => sum + Math.abs(item.profitLoss ?? 0),
    0,
  );
  const contributionPercent =
    holding.type !== "cash" &&
    holding.profitLoss != null &&
    totalAbsPl > 0
      ? (Math.abs(holding.profitLoss) / totalAbsPl) * 100
      : null;

  if (
    contributionPercent != null &&
    contributionPercent >= 50 &&
    (holding.profitLoss ?? 0) > 0
  ) {
    riskNotes.push({
      id: "gains_driver",
      severity: "watch",
      title: "Major unrealized-gains driver",
      description:
        "A large share of absolute portfolio P/L comes from this position’s gains. Overall results may look different if it cools off.",
      metric: `${contributionPercent.toFixed(0)}% of |P/L|`,
    });
  }

  if (
    contributionPercent != null &&
    contributionPercent >= 50 &&
    (holding.profitLoss ?? 0) < 0
  ) {
    riskNotes.push({
      id: "loss_driver",
      severity: "watch",
      title: "Major unrealized-loss driver",
      description:
        "A large share of absolute portfolio P/L comes from this position’s losses. Addressing it would move overall P/L the most.",
      metric: `${contributionPercent.toFixed(0)}% of |P/L|`,
    });
  }

  const sector = normalizeSector(holding.sector);
  const sectorRow = buildSectorBreakdown(portfolioHoldings).find(
    (row) => row.id === sector,
  );
  const typeRow = buildAssetTypeBreakdown(portfolioHoldings).find(
    (row) => row.id === holding.type,
  );

  if (
    sectorRow &&
    sectorRow.percent >= 50 &&
    sector !== "Other" &&
    sector !== "Cash & Liquidity" &&
    sector !== "Crypto"
  ) {
    riskNotes.push({
      id: "sector_cluster",
      severity: sectorRow.percent >= 65 ? "alert" : "watch",
      title: `In a heavy ${sectorRow.label} sleeve`,
      description: `This holding sits in ${sectorRow.label}, which is a large share of the overall portfolio.`,
      metric: formatWeight(sectorRow.percent),
    });
  }

  return {
    label,
    weight,
    rank,
    holdingsCount: priced.length,
    concentrationLevel: level,
    concentrationNote,
    riskNotes,
    contributionPercent,
    sectorWeight: sectorRow?.percent ?? null,
    assetTypeWeight: typeRow?.percent ?? null,
    ratingPlaceholder: {
      status: "coming_soon",
      title: "InvestSalsa Rating",
      description:
        "A proprietary holding rating will appear here in a future release. Today’s insight uses transparent portfolio math only.",
    },
  };
}

export function concentrationLevelLabel(
  level: HoldingConcentrationLevel,
): string {
  if (level === "high") return "High";
  if (level === "elevated") return "Elevated";
  return "Low";
}
