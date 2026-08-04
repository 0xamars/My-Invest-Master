import type { FundamentalInputs } from "@/lib/analysis/rating/types";
import { fmpFetch, num, str } from "@/lib/market-data/fmp/client";
import { fetchFmpProfile } from "@/lib/market-data/fmp/profile";

type Row = Record<string, unknown>;

function first(rows: Row[] | null | undefined): Row | null {
  return Array.isArray(rows) && rows.length > 0 ? rows[0]! : null;
}

function pick(row: Row | null, ...keys: string[]): number | null {
  if (!row) return null;
  for (const key of keys) {
    const v = num(row[key]);
    if (v != null) return v;
    // Stable TTM endpoints often drop the TTM suffix vs legacy v3
    if (key.endsWith("TTM")) {
      const base = key.slice(0, -3);
      const alt = num(row[base]);
      if (alt != null) return alt;
    } else {
      const withTtm = num(row[`${key}TTM`]);
      if (withTtm != null) return withTtm;
    }
  }
  return null;
}

/** Altman Z-Score (original manufacturing form) when components are available. */
export function computeAltmanZ(input: {
  workingCapital: number | null;
  totalAssets: number | null;
  retainedEarnings: number | null;
  ebit: number | null;
  marketCap: number | null;
  totalLiabilities: number | null;
  revenue: number | null;
}): number | null {
  const {
    workingCapital,
    totalAssets,
    retainedEarnings,
    ebit,
    marketCap,
    totalLiabilities,
    revenue,
  } = input;
  if (
    totalAssets == null ||
    totalAssets <= 0 ||
    workingCapital == null ||
    retainedEarnings == null ||
    ebit == null ||
    marketCap == null ||
    totalLiabilities == null ||
    totalLiabilities <= 0 ||
    revenue == null
  ) {
    return null;
  }
  const a = workingCapital / totalAssets;
  const b = retainedEarnings / totalAssets;
  const c = ebit / totalAssets;
  const d = marketCap / totalLiabilities;
  const e = revenue / totalAssets;
  const z = 1.2 * a + 1.4 * b + 3.3 * c + 0.6 * d + 1.0 * e;
  return Number.isFinite(z) ? z : null;
}

function fcfStabilityScore(fcfSeries: number[]): number | null {
  if (fcfSeries.length < 2) return null;
  const positiveYears = fcfSeries.filter((v) => v > 0).length;
  const ratio = positiveYears / fcfSeries.length;
  // Also reward low volatility of positive FCF
  const mean =
    fcfSeries.reduce((s, v) => s + v, 0) / fcfSeries.length;
  if (mean === 0) return ratio * 50;
  const variance =
    fcfSeries.reduce((s, v) => s + (v - mean) ** 2, 0) /
    fcfSeries.length;
  const cv = Math.sqrt(variance) / Math.abs(mean);
  const stability = Math.max(0, 1 - Math.min(cv, 2) / 2);
  return Math.round((0.6 * ratio + 0.4 * stability) * 100);
}

/** Annual ROIC from paired income + balance rows (never fabricated). */
function annualRoic(inc: Row | null, bal: Row | null): number | null {
  const ebit = pick(inc, "operatingIncome", "ebit");
  if (ebit == null) return null;
  const pretax = pick(inc, "incomeBeforeTax");
  const tax = pick(inc, "incomeTaxExpense");
  let taxRate = 0.21;
  if (pretax != null && pretax > 0 && tax != null) {
    taxRate = Math.min(0.4, Math.max(0, tax / pretax));
  } else if (ebit < 0) {
    taxRate = 0;
  }
  const nopat = ebit * (1 - taxRate);
  const equity = pick(bal, "totalStockholdersEquity", "totalEquity");
  if (equity == null) return null;
  const debt =
    pick(bal, "totalDebt") ??
    (() => {
      const shortD = pick(bal, "shortTermDebt");
      const longD = pick(bal, "longTermDebt");
      if (shortD == null && longD == null) return null;
      return (shortD ?? 0) + (longD ?? 0);
    })();
  const cash = pick(
    bal,
    "cashAndCashEquivalents",
    "cashAndShortTermInvestments",
  );
  const invested = equity + (debt ?? 0) - (cash ?? 0);
  if (invested <= 0) return null;
  const roic = nopat / invested;
  return Number.isFinite(roic) ? roic : null;
}

