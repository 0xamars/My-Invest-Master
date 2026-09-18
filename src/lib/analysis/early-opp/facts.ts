/**
 * Facts pulled from loaded FMP snapshot / package. Missing stays null.
 * Never invent a figure that is not on the payload.
 */
import type { InvestSalsaRating } from "@/lib/analysis/rating/types";
import type { AnalysisPackage } from "@/lib/market-data/warehouse/types";
import { asReturnRatio } from "@/lib/ticker/score";
import { yoyChange } from "@/lib/ticker/pick";
import type { TickerSnapshot, TickerStatementYear } from "@/lib/ticker/types";

export type EarlyOppFacts = {
  symbol: string;
  name: string | null;
  sector: string | null;
  industry: string | null;
  description: string | null;
  price: number | null;
  changePercent: number | null;
  marketCap: number | null;
  volume: number | null;
  averageVolume: number | null;
  revenue: number | null;
  revenuePrior: number | null;
  revenueGrowth: number | null;
  revenueCagr3y: number | null;
  revenueYears: number;
  revenueAccelerating: boolean | null;
  netIncome: number | null;
  fcf: number | null;
  fcfPrior: number | null;
  fcfGrowth: number | null;
  ocf: number | null;
  capex: number | null;
  capexPrior: number | null;
  capexAbs: number | null;
  capexRising: boolean | null;
  capexToSales: number | null;
  capexToSalesPrior: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  fcfMargin: number | null;
  marginsCollapsing: boolean | null;
  roic: number | null;
  roe: number | null;
  pegRatio: number | null;
  trailingPe: number | null;
  forwardPe: number | null;
  debtToEquity: number | null;
  debtToRevenue: number | null;
  totalDebt: number | null;
  totalCash: number | null;
  shareCountChange: number | null;
  sbcVsNetIncome: number | null;
  stockBasedCompensation: number | null;
  ruleOf40: number | null;
  ratingScore: number | null;
  ratingLabel: string | null;
  growthPillar: number | null;
  financialStrengthPillar: number | null;
  profitabilityPillar: number | null;
  valuationPillar: number | null;
  criticalFlags: string[];
  vehicleNonOperating: boolean;
  techZone: string | null;
  techZoneId: string | null;
  techHeat: string | null;
  targetConsensus: number | null;
  targetHigh: number | null;
  targetLow: number | null;
  streetConsensus: string | null;
  streetBuyCount: number | null;
  streetHoldCount: number | null;
  streetSellCount: number | null;
  targetUpsidePct: number | null;
  insiderSummaries: string[];
  insiderTone: "buy" | "sell" | "mixed" | "none";
};

function presentYears(
  years: TickerStatementYear[],
  key: keyof TickerStatementYear,
): Array<{ year: string; value: number }> {
  const out: Array<{ year: string; value: number }> = [];
  for (const row of years) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value) && row.fiscalYear) {
      out.push({ year: row.fiscalYear, value });
    }
  }
  return out;
}

function cagr(newest: number, oldest: number, periods: number): number | null {
  if (periods <= 0 || oldest <= 0 || newest <= 0) return null;
  const value = Math.pow(newest / oldest, 1 / periods) - 1;
  return Number.isFinite(value) ? value : null;
}

function capexAbs(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.abs(value);
}

function field(
  fields: { label: string; value: number | null }[],
  label: string,
): number | null {
  return fields.find((item) => item.label === label)?.value ?? null;
}

function pillar(
  rating: InvestSalsaRating | null,
  id: "financial_strength" | "profitability" | "growth" | "valuation",
): number | null {
  return rating?.fundamental.pillars.find((item) => item.id === id)?.score ?? null;
}

function classifyInsider(
  summaries: string[],
): EarlyOppFacts["insiderTone"] {
  if (summaries.length === 0) return "none";
  const blob = summaries.join(" ").toLowerCase();
  const buy = /\bbuy|bought|purchase|acquiring|acquired\b/.test(blob);
  const sell = /\bsell|sold|sale|dump|disposed|disposing\b/.test(blob);
  if (buy && sell) return "mixed";
  if (buy) return "buy";
  if (sell) return "sell";
  return "mixed";
}

