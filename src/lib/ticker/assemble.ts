import {
  asBool,
  field,
  firstRow,
  fiscalYearLabel,
  num,
  pick,
  ratio,
  str,
  yoyChange,
} from "@/lib/ticker/pick";
import { buildStatementCharts, buildTickerScore } from "@/lib/ticker/score";
import type {
  TickerBundle,
  TickerCacheStatus,
  TickerSnapshot,
  TickerStatementYear,
} from "@/lib/ticker/types";

function moneyFields(
  items: Array<[string, number | null]>,
) {
  return items.map(([label, value]) => field(label, value, "money"));
}

export function assembleTickerSnapshot(
  symbol: string,
  bundle: TickerBundle,
  cache: {
    status: TickerCacheStatus;
    fromCache: boolean;
    fmpHit: boolean;
    fetchedAtMs: number;
    freshUntilMs: number;
    staleUntilMs: number;
  },
): TickerSnapshot {
  const profile = bundle.profile;
  const quote = bundle.quote;
  const income0 = firstRow(bundle.incomeAnnual);
  const income1 = bundle.incomeAnnual[1] ?? null;
  const balance0 = firstRow(bundle.balanceAnnual);
  const cashflow0 = firstRow(bundle.cashflowAnnual);
  const cashflow1 = bundle.cashflowAnnual[1] ?? null;
  const metrics = bundle.keyMetricsTtm;
  const ratios = bundle.ratiosTtm;
  const growth = bundle.growth;
  const estimate = firstFutureOrLatestEstimate(bundle.estimates);

  const name =
    str(profile?.companyName) ??
    str(profile?.name) ??
    str(quote?.name) ??
    null;
  const price = pick(quote, "price") ?? pick(profile, "price");
  const marketCap =
    pick(quote, "marketCap", "mktCap") ?? pick(profile, "mktCap", "marketCap");

  const revenue = pick(income0, "revenue");
  const grossProfit = pick(income0, "grossProfit");
  const operatingIncome = pick(income0, "operatingIncome", "ebit");
  const netIncome = pick(income0, "netIncome");
  const ocf = pick(cashflow0, "operatingCashFlow");
  const fcf = pick(cashflow0, "freeCashFlow");
  const sharesOut =
    pick(income0, "weightedAverageShsOut") ??
    pick(metrics, "weightedAverageShsOut", "sharesOutstanding");
  const sharesDiluted = pick(
    income0,
    "weightedAverageShsOutDil",
    "weightedAverageShsOutDiluted",
  );
  const priorShares = pick(income1, "weightedAverageShsOut");

  const found = Boolean(profile || (quote && price != null));

  const years = buildYears(
    bundle.incomeAnnual,
    bundle.cashflowAnnual,
    bundle.balanceAnnual,
  );
  const scored = buildTickerScore(bundle);
  const charts = buildStatementCharts(bundle);

  return {
    symbol,
    source: "fmp",
    found,
    fetchedAt: new Date(cache.fetchedAtMs).toISOString(),
    cache: {
      status: cache.status,
      fromCache: cache.fromCache,
      fmpHit: cache.fmpHit,
      freshUntil: new Date(cache.freshUntilMs).toISOString(),
      staleUntil: new Date(cache.staleUntilMs).toISOString(),
    },
    profile: {
      name,
      exchange:
        str(profile?.exchangeShortName) ??
        str(profile?.exchange) ??
        str(quote?.exchange) ??
        null,
      currency:
        str(quote?.currency) ?? str(profile?.currency) ?? null,
      sector: str(profile?.sector),
      industry: str(profile?.industry),
      country: str(profile?.country),
      description: str(profile?.description),
      ceo: str(profile?.ceo) ?? str(profile?.ceoName),
      website: str(profile?.website),
      ipoDate: str(profile?.ipoDate),
      employees: pick(profile, "fullTimeEmployees", "employees"),
      isEtf: asBool(profile?.isEtf) ?? asBool(profile?.isETF),
      isFund: asBool(profile?.isFund) ?? asBool(profile?.isMutualFund),
    },
    quote: {
      price,
      change: pick(quote, "change"),
      changePercent: pick(
        quote,
        "changesPercentage",
        "changePercentage",
        "changePercent",
      ),
      marketCap,
      volume: pick(quote, "volume"),
      averageVolume: pick(quote, "avgVolume", "avVolume", "averageVolume"),
      dayLow: pick(quote, "dayLow"),
      dayHigh: pick(quote, "dayHigh"),
      week52Low: pick(quote, "yearLow", "week52Low"),
      week52High: pick(quote, "yearHigh", "week52High"),
      beta: pick(profile, "beta") ?? pick(metrics, "beta"),
    },
    keyMetrics: [
      field(
        "P/E",
        pick(metrics, "peRatio", "peRatioTTM") ??
          pick(ratios, "peRatio", "priceEarningsRatioTTM", "peRatioTTM"),
        "multiple",
      ),
      field(
        "P/S",
        pick(metrics, "priceToSalesRatio", "priceToSalesRatioTTM") ??
          pick(ratios, "priceToSalesRatio", "priceToSalesRatioTTM"),
        "multiple",
      ),
      field(
        "P/B",
        pick(metrics, "pbRatio", "pbRatioTTM") ??
          pick(ratios, "priceToBookRatio", "priceToBookRatioTTM"),
        "multiple",
      ),
      field(
        "EV / EBITDA",
        pick(metrics, "evToEBITDA", "enterpriseValueOverEBITDA") ??
          pick(ratios, "enterpriseValueOverEBITDA"),
        "multiple",
      ),
      field(
        "FCF yield",
        pick(metrics, "freeCashFlowYield", "freeCashFlowYieldTTM"),
        "percent",
      ),
      field(
        "ROE",
        pick(metrics, "roe", "roeTTM") ??
          pick(ratios, "returnOnEquity", "returnOnEquityTTM"),
        "percent",
      ),
      field(
        "ROIC",
        pick(metrics, "roic", "roicTTM") ??
          pick(ratios, "returnOnCapitalEmployed", "returnOnCapitalEmployedTTM"),
        "percent",
      ),
      field(
        "Debt / equity",
        pick(metrics, "debtToEquity", "debtToEquityTTM") ??
          pick(ratios, "debtEquityRatio", "debtEquityRatioTTM"),
        "ratio",
      ),
      field(
        "Current ratio",
        pick(metrics, "currentRatio", "currentRatioTTM") ??
          pick(ratios, "currentRatio", "currentRatioTTM"),
        "ratio",
      ),
      field(
        "Dividend yield",
        pick(metrics, "dividendYield", "dividendYieldTTM") ??
          pick(ratios, "dividendYielPercentageTTM", "dividendYieldTTM"),
        "percent",
      ),
    ],
    income: moneyFields([
      ["Revenue", revenue],
      ["Gross profit", grossProfit],
      ["Operating income", operatingIncome],
      ["Net income", netIncome],
      ["EBITDA", pick(income0, "ebitda")],
    ]).concat([
      field("EPS", pick(income0, "eps", "epsdiluted"), "ratio"),
    ]),
    cashflow: moneyFields([
      ["Operating cash flow", ocf],
      ["Capital expenditure", pick(cashflow0, "capitalExpenditure")],
      ["Free cash flow", fcf],
      ["Dividends paid", pick(cashflow0, "dividendsPaid")],
      ["Stock issued", pick(cashflow0, "commonStockIssued")],
      ["Stock repurchased", pick(cashflow0, "commonStockRepurchased")],
    ]),
    balance: moneyFields([
      [
        "Cash",
        pick(
          balance0,
          "cashAndCashEquivalents",
          "cashAndShortTermInvestments",
        ),
      ],
      ["Total debt", pick(balance0, "totalDebt")],
      [
        "Equity",
        pick(balance0, "totalStockholdersEquity", "totalEquity"),
      ],
      ["Total assets", pick(balance0, "totalAssets")],
      ["Total liabilities", pick(balance0, "totalLiabilities")],
    ]),
    growth: [
      field(
        "Revenue growth",
        pick(growth, "revenueGrowth") ??
          yoyChange(revenue, pick(income1, "revenue")),
        "percent",
      ),
      field(
        "Earnings growth",
        pick(growth, "netIncomeGrowth") ??
          yoyChange(netIncome, pick(income1, "netIncome")),
        "percent",
      ),
      field(
        "EPS growth",
        pick(growth, "epsgrowth", "epsGrowth") ??
          yoyChange(pick(income0, "eps"), pick(income1, "eps")),
        "percent",
      ),
      field(
        "FCF growth",
        pick(growth, "freeCashFlowGrowth") ??
          yoyChange(fcf, pick(cashflow1, "freeCashFlow")),
        "percent",
      ),
    ],
    margins: [
      field(
        "Gross margin",
        pick(ratios, "grossProfitMargin", "grossProfitMarginTTM") ??
          ratio(grossProfit, revenue),
        "percent",
      ),
      field(
        "Operating margin",
        pick(ratios, "operatingProfitMargin", "operatingProfitMarginTTM") ??
          ratio(operatingIncome, revenue),
        "percent",
      ),
      field(
        "Net margin",
        pick(ratios, "netProfitMargin", "netProfitMarginTTM") ??
          ratio(netIncome, revenue),
        "percent",
      ),
      field("FCF margin", ratio(fcf, revenue), "percent"),
    ],
    shares: [
      field("Shares outstanding", sharesOut, "shares"),
      field("Diluted shares", sharesDiluted, "shares"),
      field("Share count YoY", yoyChange(sharesOut, priorShares), "percent"),
      field(
        "Stock issued",
        pick(cashflow0, "commonStockIssued"),
        "money",
      ),
      field(
        "Stock repurchased",
        pick(cashflow0, "commonStockRepurchased"),
        "money",
      ),
    ],
    estimates: [
      field(
        "Estimated revenue",
        pick(
          estimate,
          "estimatedRevenueAvg",
          "revenueAvg",
          "estimatedRevenue",
        ),
        "money",
      ),
      field(
        "Estimated EPS",
        pick(estimate, "estimatedEpsAvg", "epsAvg", "estimatedEps"),
        "ratio",
      ),
      field(
        "Revenue estimates",
        pick(
          estimate,
          "numberAnalystEstimatedRevenue",
          "numAnalystsRevenue",
          "numberAnalystsEstimatedRevenue",
        ),
        "count",
      ),
      field(
        "EPS estimates",
        pick(
          estimate,
          "numberAnalystsEstimatedEps",
          "numAnalystsEps",
          "numberAnalystEstimatedEps",
        ),
        "count",
      ),
    ],
    years,
    score: scored.score,
    past: scored.past,
    health: scored.health,
    charts,
  };
}

