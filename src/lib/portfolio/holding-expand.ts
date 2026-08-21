import type { VsSpyWindow } from "@/lib/invest/vs-spy";
import { isPremiumReceived, type OptionType } from "@/types/options";
import type { AssetType, PortfolioHoldingWithPrices } from "@/types/portfolio";

export type RevenuePathKind = "growing" | "flat" | "stall";

export type RevenuePathPoint = {
  year: string;
  revenue: number;
};

export type RevenuePathScreen = {
  kind: RevenuePathKind;
  years: RevenuePathPoint[];
};

export type CashVsDebtScreen = {
  cashAndSti: number | null;
  totalDebt: number | null;
  netCash: boolean | null;
};

export type HoldingHeadline = {
  title: string;
  publisher?: string;
  link?: string;
};

export type HoldingWhyMoved = {
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  averageVolume: number | null;
  volumeVsTypical: number | null;
  headline: HoldingHeadline | null;
};

export type HoldingExpandSize = {
  value: number | null;
  profitLoss: number | null;
  portfolioPercent: number | null;
};

export type HoldingExpandScreens = {
  revenuePath: RevenuePathScreen | null;
  cashVsDebt: CashVsDebtScreen | null;
};

export type HoldingExpandFacts = {
  type: AssetType;
  showScreens: boolean;
  whyMoved: HoldingWhyMoved;
  size: HoldingExpandSize;
  screens: HoldingExpandScreens | null;
  nextEarningsDate: string | null;
  /** Grok desk note from facts only. Null when skipped or rejected. */
  thinking: string | null;
  /** Since-bought vs SPY for this name. Null when dates or SPY are missing. */
  vsSpy: VsSpyWindow | null;
};

/** Book-risk overlay for options on the same underlying. No strategy labels. */
export type HoldingExpandOption = {
  dte: number | null;
  strike: number;
  spot: number | null;
  strikeVsSpot: number | null;
  contracts: number;
  premium: number;
};

export const RATING_UI_FORBIDDEN =
  /investsalsa rating|insight score|\bbelong\b|\breject\b|\b0\s*[–-]\s*100\b/i;

export function holdingExpandShowsScreens(type: AssetType): boolean {
  return type === "stock";
}

export function holdingExpandHasRatingUi(text: string): boolean {
  return RATING_UI_FORBIDDEN.test(text);
}

export function volumeVsTypical(
  volume: number | null | undefined,
  averageVolume: number | null | undefined,
): number | null {
  if (
    volume == null ||
    averageVolume == null ||
    !Number.isFinite(volume) ||
    !Number.isFinite(averageVolume) ||
    averageVolume <= 0
  ) {
    return null;
  }
  return volume / averageVolume;
}

/**
 * Multi-year revenue path from existing statement rows.
 * growing ≥ +8% oldest→newest, stall ≤ −8%, else flat. Need 2+ years.
 */
export function classifyRevenuePath(
  revenues: number[],
): RevenuePathKind | null {
  if (revenues.length < 2) return null;
  const first = revenues[0]!;
  const last = revenues[revenues.length - 1]!;
  if (!Number.isFinite(first) || !Number.isFinite(last)) return null;
  if (first === 0 && last === 0) return "flat";
  const base = Math.abs(first) || Math.abs(last);
  if (base === 0) return "flat";
  const change = (last - first) / base;
  if (change >= 0.08) return "growing";
  if (change <= -0.08) return "stall";
  return "flat";
}

export function buildRevenuePath(
  points: RevenuePathPoint[],
): RevenuePathScreen | null {
  const years = points.filter(
    (point) => Number.isFinite(point.revenue) && point.year.trim().length > 0,
  );
  if (years.length < 2) return null;
  const kind = classifyRevenuePath(years.map((point) => point.revenue));
  if (!kind) return null;
  return { kind, years };
}

export function buildCashVsDebt(input: {
  cashAndSti: number | null;
  totalDebt: number | null;
}): CashVsDebtScreen | null {
  const cashAndSti =
    input.cashAndSti != null && Number.isFinite(input.cashAndSti)
      ? input.cashAndSti
      : null;
  const totalDebt =
    input.totalDebt != null && Number.isFinite(input.totalDebt)
      ? input.totalDebt
      : null;
  if (cashAndSti == null && totalDebt == null) return null;
  return {
    cashAndSti,
    totalDebt,
    netCash:
      cashAndSti != null && totalDebt != null ? cashAndSti > totalDebt : null,
  };
}

/** Next earnings only when a real date is already present. Never invent. */
export function pickNextEarningsDate(
  raw: string | null | undefined,
  now = new Date(),
): string | null {
  if (!raw?.trim()) return null;
  const match = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const candidate = new Date(year, month - 1, day);
  if (candidate < today) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function extractEarningsDateFromUnknown(
  raw: Record<string, unknown> | null | undefined,
  now = new Date(),
): string | null {
  if (!raw) return null;
  const keys = [
    "earningsAnnouncement",
    "nextEarningsDate",
    "earningsDate",
    "earningsCalendarDate",
  ];
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string") {
      const picked = pickNextEarningsDate(value, now);
      if (picked) return picked;
    }
  }
  return null;
}

