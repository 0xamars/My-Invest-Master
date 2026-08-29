/**
 * First-slice Score: Past and Health only. Missing inputs are skipped, not failed.
 * Future, Value, and Dividend stay empty until later sections ship.
 */
import { isBankIndustry, isInsuranceIndustry } from "@/lib/analysis/rating/industry-model";
import { firstRow, fiscalYearLabel, num, pick, ratio, str, yoyChange } from "@/lib/ticker/pick";
import { formatTickerField, TICKER_UNKNOWN } from "@/lib/ticker/format";
import type { TickerBundle } from "@/lib/ticker/types";
import type {
  ScoreAxis,
  ScoreCheck,
  ScoreCheckInput,
  TickerChartPoint,
  TickerHealthPrint,
  TickerPastPrint,
  TickerScore,
  TickerStatementCharts,
} from "@/lib/ticker/score-types";

type Row = Record<string, unknown>;

export const PAST_LOOK_LINE =
  "Look at whether revenue, earnings, and returns held up across the years we have.";

export const HEALTH_LOOK_LINE =
  "Look at whether cash and earnings cover the debt we can see.";

export const SCORE_NOT_A_BUY =
  "A large Score is not a buy.";

function money(value: number | null): string {
  return formatTickerField({ label: "", value, kind: "money" });
}

function pct(value: number | null): string {
  return formatTickerField({ label: "", value, kind: "percent" });
}

function ratioText(value: number | null): string {
  return formatTickerField({ label: "", value, kind: "ratio" });
}

function countText(value: number | null): string {
  return formatTickerField({ label: "", value, kind: "shares" });
}

function input(label: string, value: string): ScoreCheckInput {
  return { label, value };
}

function check(
  id: string,
  label: string,
  passed: boolean | null,
  inputs: ScoreCheckInput[],
): ScoreCheck {
  return { id, label, passed, inputs };
}

/** FMP returns 0.20 or 20 for the same 20% return. */
export function asReturnRatio(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.abs(value) > 1.5 ? value / 100 : value;
}

function yoyRates(values: Array<number | null>): Array<number | null> {
  const rates: Array<number | null> = [];
  for (let i = 0; i < values.length - 1; i += 1) {
    rates.push(yoyChange(values[i] ?? null, values[i + 1] ?? null));
  }
  return rates;
}

function averagePresent(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value != null);
  if (!present.length) return null;
  return present.reduce((sum, value) => sum + value, 0) / present.length;
}

function streakLabel(
  values: Array<number | null>,
  kind: "revenue" | "net income",
): string {
  const present = values.filter((value): value is number => value != null);
  if (present.length < 2) return TICKER_UNKNOWN;
  let up = 0;
  let down = 0;
  for (let i = 0; i < values.length - 1; i += 1) {
    const newer = values[i];
    const older = values[i + 1];
    if (newer == null || older == null) continue;
    if (newer > older) up += 1;
    else if (newer < older) down += 1;
  }
  const scored = up + down;
  if (scored === 0) return TICKER_UNKNOWN;
  const years = Math.min(values.filter((v) => v != null).length, 8);
  if (up === scored) return `${years}-year rising ${kind}`;
  if (down === scored) return `${years}-year falling ${kind}`;
  return `${years}-year ${kind} · ${up} up / ${down} down`;
}

export function isReitCompany(sector: string | null, industry: string | null): boolean {
  const blob = `${sector ?? ""} ${industry ?? ""}`.toLowerCase();
  return blob.includes("reit") || blob.includes("real estate investment trust");
}

export function isRegulatedHealthVehicle(
  sector: string | null,
  industry: string | null,
): boolean {
  const ref = { sector, industry };
  return (
    isBankIndustry(ref) ||
    isInsuranceIndustry(ref) ||
    isReitCompany(sector, industry)
  );
}

function pickDeposit(row: Row | null): number | null {
  return pick(
    row,
    "totalDeposits",
    "deposit",
    "deposits",
    "nonInterestBearingDeposits",
    "interestBearingDeposits",
  );
}

function pickLoan(row: Row | null): number | null {
  return pick(
    row,
    "netLoan",
    "netLoans",
    "loansAndLeaseReceivables",
    "loansReceivable",
    "netReceivables",
    "longTermInvestments",
  );
}

