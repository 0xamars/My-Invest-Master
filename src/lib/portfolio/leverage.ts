/**
 * Manual leverage / margin on the portfolio JSONB.
 *
 * Utilization = marginUsed / (marginUsed + cushion)
 * Cushion = typed equity (net liquidation) if set and > 0,
 * otherwise cash holdings in the book. Missing inputs stay null —
 * never invent balances.
 */

export const LEVERAGE_CAUTION_PCT = 50;
export const LEVERAGE_HIGH_PCT = 70;

export type LeverageFlag = "ok" | "caution" | "high" | "unset";

export interface PortfolioLeverage {
  /** Amount drawn on margin. Null if the user has not typed it. */
  marginUsed: number | null;
  /** Equity / net liquidation typed by the user. */
  equity: number | null;
  buyingPower: number | null;
  broker: string | null;
}

export const EMPTY_LEVERAGE: PortfolioLeverage = {
  marginUsed: null,
  equity: null,
  buyingPower: null,
  broker: null,
};

/** Labeled input → number. Blank or invalid stays null — no invented balances. */
export function parseLeverageField(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function asOptionalNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return value;
}

function asOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 80) : null;
}

/** Old plans and empty objects become nulls. Does not invent balances. */
export function parseStoredLeverage(value: unknown): PortfolioLeverage {
  if (!value || typeof value !== "object") {
    return { ...EMPTY_LEVERAGE };
  }
  const raw = value as Record<string, unknown>;
  const equity =
    asOptionalNumber(raw.equity) ?? asOptionalNumber(raw.netLiquidation);

  return {
    marginUsed: asOptionalNumber(raw.marginUsed),
    equity,
    buyingPower: asOptionalNumber(raw.buyingPower),
    broker: asOptionalString(raw.broker),
  };
}

export interface LeverageUtilization {
  utilizationPercent: number | null;
  flag: LeverageFlag;
  cushion: number | null;
  cushionSource: "equity" | "cash" | null;
}

export function computeLeverageUtilization(input: {
  marginUsed: number | null;
  equity: number | null;
  cashValue: number;
}): LeverageUtilization {
  const marginUsed = input.marginUsed;
  if (marginUsed == null) {
    return {
      utilizationPercent: null,
      flag: "unset",
      cushion: null,
      cushionSource: null,
    };
  }

  let cushion: number | null = null;
  let cushionSource: LeverageUtilization["cushionSource"] = null;
  if (input.equity != null && input.equity > 0) {
    cushion = input.equity;
    cushionSource = "equity";
  } else if (input.cashValue > 0) {
    cushion = input.cashValue;
    cushionSource = "cash";
  }

  if (cushion == null) {
    return {
      utilizationPercent: null,
      flag: "unset",
      cushion: null,
      cushionSource: null,
    };
  }

  const denominator = marginUsed + cushion;
  if (denominator <= 0) {
    return {
      utilizationPercent: null,
      flag: "unset",
      cushion,
      cushionSource,
    };
  }

  const utilizationPercent = (marginUsed / denominator) * 100;
  const flag: LeverageFlag =
    utilizationPercent >= LEVERAGE_HIGH_PCT
      ? "high"
      : utilizationPercent >= LEVERAGE_CAUTION_PCT
        ? "caution"
        : "ok";

  return { utilizationPercent, flag, cushion, cushionSource };
}

export function leverageFlagLabel(flag: LeverageFlag): string {
  if (flag === "high") return "High util";
  if (flag === "caution") return "Caution";
  if (flag === "ok") return "Util ok";
  return "No margin";
}

export function cashValueFromHoldings(
  holdings: { type: string; currentValue: number | null }[],
): number {
  return holdings
    .filter((holding) => holding.type === "cash")
    .reduce((sum, holding) => sum + (holding.currentValue ?? 0), 0);
}

export function leverageUtilizationFromPortfolio(
  leverage: PortfolioLeverage | undefined,
  cashValue: number,
): LeverageUtilization {
  const parsed = parseStoredLeverage(leverage);
  return computeLeverageUtilization({
    marginUsed: parsed.marginUsed,
    equity: parsed.equity,
    cashValue,
  });
}

/**
 * Old portfolio JSONB blobs have no leverage key. Migrate to nulls —
 * never invent margin, equity, or buying power.
 */
export function migrateLeverageFromPlanData(data: unknown): PortfolioLeverage {
  if (!data || typeof data !== "object") {
    return { ...EMPTY_LEVERAGE };
  }
  return parseStoredLeverage((data as { leverage?: unknown }).leverage);
}