function firstFutureOrLatestEstimate(
  rows: Record<string, unknown>[],
): Record<string, unknown> | null {
  if (!rows.length) return null;
  const today = new Date().toISOString().slice(0, 10);
  const dated = rows
    .map((row) => {
      const date =
        str(row.date) ?? str(row.fiscalDateEnding) ?? str(row.calendarYear);
      return { row, date: date ? (date.length === 4 ? `${date}-12-31` : date.slice(0, 10)) : null };
    })
    .filter((item) => item.date);
  const future = dated
    .filter((item) => item.date && item.date >= today)
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  if (future[0]) return future[0].row;
  dated.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return dated[0]?.row ?? firstRow(rows);
}

function buildYears(
  income: Record<string, unknown>[],
  cashflow: Record<string, unknown>[],
  balance: Record<string, unknown>[],
): TickerStatementYear[] {
  const byYear = new Map<string, TickerStatementYear>();

  const upsert = (year: string | null) => {
    if (!year) return null;
    const existing = byYear.get(year);
    if (existing) return existing;
    const next: TickerStatementYear = {
      fiscalYear: year,
      revenue: null,
      grossProfit: null,
      operatingIncome: null,
      netIncome: null,
      eps: null,
      operatingCashFlow: null,
      capex: null,
      freeCashFlow: null,
      cash: null,
      totalDebt: null,
      equity: null,
      totalAssets: null,
      sharesOut: null,
      sharesDiluted: null,
    };
    byYear.set(year, next);
    return next;
  };

  for (const row of income.slice(0, 8)) {
    const year = upsert(fiscalYearLabel(row));
    if (!year) continue;
    year.revenue = pick(row, "revenue");
    year.grossProfit = pick(row, "grossProfit");
    year.operatingIncome = pick(row, "operatingIncome", "ebit");
    year.netIncome = pick(row, "netIncome");
    year.eps = pick(row, "eps", "epsdiluted");
    year.sharesOut = pick(row, "weightedAverageShsOut");
    year.sharesDiluted = pick(
      row,
      "weightedAverageShsOutDil",
      "weightedAverageShsOutDiluted",
    );
  }
  for (const row of cashflow.slice(0, 8)) {
    const year = upsert(fiscalYearLabel(row));
    if (!year) continue;
    year.operatingCashFlow = pick(row, "operatingCashFlow");
    year.capex = pick(row, "capitalExpenditure");
    year.freeCashFlow = pick(row, "freeCashFlow");
  }
  for (const row of balance.slice(0, 8)) {
    const year = upsert(fiscalYearLabel(row));
    if (!year) continue;
    year.cash = pick(
      row,
      "cashAndCashEquivalents",
      "cashAndShortTermInvestments",
    );
    year.totalDebt = pick(row, "totalDebt");
    year.equity = pick(row, "totalStockholdersEquity", "totalEquity");
    year.totalAssets = pick(row, "totalAssets");
  }

  return [...byYear.values()].sort((a, b) =>
    (b.fiscalYear ?? "").localeCompare(a.fiscalYear ?? ""),
  );
}

export function applyCacheMeta(
  snapshot: TickerSnapshot,
  cache: {
    status: TickerCacheStatus;
    fromCache: boolean;
    fmpHit: boolean;
    fetchedAtMs: number;
    freshUntilMs: number;
    staleUntilMs: number;
  },
): TickerSnapshot {
  return {
    ...snapshot,
    fetchedAt: new Date(cache.fetchedAtMs).toISOString(),
    cache: {
      status: cache.status,
      fromCache: cache.fromCache,
      fmpHit: cache.fmpHit,
      freshUntil: new Date(cache.freshUntilMs).toISOString(),
      staleUntil: new Date(cache.staleUntilMs).toISOString(),
    },
  };
}

export { num };