function pickLongTermLiabilities(row: Row | null): number | null {
  return pick(
    row,
    "totalNonCurrentLiabilities",
    "nonCurrentLiabilitiesTotal",
    "longTermLiabilities",
    "longTermDebt",
  );
}

function pickDebtToEquity(row: Row | null): number | null {
  return pick(
    row,
    "debtToEquity",
    "debtToEquityRatio",
    "debtToEquityRatioTTM",
    "debtEquityRatio",
    "debtEquityRatioTTM",
  );
}

function pickRoe(metrics: Row | null, ratios: Row | null): number | null {
  return asReturnRatio(
    pick(metrics, "returnOnEquity", "roe", "roeTTM", "returnOnEquityTTM") ??
      pick(ratios, "returnOnEquity", "returnOnEquityTTM"),
  );
}

function pickRoa(metrics: Row | null, ratios: Row | null): number | null {
  return asReturnRatio(
    pick(metrics, "returnOnAssets", "roa", "roaTTM", "returnOnAssetsTTM") ??
      pick(ratios, "returnOnAssets", "returnOnAssetsTTM"),
  );
}

function pickRoce(metrics: Row | null, ratios: Row | null): number | null {
  return asReturnRatio(
    pick(metrics, "returnOnCapitalEmployed") ??
      pick(ratios, "returnOnCapitalEmployed"),
  );
}

/**
 * Next-year burn from the last three FCF years: latest |FCF| grown or
 * shrunk at the average of the two year-over-year |FCF| rates.
 * Missing any year, or a zero |FCF| that blocks a rate, returns null (skip).
 */
export function nextYearBurnAtThreeYearTrend(
  latest: number | null,
  mid: number | null,
  oldest: number | null,
): number | null {
  if (latest == null || mid == null || oldest == null) return null;
  const latestBurn = Math.abs(latest);
  const newerRate = yoyChange(latestBurn, Math.abs(mid));
  const olderRate = yoyChange(Math.abs(mid), Math.abs(oldest));
  if (newerRate == null || olderRate == null) return null;
  const nextYearBurn = latestBurn * (1 + (newerRate + olderRate) / 2);
  if (!Number.isFinite(nextYearBurn)) return null;
  return Math.max(0, nextYearBurn);
}

function pickEpsGrowth(row: Row | null): number | null {
  return asReturnRatio(
    pick(
      row,
      "growthEPSDiluted",
      "growthEPSdiluted",
      "epsgrowth",
      "epsGrowth",
      "growthEPS",
    ),
  );
}

function axisFromChecks(
  key: ScoreAxis["key"],
  label: string,
  checks: ScoreCheck[],
  note: string | null = null,
): ScoreAxis {
  const scored = checks.filter((item) => item.passed !== null).length;
  if (scored === 0) {
    return {
      key,
      label,
      passed: null,
      scored: null,
      status: "unknown",
      checks,
      note,
    };
  }
  return {
    key,
    label,
    passed: checks.filter((item) => item.passed === true).length,
    scored,
    status: "scored",
    checks,
    note,
  };
}

function emptyLaterAxis(key: ScoreAxis["key"], label: string): ScoreAxis {
  return {
    key,
    label,
    passed: null,
    scored: null,
    status: "unknown",
    checks: [],
    note: "Not scored in this slice.",
  };
}

export function formatScoreMark(axis: ScoreAxis | null | undefined): string {
  if (!axis || axis.status === "unknown" || axis.passed == null || axis.scored == null) {
    return TICKER_UNKNOWN;
  }
  return `${axis.passed} / ${axis.scored}`;
}

function rows(value: Row[] | null | undefined): Row[] {
  return Array.isArray(value) ? value : [];
}