export function revenuePointsFromIncomeRows(
  rows: Array<Record<string, unknown>>,
): RevenuePathPoint[] {
  const points: RevenuePathPoint[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const revenue = firstNumber(row, ["revenue", "totalRevenue"]);
    const year =
      yearFromUnknown(row.calendarYear) ??
      yearFromUnknown(row.date) ??
      yearFromUnknown(row.fillingDate) ??
      yearFromUnknown(row.filingDate);
    if (revenue == null || !year || seen.has(year)) continue;
    seen.add(year);
    points.push({ year, revenue });
  }
  return points.sort((a, b) => a.year.localeCompare(b.year));
}

export function cashDebtFromBalanceRow(
  row: Record<string, unknown> | null | undefined,
): { cashAndSti: number | null; totalDebt: number | null } {
  if (!row) return { cashAndSti: null, totalDebt: null };
  return {
    cashAndSti: firstNumber(row, [
      "cashAndShortTermInvestments",
      "cashAndCashEquivalents",
    ]),
    totalDebt: firstNumber(row, ["totalDebt"]),
  };
}

export function buildHoldingExpandFacts(input: {
  type: AssetType;
  size?: Partial<HoldingExpandSize>;
  whyMoved?: Partial<HoldingWhyMoved>;
  incomeRows?: Array<Record<string, unknown>>;
  balanceRow?: Record<string, unknown> | null;
  earningsRaw?: Record<string, unknown> | null;
  now?: Date;
  thinking?: string | null;
  vsSpy?: VsSpyWindow | null;
}): HoldingExpandFacts {
  const showScreens = holdingExpandShowsScreens(input.type);
  const whyMoved: HoldingWhyMoved = {
    change: input.whyMoved?.change ?? null,
    changePercent: input.whyMoved?.changePercent ?? null,
    volume: input.whyMoved?.volume ?? null,
    averageVolume: input.whyMoved?.averageVolume ?? null,
    volumeVsTypical:
      input.whyMoved?.volumeVsTypical ??
      volumeVsTypical(
        input.whyMoved?.volume ?? null,
        input.whyMoved?.averageVolume ?? null,
      ),
    headline: input.whyMoved?.headline ?? null,
  };

  const screens = showScreens
    ? {
        revenuePath: buildRevenuePath(
          revenuePointsFromIncomeRows(input.incomeRows ?? []),
        ),
        cashVsDebt: buildCashVsDebt(cashDebtFromBalanceRow(input.balanceRow)),
      }
    : null;

  return {
    type: input.type,
    showScreens,
    whyMoved,
    size: {
      value: input.size?.value ?? null,
      profitLoss: input.size?.profitLoss ?? null,
      portfolioPercent: input.size?.portfolioPercent ?? null,
    },
    screens,
    nextEarningsDate: showScreens
      ? extractEarningsDateFromUnknown(input.earningsRaw, input.now)
      : null,
    thinking: input.thinking ?? null,
    vsSpy: input.vsSpy ?? null,
  };
}

export function whyMovedFactLine(input: {
  changePercent: number | null;
  volumeVsTypical: number | null;
  headlineTitle: string | null;
}): string {
  const parts: string[] = [];
  if (input.changePercent != null && Number.isFinite(input.changePercent)) {
    const sign = input.changePercent > 0 ? "+" : "";
    parts.push(`${sign}${input.changePercent.toFixed(2)}%`);
  }
  if (
    input.volumeVsTypical != null &&
    Number.isFinite(input.volumeVsTypical)
  ) {
    parts.push(`${input.volumeVsTypical.toFixed(1)}× typical`);
  }
  const headline = input.headlineTitle?.trim() ?? "";
  if (headline) parts.push(headline);
  return parts.join(" · ");
}

export function optionsOnUnderlying(
  positions: Array<{
    ticker: string;
    displayStatus: string;
    optionType: OptionType | string;
    dte: number | null;
    strikePrice: number;
    currentStockPrice: number | null;
    contracts: number;
    cost: number;
  }>,
  symbol: string,
  spot?: number | null,
): HoldingExpandOption[] {
  const upper = symbol.trim().toUpperCase();
  if (!upper) return [];
  return positions
    .filter(
      (position) =>
        position.displayStatus === "active" &&
        position.ticker.trim().toUpperCase() === upper,
    )
    .map((position) => {
      const spotPrice =
        spot != null && Number.isFinite(spot)
          ? spot
          : position.currentStockPrice;
      const received = isPremiumReceived(position.optionType as OptionType);
      return {
        dte: position.dte,
        strike: position.strikePrice,
        spot: spotPrice,
        strikeVsSpot:
          spotPrice != null && Number.isFinite(spotPrice)
            ? position.strikePrice - spotPrice
            : null,
        contracts: position.contracts,
        premium: received ? position.cost : -Math.abs(position.cost),
      };
    })
    .sort((a, b) => (a.dte ?? 9_999) - (b.dte ?? 9_999));
}

export function sizeFromHolding(
  holding: Pick<
    PortfolioHoldingWithPrices,
    "currentValue" | "profitLoss" | "portfolioPercent"
  >,
): HoldingExpandSize {
  return {
    value: holding.currentValue,
    profitLoss: holding.profitLoss,
    portfolioPercent: holding.portfolioPercent,
  };
}

function firstNumber(
  row: Record<string, unknown>,
  keys: string[],
): number | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function yearFromUnknown(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const year = Math.trunc(value);
    if (year >= 1900 && year <= 2100) return String(year);
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const match = value.trim().match(/^(\d{4})/);
  return match?.[1] ?? null;
}