export function extractEarlyOppFacts(input: {
  snapshot: TickerSnapshot;
  pkg: AnalysisPackage | null;
  rating: InvestSalsaRating | null;
}): EarlyOppFacts {
  const { snapshot, pkg, rating } = input;
  const years = snapshot.years;
  const revenues = presentYears(years, "revenue");
  const fcfs = presentYears(years, "freeCashFlow");
  const capexes = presentYears(years, "capex");
  const grosses = presentYears(years, "grossProfit");

  const revenue = revenues[0]?.value ?? field(snapshot.income, "Revenue");
  const revenuePrior = revenues[1]?.value ?? null;
  const fcf = fcfs[0]?.value ?? field(snapshot.cashflow, "Free cash flow");
  const fcfPrior = fcfs[1]?.value ?? null;
  const capex = capexes[0]?.value ?? field(snapshot.cashflow, "Capital expenditure");
  const capexPrior = capexes[1]?.value ?? null;
  const capexAbsLatest = capexAbs(capex);
  const capexAbsPrior = capexAbs(capexPrior);

  const fund = pkg?.fundamentals ?? null;
  const revenueGrowth =
    asReturnRatio(fund?.revenueGrowth ?? field(snapshot.growth, "Revenue growth"));
  const fcfGrowth =
    asReturnRatio(fund?.fcfGrowth ?? field(snapshot.growth, "FCF growth"));

  let revenueCagr3y = asReturnRatio(fund?.revenueGrowth3y ?? null);
  if (revenueCagr3y == null && revenues.length >= 4) {
    const newest = revenues[0].value;
    const oldest = revenues[3].value;
    revenueCagr3y = cagr(newest, oldest, 3);
  } else if (revenueCagr3y == null && revenues.length >= 3) {
    revenueCagr3y = cagr(revenues[0].value, revenues[2].value, 2);
  }

  let revenueAccelerating: boolean | null = null;
  if (revenues.length >= 3) {
    const recent = yoyChange(revenues[0].value, revenues[1].value);
    const prior = yoyChange(revenues[1].value, revenues[2].value);
    if (recent != null && prior != null) {
      revenueAccelerating = recent > prior;
    }
  }

  let capexRising: boolean | null = null;
  if (capexAbsLatest != null && capexAbsPrior != null) {
    capexRising = capexAbsLatest > capexAbsPrior;
  }

  const capexToSales =
    capexAbsLatest != null && revenue != null && revenue > 0
      ? capexAbsLatest / revenue
      : null;
  const capexToSalesPrior =
    capexAbsPrior != null && revenuePrior != null && revenuePrior > 0
      ? capexAbsPrior / revenuePrior
      : null;

  const grossMargin = asReturnRatio(fund?.grossMargins ?? field(snapshot.margins, "Gross margin"));
  const operatingMargin = asReturnRatio(
    fund?.operatingMargins ?? field(snapshot.margins, "Operating margin"),
  );
  const netMargin = asReturnRatio(fund?.profitMargins ?? field(snapshot.margins, "Net margin"));
  const fcfMargin = asReturnRatio(fund?.fcfMargin ?? field(snapshot.margins, "FCF margin"));

  let marginsCollapsing: boolean | null = null;
  if (revenues.length >= 2 && grosses.length >= 2) {
    const newerGm = revenues[0].value > 0 ? grosses[0].value / revenues[0].value : null;
    const olderRow = years.find((row) => row.fiscalYear === revenues[1].year);
    const olderRev = revenues[1].value;
    const olderGp = olderRow?.grossProfit ?? null;
    const olderGm = olderRev > 0 && olderGp != null ? olderGp / olderRev : null;
    const revUp = revenues[0].value > revenues[1].value;
    if (newerGm != null && olderGm != null && revUp) {
      marginsCollapsing = newerGm < olderGm - 0.04;
    }
  }

  const roic = asReturnRatio(fund?.returnOnInvestedCapital ?? field(snapshot.keyMetrics, "ROIC"));
  const roe = asReturnRatio(fund?.returnOnEquity ?? field(snapshot.keyMetrics, "ROE"));
  const pegRatio =
    fund?.pegRatio != null && Number.isFinite(fund.pegRatio) && fund.pegRatio > 0
      ? fund.pegRatio
      : null;

  const shareCountChange = asReturnRatio(snapshot.past.shareCountChange);
  const sbcVsNetIncome = asReturnRatio(snapshot.past.sbcVsNetIncome);

  const growthPct = revenueGrowth != null ? revenueGrowth * 100 : null;
  const fcfOrOp =
    fcfMargin != null ? fcfMargin * 100 : operatingMargin != null ? operatingMargin * 100 : null;
  const ruleOf40 =
    growthPct != null && fcfOrOp != null && Number.isFinite(growthPct + fcfOrOp)
      ? growthPct + fcfOrOp
      : null;

  const street = snapshot.street;
  const target =
    street.targetConsensus ??
    pkg?.forecast.priceTarget?.average ??
    null;
  const price = snapshot.quote.price;
  const targetUpsidePct =
    target != null && price != null && price > 0
      ? (target - price) / price
      : null;

  const buyCount =
    (street.strongBuy ?? 0) + (street.buy ?? 0) ||
    (pkg?.forecast.ratings
      ? pkg.forecast.ratings.strongBuy + pkg.forecast.ratings.buy
      : null);
  const holdCount =
    street.hold ?? pkg?.forecast.ratings?.hold ?? null;
  const sellCount =
    (street.sell ?? 0) + (street.strongSell ?? 0) ||
    (pkg?.forecast.ratings
      ? pkg.forecast.ratings.sell + pkg.forecast.ratings.strongSell
      : null);

  const insiderSummaries = (pkg?.recentEvents ?? [])
    .filter((event) => event.type === "insider" && event.summary.trim())
    .map((event) => event.summary.trim());

  return {
    symbol: snapshot.symbol,
    name: snapshot.profile.name,
    sector: snapshot.profile.sector ?? fund?.sector ?? null,
    industry: snapshot.profile.industry ?? fund?.industry ?? null,
    description: snapshot.profile.description,
    price,
    changePercent: snapshot.quote.changePercent,
    marketCap: snapshot.quote.marketCap,
    volume: snapshot.quote.volume,
    averageVolume: snapshot.quote.averageVolume,
    revenue,
    revenuePrior,
    revenueGrowth,
    revenueCagr3y,
    revenueYears: revenues.length,
    revenueAccelerating,
    netIncome: field(snapshot.income, "Net income") ?? years[0]?.netIncome ?? null,
    fcf,
    fcfPrior,
    fcfGrowth,
    ocf: field(snapshot.cashflow, "Operating cash flow") ?? fund?.operatingCashflow ?? null,
    capex,
    capexPrior,
    capexAbs: capexAbsLatest,
    capexRising,
    capexToSales,
    capexToSalesPrior,
    grossMargin,
    operatingMargin,
    netMargin,
    fcfMargin,
    marginsCollapsing,
    roic,
    roe,
    pegRatio,
    trailingPe: fund?.trailingPE ?? field(snapshot.keyMetrics, "P/E"),
    forwardPe: fund?.forwardPE ?? pkg?.estimateOutlook.forwardPe ?? null,
    debtToEquity: asReturnRatio(
      fund?.debtToEquity ?? field(snapshot.keyMetrics, "Debt / equity"),
    ),
    debtToRevenue: asReturnRatio(fund?.debtToRevenue ?? null),
    totalDebt: fund?.totalDebt ?? field(snapshot.balance, "Total debt"),
    totalCash: fund?.totalCash ?? field(snapshot.balance, "Cash"),
    shareCountChange,
    sbcVsNetIncome,
    stockBasedCompensation: snapshot.past.stockBasedCompensation,
    ruleOf40,
    ratingScore: rating?.score ?? null,
    ratingLabel: rating?.label ?? null,
    growthPillar: pillar(rating, "growth"),
    financialStrengthPillar: pillar(rating, "financial_strength"),
    profitabilityPillar: pillar(rating, "profitability"),
    valuationPillar: pillar(rating, "valuation"),
    criticalFlags: rating?.fundamental.classification.criticalFlags ?? [],
    vehicleNonOperating: Boolean(rating?.fundamental.nonOperatingVehicle),
    techZone: rating?.technical.fib.zoneLabel ?? null,
    techZoneId: rating?.technical.fib.zone ?? null,
    techHeat: rating?.technical.daily.heatLabel ?? null,
    targetConsensus: target,
    targetHigh: street.targetHigh ?? pkg?.forecast.priceTarget?.high ?? null,
    targetLow: street.targetLow ?? pkg?.forecast.priceTarget?.low ?? null,
    streetConsensus: street.consensus ?? pkg?.forecast.ratings?.consensus ?? null,
    streetBuyCount: buyCount === 0 ? null : buyCount,
    streetHoldCount: holdCount,
    streetSellCount: sellCount === 0 ? null : sellCount,
    targetUpsidePct,
    insiderSummaries,
    insiderTone: classifyInsider(insiderSummaries),
  };
}