export function buildPastPrint(bundle: TickerBundle): TickerPastPrint {
  const income = rows(bundle.incomeAnnual);
  const years = income.slice(0, 8).map((row) => ({
    fiscalYear: fiscalYearLabel(row),
    revenue: pick(row, "revenue"),
    netIncome: pick(row, "netIncome"),
    epsDiluted: pick(row, "epsdiluted", "epsDiluted", "eps"),
    sharesDiluted: pick(
      row,
      "weightedAverageShsOutDil",
      "weightedAverageShsOutDiluted",
    ),
  }));
  const revenues = years.map((year) => year.revenue);
  const nets = years.map((year) => year.netIncome);
  const shares = years.map((year) => year.sharesDiluted);
  const latestIncome = firstRow(income);
  const latestCash = firstRow(bundle.cashflowAnnual);
  const sbc = pick(
    latestCash,
    "stockBasedCompensation",
    "stockBasedCompensationExpense",
  );
  const netIncome = pick(latestIncome, "netIncome");
  return {
    years,
    revenueStreak: streakLabel(revenues, "revenue"),
    netIncomeStreak: streakLabel(nets, "net income"),
    epsDiluted: years[0]?.epsDiluted ?? null,
    roe: pickRoe(bundle.keyMetricsTtm, bundle.ratiosTtm),
    roce: pickRoce(bundle.keyMetricsTtm, bundle.ratiosTtm),
    roa: pickRoa(bundle.keyMetricsTtm, bundle.ratiosTtm),
    shareCountChange: yoyChange(shares[0] ?? null, shares[1] ?? null),
    stockBasedCompensation: sbc,
    sbcVsNetIncome: ratio(sbc, netIncome),
  };
}

export function buildHealthPrint(bundle: TickerBundle): TickerHealthPrint {
  const profile = bundle.profile;
  const sector = str(profile?.sector);
  const industry = str(profile?.industry);
  const balanceAnnual = rows(bundle.balanceAnnual);
  const balance0 = firstRow(balanceAnnual);
  const balance5 = balanceAnnual[5] ?? null;
  const cashflow0 = firstRow(rows(bundle.cashflowAnnual));
  const income0 = firstRow(rows(bundle.incomeAnnual));
  const metricsAnnual = rows(bundle.keyMetricsAnnual);
  const metrics0 = firstRow(metricsAnnual);
  const metrics5 = metricsAnnual[5] ?? null;
  const cashAndSti = pick(
    balance0,
    "cashAndShortTermInvestments",
    "cashAndCashEquivalents",
  );
  const equity = pick(balance0, "totalStockholdersEquity", "totalEquity");
  const equity5 = pick(balance5, "totalStockholdersEquity", "totalEquity");
  const debt = pick(balance0, "totalDebt");
  const debt5 = pick(balance5, "totalDebt");
  const de =
    pickDebtToEquity(bundle.ratiosTtm) ??
    pickDebtToEquity(metrics0) ??
    ratio(debt, equity);
  const de5 = pickDebtToEquity(metrics5) ?? ratio(debt5, equity5);
  return {
    cashAndSti,
    totalDebt: debt,
    currentAssets: pick(balance0, "totalCurrentAssets"),
    currentLiabilities: pick(balance0, "totalCurrentLiabilities"),
    longTermLiabilities: pickLongTermLiabilities(balance0),
    debtToEquity: de,
    debtToEquityFiveYearsAgo: de5,
    operatingCashFlow: pick(cashflow0, "operatingCashFlow"),
    freeCashFlow: pick(cashflow0, "freeCashFlow"),
    interestCoverage: pick(
      bundle.ratiosTtm,
      "interestCoverageRatioTTM",
      "interestCoverageRatio",
      "interestCoverage",
    ),
    ebit: pick(income0, "operatingIncome", "ebit"),
    interestExpense: pick(income0, "interestExpense", "interestExpenseNet"),
    altmanZ: pick(bundle.financialScores, "altmanZScore", "altmanZ"),
    piotroski: pick(bundle.financialScores, "piotroskiScore", "piotroski"),
    regulatedVehicle: isRegulatedHealthVehicle(sector, industry),
    depositField: pickDeposit(balance0),
    loanField: pickLoan(balance0),
  };
}

