import { buildAssetTypeBreakdown } from "@/lib/portfolio/analytics";
import {
  buildAllocationDrift,
  resolveTargetAllocation,
  type AllocationDriftRow,
  type TargetAllocation,
} from "@/lib/portfolio/allocation-targets";
import { getHoldingChartLabel } from "@/lib/portfolio/allocation-chart";
import { computeModifiedDietzReturn } from "@/lib/portfolio/modified-dietz";
import type { AssetType, PortfolioHoldingWithPrices } from "@/types/portfolio";

/** One name at or above this share is a real concentration flag. */
export const CONCENTRATION_FLAG_PCT = 25;
/** One name at or above this share is a note, not the risk chip. */
export const CONCENTRATION_NOTE_PCT = 10;
/** Cash share that produces the Cash-heavy chip (when not already Concentrated). */
export const CASH_HEAVY_PCT = 40;
/** One holding-type sleeve at or above this share is a dominate flag. */
export const SLEEVE_DOMINANT_PCT = 50;

export type CheckupRiskChip = "concentrated" | "balanced" | "cash-heavy";
export type ConcentrationNote = "flag" | "note" | "none";

export interface CheckupHoldingRef {
  id: string;
  symbol: string;
  name: string;
  type: AssetType;
  label: string;
  percent: number;
  value: number;
}

export interface CheckupConcentration {
  topHoldingPercent: number;
  top5Percent: number;
  nameCount: number;
  topHolding: CheckupHoldingRef | null;
  topHoldings: CheckupHoldingRef[];
  note: ConcentrationNote;
}

export interface CheckupMixItem {
  type: AssetType;
  label: string;
  percent: number;
  value: number;
  count: number;
}

export interface CheckupSleeveFlag {
  type: AssetType;
  label: string;
  percent: number;
}

export interface CheckupOptionsOverlay {
  netPremium: number;
  percentOfPortfolio: number | null;
}

export interface CheckupNextAction {
  code:
    | "review-concentration"
    | "refresh-retire"
    | "open-portfolio"
    | "create-portfolio";
  label: string;
  href: string;
}

export interface InvestmentCheckup {
  hasData: boolean;
  totalValue: number;
  totalCost: number;
  profitLoss: number;
  profitLossPercent: number;
  cashPercent: number;
  riskChip: CheckupRiskChip;
  concentration: CheckupConcentration;
  mix: CheckupMixItem[];
  dominatingSleeve: CheckupSleeveFlag | null;
  targets: TargetAllocation;
  targetsAreDefault: boolean;
  drift: AllocationDriftRow[];
  optionsOverlay: CheckupOptionsOverlay | null;
  modifiedDietzPercent: number | null;
  nextAction: CheckupNextAction;
}

function pricedHoldings(holdings: PortfolioHoldingWithPrices[]) {
  return holdings.filter(
    (holding) => holding.currentValue !== null && holding.currentValue > 0,
  );
}

export function concentrationNoteForWeight(percent: number): ConcentrationNote {
  if (percent >= CONCENTRATION_FLAG_PCT) return "flag";
  if (percent >= CONCENTRATION_NOTE_PCT) return "note";
  return "none";
}

/**
 * Risk chip rules (tested):
 * 1. Largest non-cash name ≥ 25% → Concentrated
 * 2. Else cash ≥ 40% → Cash-heavy
 * 3. Else Balanced
 *
 * Cash is excluded from (1) so an 80% cash book is Cash-heavy, not
 * "concentrated in USD".
 */
export function resolveRiskChip(input: {
  topNonCashPercent: number;
  cashPercent: number;
}): CheckupRiskChip {
  if (input.topNonCashPercent >= CONCENTRATION_FLAG_PCT) return "concentrated";
  if (input.cashPercent >= CASH_HEAVY_PCT) return "cash-heavy";
  return "balanced";
}

function toHoldingRef(
  holding: PortfolioHoldingWithPrices,
): CheckupHoldingRef {
  return {
    id: holding.id,
    symbol: holding.symbol,
    name: holding.name,
    type: holding.type,
    label: getHoldingChartLabel(holding),
    percent: holding.portfolioPercent ?? 0,
    value: holding.currentValue ?? 0,
  };
}

function buildConcentration(
  priced: PortfolioHoldingWithPrices[],
): CheckupConcentration {
  const sorted = [...priced].sort(
    (a, b) => (b.currentValue ?? 0) - (a.currentValue ?? 0),
  );
  const weightOf = (slice: PortfolioHoldingWithPrices[]) =>
    slice.reduce((sum, holding) => sum + (holding.portfolioPercent ?? 0), 0);

  const top = sorted[0] ?? null;
  const topHoldingPercent = top ? (top.portfolioPercent ?? 0) : 0;

  return {
    topHoldingPercent,
    top5Percent: weightOf(sorted.slice(0, 5)),
    nameCount: priced.length,
    topHolding: top ? toHoldingRef(top) : null,
    topHoldings: sorted.slice(0, 5).map(toHoldingRef),
    note: concentrationNoteForWeight(topHoldingPercent),
  };
}