function statementMargin(
  inc: Row | null,
  kind: "gross" | "operating" | "net",
): number | null {
  const revenue = pick(inc, "revenue");
  if (revenue == null || revenue === 0) return null;
  const num =
    kind === "gross"
      ? pick(inc, "grossProfit")
      : kind === "operating"
        ? pick(inc, "operatingIncome", "ebit")
        : pick(inc, "netIncome");
  if (num == null) return null;
  const m = num / revenue;
  return Number.isFinite(m) ? m : null;
}

function trendDelta(series: Array<number | null>): number | null {
  const clean = series.filter((v): v is number => v != null);
  if (clean.length < 2) return null;
  // series[0] is latest; compare vs oldest in first 3
  return clean[0]! - clean[clean.length - 1]!;
}

async function safeFetch<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export async function fetchFmpFundamentals(
  symbol: string,
): Promise<FundamentalInputs | null> {
  const upper = symbol.toUpperCase();
  const profile = await fetchFmpProfile(upper);
  if (!profile) {
    // Profile missing usually means bad symbol or FMP unavailable
    return null;
  }

  const [
    ratiosTtm,
    metricsTtm,
    income,
    balance,
    cashflow,
    scores,
    estimates,
  ] = await Promise.all([
    safeFetch(
      () =>
        fmpFetch<Row[]>({
          path: "/ratios-ttm",
          query: { symbol: upper },
          revalidate: 3600,
        }),
      [],
    ),
    safeFetch(
      () =>
        fmpFetch<Row[]>({
          path: "/key-metrics-ttm",
          query: { symbol: upper },
          revalidate: 3600,
        }),
      [],
    ),
    safeFetch(
      () =>
        fmpFetch<Row[]>({
          path: "/income-statement",
          query: { symbol: upper, period: "annual", limit: 5 },
          revalidate: 3600,
        }),
      [],
    ),
    safeFetch(
      () =>
        fmpFetch<Row[]>({
          path: "/balance-sheet-statement",
          query: { symbol: upper, period: "annual", limit: 5 },
          revalidate: 3600,
        }),
      [],
    ),
    safeFetch(
      () =>
        fmpFetch<Row[]>({
          path: "/cash-flow-statement",
          query: { symbol: upper, period: "annual", limit: 5 },
          revalidate: 3600,
        }),
      [],
    ),
    safeFetch(
      () =>
        fmpFetch<Row[]>({
          path: "/financial-scores",
          query: { symbol: upper },
          revalidate: 3600,
        }),
      [],
    ),
    // Skip analyst-estimates by default — optional for outlook; saves rate limit.
    Promise.resolve([] as Row[]),
  ]);

  const ratios = first(ratiosTtm);
  const metrics = first(metricsTtm);
  const inc0 = first(income);
  const bal0 = first(balance);
  const cf0 = first(cashflow);
  const scoreRow = first(scores);

  const totalRevenue =
    pick(inc0, "revenue") ?? pick(metrics, "revenuePerShareTTM");
  const ebitda = pick(inc0, "ebitda") ?? pick(metrics, "ebitdaTTM");
  const ebit =
    pick(inc0, "operatingIncome", "ebit") ??
    (totalRevenue != null && pick(ratios, "operatingProfitMarginTTM") != null
      ? totalRevenue * pick(ratios, "operatingProfitMarginTTM")!
      : null);

  const totalDebt =
    pick(bal0, "totalDebt") ??
    (() => {
      const shortD = pick(bal0, "shortTermDebt", "shortTermInvestments");
      const longD = pick(bal0, "longTermDebt");
      if (shortD == null && longD == null) return null;
      return (shortD ?? 0) + (longD ?? 0);
    })();
  const totalCash = pick(
    bal0,
    "cashAndCashEquivalents",
    "cashAndShortTermInvestments",
  );
  const totalAssets = pick(bal0, "totalAssets");
  const totalEquity = pick(
    bal0,
    "totalStockholdersEquity",
    "totalEquity",
  );
  const totalLiabilities = pick(bal0, "totalLiabilities");
  const currentAssets = pick(bal0, "totalCurrentAssets");
  const currentLiabilities = pick(bal0, "totalCurrentLiabilities");
  const retainedEarnings = pick(bal0, "retainedEarnings");
  const shortTermDebt = pick(bal0, "shortTermDebt");
  const workingCapital =
    currentAssets != null && currentLiabilities != null
      ? currentAssets - currentLiabilities
      : null;

  const freeCashflow =
    pick(cf0, "freeCashFlow") ??
    (() => {
      const ocf = pick(cf0, "operatingCashFlow");
      const capex = pick(cf0, "capitalExpenditure");
      if (ocf == null || capex == null) return null;
      return ocf + capex; // capex usually negative
    })();
  const operatingCashflow = pick(cf0, "operatingCashFlow");

  const fcfSeries = (Array.isArray(cashflow) ? cashflow : [])
    .map((row) => pick(row, "freeCashFlow"))
    .filter((v): v is number => v != null)
    .slice(0, 5);
  const fcfStability = fcfStabilityScore(fcfSeries);

  let fcfGrowth: number | null = null;
  if (fcfSeries.length >= 2 && fcfSeries[1] !== 0) {
    fcfGrowth = (fcfSeries[0]! - fcfSeries[1]!) / Math.abs(fcfSeries[1]!);
  }

  const marketCap = profile.marketCap;
  const altmanFromScore = pick(scoreRow, "altmanZScore", "altmanZ");
  const altmanZ =
    altmanFromScore ??
    computeAltmanZ({
      workingCapital,
      totalAssets,
      retainedEarnings,
      ebit,
      marketCap,
      totalLiabilities,
      revenue: totalRevenue,
    });

  const piotroskiScore =
    pick(scoreRow, "piotroskiScore", "piotroski") ??
    pick(metrics, "piotroskiScoreTTM");
  const beneishMScore = pick(
    scoreRow,
    "beneishScore",
    "beneishMScore",
    "mScore",
  );

  const debtToEquity =
    pick(ratios, "debtEquityRatioTTM", "debtToEquityTTM") ??
    (totalDebt != null && totalEquity != null && totalEquity !== 0
      ? (totalDebt / totalEquity) * 100
      : null);

  // Normalize: FMP ratios often as 0.78 not 78; Yahoo used percent-like. Keep percent-like if > 5.
  const debtToEquityPct =
    debtToEquity != null && Math.abs(debtToEquity) < 5
      ? debtToEquity * 100
      : debtToEquity;

  const currentRatio =
    pick(ratios, "currentRatioTTM") ??
    (currentAssets != null &&
    currentLiabilities != null &&
    currentLiabilities !== 0
      ? currentAssets / currentLiabilities
      : null);
  const quickRatio = pick(ratios, "quickRatioTTM");

  const interestExpense = pick(inc0, "interestExpense");
  const interestCoverage =
    pick(ratios, "interestCoverageTTM") ??
    (ebit != null && interestExpense != null && interestExpense !== 0
      ? Math.abs(ebit / interestExpense)
      : null);

  const netDebtToEbitda =
    pick(metrics, "netDebtToEBITDATTM") ??
    (totalDebt != null &&
    totalCash != null &&
    ebitda != null &&
    ebitda !== 0
      ? (totalDebt - totalCash) / ebitda
      : null);
  const debtToEbitda =
    pick(metrics, "debtToEbitdaTTM") ??
    (totalDebt != null && ebitda != null && ebitda !== 0
      ? totalDebt / ebitda
      : null);

  const equityToAssets =
    totalEquity != null && totalAssets != null && totalAssets !== 0
      ? totalEquity / totalAssets
      : null;

  const cashToDebt =
    totalCash != null && totalDebt != null && totalDebt > 0
      ? totalCash / totalDebt
      : totalCash != null && totalDebt === 0
        ? // Unlevered with cash — treat as strong coverage (not invented debt)
          Math.max(totalCash > 0 ? 10 : 0, 0)
        : null;
  const cashToShortTermDebt =
    totalCash != null && shortTermDebt != null && shortTermDebt > 0
      ? totalCash / shortTermDebt
      : null;

  const fcfToDebt =
    freeCashflow != null && totalDebt != null && totalDebt > 0
      ? freeCashflow / totalDebt
      : null;

  const returnOnInvestedCapital =
    pick(metrics, "roicTTM", "returnOnInvestedCapitalTTM") ??
    pick(ratios, "returnOnCapitalEmployedTTM") ??
    annualRoic(inc0, bal0);
  const wacc = pick(metrics, "waccTTM", "weightedAverageCostOfCapitalTTM");

  const grossMargins =
    pick(ratios, "grossProfitMarginTTM") ?? statementMargin(inc0, "gross");
  const operatingMargins =
    pick(ratios, "operatingProfitMarginTTM") ??
    statementMargin(inc0, "operating");
  const profitMargins =
    pick(ratios, "netProfitMarginTTM") ?? statementMargin(inc0, "net");
  const returnOnEquity = pick(ratios, "returnOnEquityTTM");
  const returnOnAssets = pick(ratios, "returnOnAssetsTTM");

  const revenueForMargins = pick(inc0, "revenue") ?? totalRevenue;
  const ebitdaMargin =
    ebitda != null && revenueForMargins != null && revenueForMargins !== 0
      ? ebitda / revenueForMargins
      : pick(ratios, "ebitdaMarginTTM");
  const fcfMargin =
    freeCashflow != null &&
    revenueForMargins != null &&
    revenueForMargins !== 0
      ? freeCashflow / revenueForMargins
      : null;
  const ocfMargin =
    operatingCashflow != null &&
    revenueForMargins != null &&
    revenueForMargins !== 0
      ? operatingCashflow / revenueForMargins
      : null;

  // Multi-year profitability persistence (up to 3 annual periods)
  const incomeRows = Array.isArray(income) ? income.slice(0, 3) : [];
  const balanceRows = Array.isArray(balance) ? balance.slice(0, 3) : [];
  const annualRoics = incomeRows.map((inc, i) =>
    annualRoic(inc, balanceRows[i] ?? null),
  );
  const roicClean = annualRoics.filter((v): v is number => v != null);
  const returnOnInvestedCapital3y =
    roicClean.length >= 2
      ? roicClean.reduce((a, b) => a + b, 0) / roicClean.length
      : null;
  const roicTrend = trendDelta(annualRoics);
  const operatingMarginTrend = trendDelta(
    incomeRows.map((inc) => statementMargin(inc, "operating")),
  );
  const grossMarginTrend = trendDelta(
    incomeRows.map((inc) => statementMargin(inc, "gross")),
  );
  const netMarginTrend = trendDelta(
    incomeRows.map((inc) => statementMargin(inc, "net")),
  );

  const trailingPE = pick(ratios, "peRatioTTM", "priceEarningsRatioTTM");
  const forwardPE = pick(metrics, "forwardPERatioTTM");
  const enterpriseValue =
    pick(metrics, "enterpriseValueTTM", "enterpriseValue") ??
    (marketCap != null
      ? marketCap + (totalDebt ?? 0) - (totalCash ?? 0)
      : null);
  const enterpriseToEbitda =
    pick(
      metrics,
      "enterpriseValueOverEBITDATTM",
      "evToEBITDATTM",
    ) ??
    (enterpriseValue != null && ebitda != null && ebitda > 0
      ? enterpriseValue / ebitda
      : null);
  const priceToSales = pick(ratios, "priceToSalesRatioTTM");
  const priceToFcf =
    pick(ratios, "priceToFreeCashFlowsRatioTTM") ??
    (marketCap != null && freeCashflow != null && freeCashflow > 0
      ? marketCap / freeCashflow
      : null);
  const pegRatio = pick(ratios, "pegRatioTTM") ?? pick(metrics, "pegRatioTTM");
  const evToFcf =
    pick(metrics, "evToFreeCashFlowTTM", "evToFCFTTM") ??
    (enterpriseValue != null && freeCashflow != null && freeCashflow > 0
      ? enterpriseValue / freeCashflow
      : null);
  const revenueForEv =
    pick(inc0, "revenue") ?? totalRevenue;
  const evToSales =
    pick(metrics, "evToSalesTTM", "enterpriseValueOverRevenueTTM") ??
    (enterpriseValue != null &&
    revenueForEv != null &&
    revenueForEv > 0
      ? enterpriseValue / revenueForEv
      : null);
  const priceToOcf =
    pick(ratios, "priceToOperatingCashFlowsRatioTTM") ??
    (marketCap != null &&
    operatingCashflow != null &&
    operatingCashflow > 0
      ? marketCap / operatingCashflow
      : null);
  const evToEbit =
    pick(metrics, "evToEBITTTM", "enterpriseValueOverEBITTTM") ??
    (enterpriseValue != null && ebit != null && ebit > 0
      ? enterpriseValue / ebit
      : null);
  const trailingPeMedian5y = null; // optional history — omit to avoid extra FMP calls

  // Growth from statements YoY
  const rev0 = pick(inc0, "revenue");
  const rev1 = pick(income[1] ?? null, "revenue");
  const revenueGrowth =
    rev0 != null && rev1 != null && rev1 !== 0
      ? (rev0 - rev1) / Math.abs(rev1)
      : null;
  const eps0 = pick(inc0, "epsdiluted", "eps");
  const eps1 = pick(income[1] ?? null, "epsdiluted", "eps");
  const earningsGrowth =
    eps0 != null && eps1 != null && eps1 !== 0
      ? (eps0 - eps1) / Math.abs(eps1)
      : null;

  const est0 = first(estimates);
  const revenueEstimateGrowth = pick(
    est0,
    "revenueAvg",
  ) != null &&
  rev0 != null &&
  rev0 !== 0 &&
  pick(est0, "revenueAvg") != null
    ? (pick(est0, "revenueAvg")! - rev0) / Math.abs(rev0)
    : null;
  const earningsEstimateGrowth = null; // keep null unless clear EPS estimate growth field

  const bookValue = pick(metrics, "bookValuePerShareTTM");
  // Prefer income-statement diluted shares; key-metrics numberOfShares is often unreliable.
  const sharesOutstanding =
    pick(
      inc0,
      "weightedAverageShsOutDil",
      "weightedAverageShsOutDiluted",
      "weightedAverageShsOut",
    ) ?? pick(metrics, "numberOfShares");

  const capitalExpenditure = pick(cf0, "capitalExpenditure");
  const researchAndDevelopment = pick(
    inc0,
    "researchAndDevelopmentExpenses",
    "researchAndDevelopment",
  );
  const grossProfit =
    pick(inc0, "grossProfit") ??
    (pick(inc0, "revenue") != null && pick(inc0, "grossProfitRatio") != null
      ? pick(inc0, "revenue")! * pick(inc0, "grossProfitRatio")!
      : null);
  const grossProfitPrior = pick(income[1] ?? null, "grossProfit");

  return {
    debtToEquity: debtToEquityPct,
    currentRatio,
    quickRatio,
    freeCashflow,
    operatingCashflow,
    totalDebt,
    totalCash,
    ebitda,
    totalRevenue: rev0 ?? totalRevenue,
    bookValue,
    sharesOutstanding,
    grossMargins,
    operatingMargins,
    profitMargins,
    returnOnEquity,
    returnOnAssets,
    returnOnInvestedCapital,
    revenueGrowth,
    earningsGrowth,
    fcfGrowth,
    operatingIncomeGrowth: null,
    revenueGrowth3y: null,
    earningsGrowth3y: null,
    operatingGrowth3y: null,
    revenueEstimateGrowth,
    earningsEstimateGrowth,
    trailingPE,
    forwardPE,
    enterpriseToEbitda,
    priceToSales,
    priceToFcf,
    pegRatio,
    marketCap,
    recommendationKey: null,
    sector: profile.sector,
    sectorKey: profile.sectorKey,
    industry: profile.industry,
    industryKey: profile.industryKey,
    dataAsOf: new Date().toISOString(),
    // v1.2 FS fields
    equityToAssets,
    interestCoverage,
    netDebtToEbitda,
    debtToEbitda,
    cashToDebt,
    cashToShortTermDebt,
    fcfToDebt,
    fcfStability,
    altmanZScore: altmanZ,
    piotroskiScore,
    beneishMScore,
    wacc,
    ebit,
    totalAssets,
    workingCapital,
    ebitdaMargin,
    fcfMargin,
    ocfMargin,
    cashFlowReliable: true,
    cashFlowNote: null,
    returnOnInvestedCapital3y,
    operatingMarginTrend,
    grossMarginTrend,
    netMarginTrend,
    roicTrend,
    enterpriseValue,
    evToFcf,
    evToSales,
    priceToOcf,
    evToEbit,
    trailingPeMedian5y,
    capitalExpenditure,
    researchAndDevelopment,
    grossProfit,
    grossProfitPrior,
    dataSource: "fmp",
  };
}