function buildPastChecks(bundle: TickerBundle, print: TickerPastPrint): ScoreCheck[] {
  const eps = rows(bundle.incomeAnnual).map((row) =>
    pick(row, "epsdiluted", "epsDiluted", "eps"),
  );
  const latestEps = eps[0] ?? null;
  const epsFiveAgo = eps[5] ?? null;
  const growthRows = bundle.incomeGrowth ?? [];
  const latestGrowth =
    pickEpsGrowth(firstRow(growthRows)) ?? yoyRates(eps)[0] ?? null;
  const fiveGrowths = yoyRates(eps).slice(0, 5);
  const fiveYearAvg =
    fiveGrowths.every((value) => value != null)
      ? averagePresent(fiveGrowths)
      : averagePresent(
          growthRows.slice(0, 5).map((row) => pickEpsGrowth(row)),
        );
  const roceNow = print.roce;
  const roceThreeAgo = pickRoce(rows(bundle.keyMetricsAnnual)[3] ?? null, null);

  return [
    check(
      "eps-vs-five-years",
      "Latest FY diluted EPS greater than five years earlier",
      latestEps != null && epsFiveAgo != null ? latestEps > epsFiveAgo : null,
      [
        input("Latest FY diluted EPS", ratioText(latestEps)),
        input("Diluted EPS five years earlier", ratioText(epsFiveAgo)),
        input("Annual income rows", String(rows(bundle.incomeAnnual).length)),
      ],
    ),
    check(
      "eps-growth-vs-5y-avg",
      "Latest-year EPS growth greater than the five-year average",
      latestGrowth != null && fiveYearAvg != null
        ? latestGrowth > fiveYearAvg
        : null,
      [
        input("Latest-year EPS growth", pct(latestGrowth)),
        input("Five-year average EPS growth", pct(fiveYearAvg)),
      ],
    ),
    check(
      "roe-20",
      "Trailing ROE greater than 20%",
      print.roe != null ? print.roe > 0.2 : null,
      [input("Trailing ROE", pct(print.roe))],
    ),
    check(
      "roce-vs-three-years",
      "Trailing ROCE greater than three years earlier",
      roceNow != null && roceThreeAgo != null ? roceNow > roceThreeAgo : null,
      [
        input("Trailing ROCE", pct(roceNow)),
        input("ROCE three years earlier", pct(roceThreeAgo)),
      ],
    ),
  ];
}