function resolveNextAction(input: {
  hasData: boolean;
  portfolioHref: string;
  riskChip: CheckupRiskChip;
  topHolding: CheckupHoldingRef | null;
  retireRefreshHref: string | null;
}): CheckupNextAction {
  if (!input.hasData) {
    return {
      code: "create-portfolio",
      label: "Add holdings",
      href: input.portfolioHref,
    };
  }

  if (input.riskChip === "concentrated" && input.topHolding) {
    return {
      code: "review-concentration",
      label: `Review ${input.topHolding.label} in the book`,
      href: input.portfolioHref,
    };
  }

  if (input.retireRefreshHref) {
    return {
      code: "refresh-retire",
      label: "Refresh Freedom from this portfolio",
      href: input.retireRefreshHref,
    };
  }

  return {
    code: "open-portfolio",
    label: "Open book",
    href: input.portfolioHref,
  };
}

export function buildInvestmentCheckup(
  holdings: PortfolioHoldingWithPrices[],
  totals: { costValue: number; currentValue: number; profitLoss: number },
  options?: {
    storedTargets?: TargetAllocation;
    netPremium?: number | null;
    hasOptions?: boolean;
    portfolioHref?: string;
    budgetLeftoverHref?: string | null;
    retireRefreshHref?: string | null;
  },
): InvestmentCheckup {
  const priced = pricedHoldings(holdings);
  const hasData = priced.length > 0;
  const concentration = buildConcentration(priced);
  const breakdown = buildAssetTypeBreakdown(holdings);
  const cashPercent = breakdown.find((item) => item.id === "cash")?.percent ?? 0;
  const topNonCashPercent = priced
    .filter((holding) => holding.type !== "cash")
    .reduce((max, holding) => Math.max(max, holding.portfolioPercent ?? 0), 0);
  const riskChip = hasData
    ? resolveRiskChip({
        topNonCashPercent,
        cashPercent,
      })
    : "balanced";
  const { targets, isDefault } = resolveTargetAllocation(options?.storedTargets);
  const actualPercents = Object.fromEntries(
    breakdown.map((item) => [item.id, item.percent]),
  ) as Partial<Record<AssetType, number>>;
  const mix: CheckupMixItem[] = breakdown.map((item) => ({
    type: item.id,
    label: item.id === "custom" ? "Other" : item.label,
    percent: item.percent,
    value: item.value,
    count: item.count,
  }));
  const topSleeve = [...mix].sort((a, b) => b.percent - a.percent)[0] ?? null;
  const dominatingSleeve: CheckupSleeveFlag | null =
    topSleeve && topSleeve.percent >= SLEEVE_DOMINANT_PCT
      ? {
          type: topSleeve.type,
          label: topSleeve.label,
          percent: topSleeve.percent,
        }
      : null;
  const portfolioHref = options?.portfolioHref ?? "/invest/portfolio";
  const hasOptions = Boolean(options?.hasOptions);
  const netPremium = options?.netPremium ?? null;
  const optionsOverlay =
    hasOptions && netPremium !== null
      ? {
          netPremium,
          percentOfPortfolio:
            totals.currentValue > 0
              ? (netPremium / totals.currentValue) * 100
              : null,
        }
      : null;

  return {
    hasData,
    totalValue: totals.currentValue,
    totalCost: totals.costValue,
    profitLoss: totals.profitLoss,
    profitLossPercent:
      totals.costValue > 0 ? (totals.profitLoss / totals.costValue) * 100 : 0,
    cashPercent,
    riskChip,
    concentration,
    mix,
    dominatingSleeve,
    targets,
    targetsAreDefault: isDefault,
    drift: buildAllocationDrift(actualPercents, targets, totals.currentValue),
    optionsOverlay,
    modifiedDietzPercent: computeModifiedDietzReturn(holdings),
    nextAction: resolveNextAction({
      hasData,
      portfolioHref,
      riskChip,
      topHolding: concentration.topHolding,
      retireRefreshHref: options?.retireRefreshHref ?? null,
    }),
  };
}

export function riskChipLabel(chip: CheckupRiskChip): string {
  if (chip === "concentrated") return "Concentrated";
  if (chip === "cash-heavy") return "Cash-heavy";
  return "Balanced";
}

export function riskChipDescription(chip: CheckupRiskChip): string {
  if (chip === "concentrated") {
    return `One name is ${CONCENTRATION_FLAG_PCT}% or more of the book.`;
  }
  if (chip === "cash-heavy") {
    return `Cash is ${CASH_HEAVY_PCT}% or more of the book.`;
  }
  return "No single name at the 25% flag, and cash is below 40%.";
}