function buildHealthChecks(
  bundle: TickerBundle,
  print: TickerHealthPrint,
): { checks: ScoreCheck[]; note: string | null } {
  if (print.regulatedVehicle) {
    const hasDepositOrLoan = print.depositField != null || print.loanField != null;
    return {
      checks: [],
      note: hasDepositOrLoan
        ? "Industrial health checks are not used for banks, insurers, or REITs."
        : "Deposit or loan fields are missing, so Health stays Unknown.",
    };
  }

  const balance0 = firstRow(bundle.balanceAnnual);
  if (!balance0) {
    return {
      checks: [],
      note: "Latest balance is empty.",
    };
  }

  const fcfYears = rows(bundle.cashflowAnnual)
    .slice(0, 3)
    .map((row) => pick(row, "freeCashFlow"));
  const trailingFcf = print.freeCashFlow;
  const useRunway = trailingFcf != null && trailingFcf < 0;

  const ca = print.currentAssets;
  const cl = print.currentLiabilities;
  const ltl = print.longTermLiabilities;
  const de = print.debtToEquity;
  const de5 = print.debtToEquityFiveYearsAgo;
  const ocf = print.operatingCashFlow;
  const debt = print.totalDebt;
  const cover = print.interestCoverage;
  const ebit = print.ebit;
  const interest = print.interestExpense;

  const industrialFiveSix: ScoreCheck[] = [
    check(
      "ocf-vs-debt",
      "OCF greater than 20% of total debt, or debt is zero",
      debt != null && debt === 0
        ? true
        : ocf != null && debt != null
          ? ocf > 0.2 * debt
          : null,
      [
        input("Operating cash flow", money(ocf)),
        input("Total debt", money(debt)),
      ],
    ),
    check(
      "interest-cover",
      "EBIT greater than 5× interest, or interest is zero",
      interest != null && interest === 0
        ? true
        : cover != null
          ? cover > 5
          : ebit != null && interest != null
            ? ebit > 5 * Math.abs(interest)
            : null,
      [
        input("EBIT", money(ebit)),
        input("Interest expense", money(interest)),
        input("Interest cover", ratioText(cover)),
      ],
    ),
  ];

  const burn1 = trailingFcf != null ? Math.abs(trailingFcf) : null;
  const burn3 = nextYearBurnAtThreeYearTrend(
    fcfYears[0] ?? null,
    fcfYears[1] ?? null,
    fcfYears[2] ?? null,
  );
  const runwayFiveSix: ScoreCheck[] = [
    check(
      "cash-runway-1y",
      "Cash + STI covers one year of burn",
      print.cashAndSti != null && burn1 != null ? print.cashAndSti >= burn1 : null,
      [
        input("Cash + short-term investments", money(print.cashAndSti)),
        input("One-year burn (|trailing FCF|)", money(burn1)),
      ],
    ),
    check(
      "cash-runway-3y",
      "Cash + STI covers one year of burn at the three-year FCF trend",
      print.cashAndSti != null && burn3 != null
        ? print.cashAndSti >= burn3
        : null,
      [
        input("Cash + short-term investments", money(print.cashAndSti)),
        input("Next-year burn (3y FCF trend)", money(burn3)),
      ],
    ),
  ];

  return {
    checks: [
      check(
        "ca-gt-cl",
        "Current assets greater than current liabilities",
        ca != null && cl != null ? ca > cl : null,
        [
          input("Current assets", money(ca)),
          input("Current liabilities", money(cl)),
        ],
      ),
      check(
        "ca-gt-ltl",
        "Current assets greater than long-term liabilities",
        ca != null && ltl != null ? ca > ltl : null,
        [
          input("Current assets", money(ca)),
          input("Long-term liabilities", money(ltl)),
        ],
      ),
      check(
        "de-not-risen",
        "Debt-to-equity has not risen versus five years earlier",
        de != null && de5 != null ? de <= de5 : null,
        [
          input("Debt / equity", ratioText(de)),
          input("Debt / equity five years earlier", ratioText(de5)),
        ],
      ),
      check(
        "de-below-040",
        "Debt-to-equity below 0.40",
        de != null ? de < 0.4 : null,
        [input("Debt / equity", ratioText(de))],
      ),
      ...(useRunway ? runwayFiveSix : industrialFiveSix),
    ],
    note: useRunway
      ? "Trailing FCF is negative, so interest and OCF checks are replaced by cash runway."
      : null,
  };
}

export function buildTickerScore(bundle: TickerBundle): {
  score: TickerScore;
  past: TickerPastPrint;
  health: TickerHealthPrint;
} {
  const past = buildPastPrint(bundle);
  const health = buildHealthPrint(bundle);
  const pastChecks = buildPastChecks(bundle, past);
  const healthBuilt = buildHealthChecks(bundle, health);

  return {
    score: {
      axes: [
        axisFromChecks("past", "Past", pastChecks),
        emptyLaterAxis("future", "Future"),
        axisFromChecks("health", "Health", healthBuilt.checks, healthBuilt.note),
        emptyLaterAxis("value", "Value"),
        emptyLaterAxis("dividend", "Dividend"),
      ],
    },
    past,
    health,
  };
}

export function scoreAxis(
  score: TickerScore | null | undefined,
  key: ScoreAxis["key"],
): ScoreAxis | null {
  return score?.axes.find((axis) => axis.key === key) ?? null;
}

function chartPoint(row: Row | null): TickerChartPoint | null {
  if (!row) return null;
  const period =
    str(row.date)?.slice(0, 7) ??
    fiscalYearLabel(row) ??
    str(row.period) ??
    null;
  if (!period) return null;
  return {
    period,
    revenue: pick(row, "revenue"),
    netIncome: pick(row, "netIncome"),
    epsDiluted: pick(row, "epsdiluted", "epsDiluted", "eps"),
  };
}

export function buildStatementCharts(bundle: TickerBundle): TickerStatementCharts {
  const annual = (bundle.incomeAnnual ?? [])
    .slice(0, 8)
    .map((row) => chartPoint(row))
    .filter((row): row is TickerChartPoint => row != null)
    .reverse();
  const quarterly = (bundle.incomeQuarter ?? [])
    .slice(0, 8)
    .map((row) => chartPoint(row))
    .filter((row): row is TickerChartPoint => row != null)
    .reverse();
  return { annual, quarterly };
}

