/**
 * Build FundamentalInputs from cached FMP Analysis Package rows.
 *
 * Strict same-period policy:
 * 1) Prefer TTM when coverage is sufficiently complete
 * 2) Else latest annual
 * 3) Else latest quarter (last resort)
 *
 * All core FS / Profitability / Growth / Valuation inputs come from that
 * single Fundamental Period. Other periods are trend/warning notes only.
 */
import type { FundamentalInputs } from "@/lib/analysis/rating/types";
import { computeAltmanZ } from "@/lib/market-data/fmp/fundamentals";
import { num } from "@/lib/market-data/fmp/client";
import type { JsonRow } from "@/lib/market-data/warehouse/types";

type Row = JsonRow;

export type FundamentalPeriod = "ttm" | "annual" | "quarter";

export type TtmSource =
  | "native"
  | "constructed"
  | "hybrid"
  | "unavailable";

export type PeriodSelection = {
  period: FundamentalPeriod;
  reason: string;
  completeness: {
    ttm: number;
    annual: number;
    quarter: number;
  };
  presentKeys: string[];
  missingKeys: string[];
  trendNotes: string[];
  /** How TTM statement inputs were obtained. */
  ttmSource: TtmSource;
  /** Flow/stock fields summed or copied into constructed TTM. */
  constructedFields: string[];
  /** Effective TTM rows used when Fundamental Period = TTM. */
  effectiveTtm: {
    income: Row | null;
    balance: Row | null;
    cashflow: Row | null;
  };
};

const TTM_COMPLETENESS_THRESHOLD = 0.7;
/** Minimum quarterly statements required to construct TTM. */
const MIN_QUARTERS_FOR_TTM = 4;

/** Income / cash-flow fields summed across last N quarters. */
const FLOW_INCOME_KEYS = [
  "revenue",
  "costOfRevenue",
  "grossProfit",
  "researchAndDevelopmentExpenses",
  "researchAndDevelopment",
  "operatingIncome",
  "ebit",
  "ebitda",
  "EBITDA",
  "netIncome",
  "interestExpense",
  "incomeBeforeTax",
  "incomeTaxExpense",
  "depreciationAndAmortization",
] as const;

const FLOW_CASHFLOW_KEYS = [
  "operatingCashFlow",
  "freeCashFlow",
  "capitalExpenditure",
  "depreciationAndAmortization",
] as const;

/** Balance-sheet levels taken from the latest quarter only. */
const STOCK_BALANCE_KEYS = [
  "cashAndCashEquivalents",
  "cashAndShortTermInvestments",
  "totalDebt",
  "shortTermDebt",
  "longTermDebt",
  "totalStockholdersEquity",
  "totalEquity",
  "totalAssets",
  "totalLiabilities",
  "totalCurrentAssets",
  "totalCurrentLiabilities",
  "retainedEarnings",
] as const;

function first(rows: Row[] | null | undefined): Row | null {
  return Array.isArray(rows) && rows.length > 0 ? rows[0]! : null;
}

function pick(row: Row | null, ...keys: string[]): number | null {
  if (!row) return null;
  for (const key of keys) {
    const v = num(row[key]);
    if (v != null) return v;
  }
  return null;
}

/**
 * Package margin fields (FMP) are usually unit decimals and may be |v| >> 1
 * for severe losses. Only treat as percent when |v| > 100 (e.g. -439).
 */
function normalizePackageMargin(v: number | null): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  if (Math.abs(v) > 100) return v / 100;
  return v;
}

/**
 * Package return fields may be percent (15) or unit (0.15).
 * |v| > 2 is treated as percent — severe decimal returns stay via statement compute.
 */
function normalizePackageReturn(v: number | null): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  if (Math.abs(v) > 2) return v / 100;
  return v;
}

/** @deprecated */
function asUnitRatio(v: number | null): number | null {
  return normalizePackageReturn(v);
}

/**
 * Prefer same-period statement margin (income ÷ revenue). Fall back to package
 * ratio only when statement inputs are missing. Never silently soften severe losses.
 */
function resolveMargin(input: {
  label: string;
  statement: number | null;
  packageRatio: number | null;
  notes: string[];
}): number | null {
  const stmt = input.statement;
  const pkg = normalizePackageMargin(input.packageRatio);
  if (stmt != null && Number.isFinite(stmt)) {
    if (pkg != null && Math.abs(stmt - pkg) > 0.1) {
      input.notes.push(
        `${input.label}: using statement margin (${(stmt * 100).toFixed(1)}%) over package ratio (${(pkg * 100).toFixed(1)}%).`,
      );
    }
    return stmt;
  }
  return pkg;
}

function resolveReturnMetric(input: {
  label: string;
  computed: number | null;
  packageRatio: number | null;
  notes: string[];
}): number | null {
  const computed = input.computed;
  const pkg = normalizePackageReturn(input.packageRatio);
  if (computed != null && Number.isFinite(computed)) {
    if (pkg != null && Math.abs(computed - pkg) > 0.15) {
      input.notes.push(
        `${input.label}: using statement-computed return over package ratio.`,
      );
    }
    // Prefer package native when close; else prefer computed for severe losses
    if (pkg != null && Math.abs(computed - pkg) <= 0.15) return pkg;
    if (computed < -0.2 || (pkg != null && pkg > computed + 0.1)) return computed;
    return pkg ?? computed;
  }
  return pkg;
}

/** Period-aware ratio/metrics pick — TTM prefers *TTM keys; annual/quarter prefer bare keys. */
function pickPeriod(
  row: Row | null,
  period: FundamentalPeriod,
  ...bases: string[]
): number | null {
  if (!row) return null;
  if (period === "ttm") {
    const keys = bases.flatMap((b) =>
      b.endsWith("TTM") ? [b, b.slice(0, -3)] : [`${b}TTM`, b],
    );
    return pick(row, ...keys);
  }
  const keys = bases.flatMap((b) =>
    b.endsWith("TTM") ? [b.slice(0, -3), b] : [b, `${b}TTM`],
  );
  return pick(row, ...keys);
}

function fcfStabilityScore(fcfSeries: number[]): number | null {
  if (fcfSeries.length < 2) return null;
  const positiveYears = fcfSeries.filter((v) => v > 0).length;
  const ratio = positiveYears / fcfSeries.length;
  const mean = fcfSeries.reduce((s, v) => s + v, 0) / fcfSeries.length;
  if (mean === 0) return ratio * 50;
  const variance =
    fcfSeries.reduce((s, v) => s + (v - mean) ** 2, 0) / fcfSeries.length;
  const cv = Math.sqrt(variance) / Math.abs(mean);
  const stability = Math.max(0, 1 - Math.min(cv, 2) / 2);
  return Math.round((0.6 * ratio + 0.4 * stability) * 100);
}

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
  const value =
    kind === "gross"
      ? pick(inc, "grossProfit")
      : kind === "operating"
        ? pick(inc, "operatingIncome", "ebit")
        : pick(inc, "netIncome");
  if (value == null) return null;
  const m = value / revenue;
  return Number.isFinite(m) ? m : null;
}

function trendDelta(series: Array<number | null>): number | null {
  const clean = series.filter((v): v is number => v != null);
  if (clean.length < 2) return null;
  return clean[0]! - clean[clean.length - 1]!;
}

function yoyGrowth(
  latest: number | null,
  prior: number | null,
): number | null {
  if (latest == null || prior == null || prior === 0) return null;
  const g = (latest - prior) / Math.abs(prior);
  return Number.isFinite(g) ? g : null;
}

function pickPackageGrowth(
  growthRows: Row[],
  ...keys: string[]
): number | null {
  for (const row of growthRows) {
    const v = pick(row, ...keys);
    if (v != null && Number.isFinite(v)) return v;
  }
  return null;
}

/** True EBITDA only — never substitute operating income / EBIT. */
function pickTrueEbitda(
  inc: Row | null,
  metrics: Row | null,
  period: FundamentalPeriod,
): number | null {
  return (
    pick(inc, "ebitda", "EBITDA") ??
    pickPeriod(metrics, period, "ebitda", "ebitdaTTM")
  );
}

/**
 * FCF from package: prefer reported freeCashFlow.
 * CapEx may be negative (FMP convention) or positive absolute — handle both.
 */
function resolveFreeCashFlow(
  cf: Row | null,
  ownerFcf: number | null,
): number | null {
  const reported = pick(cf, "freeCashFlow");
  if (reported != null) return reported;
  const ocf = pick(cf, "operatingCashFlow");
  const capex = pick(cf, "capitalExpenditure");
  if (ocf != null && capex != null) {
    return capex <= 0 ? ocf + capex : ocf - Math.abs(capex);
  }
  return ownerFcf;
}

/** Industries where standard OCF/FCF often reflects customer/float cash, not operating profit. */
function isCashFlowDistortedIndustry(input: {
  industryKey: string | null;
  sectorKey: string | null;
  industry: string | null;
}): boolean {
  const key = (input.industryKey ?? "").toLowerCase();
  const sector = (input.sectorKey ?? "").toLowerCase();
  const industry = (input.industry ?? "").toLowerCase();
  if (
    key === "capital-markets" ||
    key === "asset-management" ||
    key.startsWith("banks") ||
    key.startsWith("insurance") ||
    key === "credit-services" ||
    key === "mortgage-finance"
  ) {
    return true;
  }
  if (sector === "financial-services") return true;
  return (
    industry.includes("broker") ||
    industry.includes("capital market") ||
    industry.includes("bank") ||
    industry.includes("insurance") ||
    industry.includes("asset management") ||
    industry.includes("credit services")
  );
}

/**
 * True geometric CAGR for Growth history sleeve.
 * Requires ≥4 annual points (3Y span) and strictly positive ends — no avg-YoY / caps.
 */
function geometricCagr3y(series: Array<number | null>): number | null {
  const clean = series
    .filter((v): v is number => v != null && Number.isFinite(v))
    .slice(0, 4);
  if (clean.length < 4) return null;
  const latest = clean[0]!;
  const oldest = clean[3]!;
  if (!(oldest > 0) || !(latest > 0)) return null;
  const cagr = Math.pow(latest / oldest, 1 / 3) - 1;
  return Number.isFinite(cagr) ? cagr : null;
}

type PeriodBundle = {
  income: Row | null;
  balance: Row | null;
  cashflow: Row | null;
  ratios: Row | null;
  keyMetrics: Row | null;
};

/** Core checklist for same-period completeness (0–1). */
export function scorePeriodCompleteness(bundle: PeriodBundle): {
  ratio: number;
  present: string[];
  missing: string[];
} {
  const { income: inc, balance: bal, cashflow: cf, ratios, keyMetrics } = bundle;
  const checks: Array<{ key: string; ok: boolean }> = [
    {
      key: "revenue",
      ok: pick(inc, "revenue") != null || pick(ratios, "revenuePerShareTTM") != null,
    },
    {
      key: "ebitda",
      ok:
        pick(inc, "ebitda", "EBITDA") != null ||
        pick(keyMetrics, "ebitdaTTM", "ebitda") != null ||
        pick(ratios, "ebitdaMarginTTM", "ebitdaMargin") != null,
    },
    {
      key: "operatingIncome",
      ok: pick(inc, "operatingIncome", "ebit") != null,
    },
    {
      key: "netIncome",
      ok: pick(inc, "netIncome") != null,
    },
    {
      key: "freeCashFlow",
      ok:
        pick(cf, "freeCashFlow") != null ||
        (pick(cf, "operatingCashFlow") != null &&
          pick(cf, "capitalExpenditure") != null),
    },
    {
      key: "operatingCashFlow",
      ok: pick(cf, "operatingCashFlow") != null,
    },
    {
      key: "totalDebt",
      ok:
        pick(bal, "totalDebt") != null ||
        (pick(bal, "shortTermDebt") != null &&
          pick(bal, "longTermDebt") != null),
    },
    {
      key: "equity",
      ok: pick(bal, "totalStockholdersEquity", "totalEquity") != null,
    },
    {
      key: "totalAssets",
      ok: pick(bal, "totalAssets") != null,
    },
    {
      key: "liquidity",
      ok:
        (pick(bal, "totalCurrentAssets") != null &&
          pick(bal, "totalCurrentLiabilities") != null) ||
        pick(ratios, "currentRatioTTM", "currentRatio") != null,
    },
    {
      key: "grossProfit",
      ok:
        pick(inc, "grossProfit") != null ||
        pick(ratios, "grossProfitMarginTTM", "grossProfitMargin") != null,
    },
  ];

  const present = checks.filter((c) => c.ok).map((c) => c.key);
  const missing = checks.filter((c) => !c.ok).map((c) => c.key);
  return {
    ratio: present.length / checks.length,
    present,
    missing,
  };
}

function sumFlowField(quarters: Row[], ...keys: string[]): number | null {
  let sum = 0;
  let found = 0;
  for (const row of quarters) {
    const v = pick(row, ...keys);
    if (v != null) {
      sum += v;
      found += 1;
    }
  }
  if (found === 0) return null;
  // Require the field on most quarters so one sparse row doesn't invent a thin TTM
  if (found < Math.ceil(quarters.length * 0.75)) return null;
  return sum;
}

/**
 * Construct TTM income / balance / cashflow from the last 4 quarterly statements.
 * Flow items are summed; balance-sheet levels use the latest quarter.
 */
export function constructTtmFromQuarters(input: {
  incomeQuarter: Row[];
  balanceQuarter: Row[];
  cashflowQuarter: Row[];
}): {
  income: Row;
  balance: Row;
  cashflow: Row;
  constructedFields: string[];
  quartersUsed: number;
} | null {
  const incomeQ = input.incomeQuarter.slice(0, MIN_QUARTERS_FOR_TTM);
  const balanceQ = input.balanceQuarter.slice(0, MIN_QUARTERS_FOR_TTM);
  const cashflowQ = input.cashflowQuarter.slice(0, MIN_QUARTERS_FOR_TTM);

  if (incomeQ.length < MIN_QUARTERS_FOR_TTM) return null;
  // Need revenue on enough quarters to trust the sum
  const revCheck = sumFlowField(incomeQ, "revenue");
  if (revCheck == null) return null;

  const constructedFields: string[] = [];
  const income: Row = {
    period: "TTM",
    __ttmConstructed: true,
  };
  const cashflow: Row = {
    period: "TTM",
    __ttmConstructed: true,
  };
  const latestBal = first(balanceQ);
  const balance: Row = {
    period: "TTM",
    __ttmConstructed: true,
    ...(latestBal ? { date: latestBal.date, calendarYear: latestBal.calendarYear } : {}),
  };

  for (const key of FLOW_INCOME_KEYS) {
    const v = sumFlowField(incomeQ, key);
    if (v != null) {
      income[key] = v;
      constructedFields.push(`income.${key}`);
    }
  }
  // Diluted shares / EPS: use latest quarter point-in-time (do not sum)
  const latestInc = first(incomeQ);
  for (const key of [
    "weightedAverageShsOutDil",
    "weightedAverageShsOutDiluted",
    "weightedAverageShsOut",
    "epsdiluted",
    "eps",
  ]) {
    const v = pick(latestInc, key);
    if (v != null) {
      income[key] = v;
      constructedFields.push(`income.${key}(latestQ)`);
    }
  }

  for (const key of FLOW_CASHFLOW_KEYS) {
    const v = sumFlowField(cashflowQ, key);
    if (v != null) {
      cashflow[key] = v;
      constructedFields.push(`cashflow.${key}`);
    }
  }
  // Derive FCF if OCF + CapEx present but freeCashFlow missing
  if (
    cashflow.freeCashFlow == null &&
    typeof cashflow.operatingCashFlow === "number" &&
    typeof cashflow.capitalExpenditure === "number"
  ) {
    cashflow.freeCashFlow =
      (cashflow.operatingCashFlow as number) +
      (cashflow.capitalExpenditure as number);
    constructedFields.push("cashflow.freeCashFlow(from OCF+CapEx)");
  }

  for (const key of STOCK_BALANCE_KEYS) {
    const v = pick(latestBal, key);
    if (v != null) {
      balance[key] = v;
      constructedFields.push(`balance.${key}(latestQ)`);
    }
  }

  // Prefer true EBITDA sum; if missing, do not invent from operating income
  if (income.ebitda == null && income.EBITDA == null) {
    // leave null — completeness / ratios_ttm may still supply ebitdaMargin
  }

  return {
    income,
    balance,
    cashflow,
    constructedFields,
    quartersUsed: incomeQ.length,
  };
}

/**
 * Build effective TTM statement trio: native when present, else constructed.
 * Per-statement hybrid allowed (e.g. native income + constructed cashflow).
 */
export function resolveEffectiveTtm(input: {
  incomeTtm: Row[];
  balanceTtm: Row[];
  cashflowTtm: Row[];
  incomeQuarter: Row[];
  balanceQuarter: Row[];
  cashflowQuarter: Row[];
}): {
  income: Row | null;
  balance: Row | null;
  cashflow: Row | null;
  ttmSource: TtmSource;
  constructedFields: string[];
} {
  const nativeInc = first(input.incomeTtm);
  const nativeBal = first(input.balanceTtm);
  const nativeCf = first(input.cashflowTtm);
  const constructed = constructTtmFromQuarters({
    incomeQuarter: input.incomeQuarter,
    balanceQuarter: input.balanceQuarter,
    cashflowQuarter: input.cashflowQuarter,
  });

  const income = nativeInc ?? constructed?.income ?? null;
  const balance = nativeBal ?? constructed?.balance ?? null;
  const cashflow = nativeCf ?? constructed?.cashflow ?? null;

  const usedConstructedInc = !nativeInc && Boolean(constructed?.income);
  const usedConstructedBal = !nativeBal && Boolean(constructed?.balance);
  const usedConstructedCf = !nativeCf && Boolean(constructed?.cashflow);
  const anyNative = Boolean(nativeInc || nativeBal || nativeCf);
  const anyConstructed =
    usedConstructedInc || usedConstructedBal || usedConstructedCf;

  let ttmSource: TtmSource = "unavailable";
  if (anyNative && anyConstructed) ttmSource = "hybrid";
  else if (anyNative && !anyConstructed) ttmSource = "native";
  else if (!anyNative && anyConstructed) ttmSource = "constructed";

  const constructedFields: string[] = [];
  if (constructed && anyConstructed) {
    if (usedConstructedInc) {
      constructedFields.push(
        ...constructed.constructedFields.filter((f) => f.startsWith("income.")),
      );
    }
    if (usedConstructedBal) {
      constructedFields.push(
        ...constructed.constructedFields.filter((f) =>
          f.startsWith("balance."),
        ),
      );
    }
    if (usedConstructedCf) {
      constructedFields.push(
        ...constructed.constructedFields.filter((f) =>
          f.startsWith("cashflow."),
        ),
      );
    }
  }

  return { income, balance, cashflow, ttmSource, constructedFields };
}

function statementsFor(
  period: FundamentalPeriod,
  ttm: Row[],
  quarter: Row[],
  annual: Row[],
): Row[] {
  if (period === "ttm") return ttm;
  if (period === "annual") return annual;
  return quarter;
}

/**
 * Choose one Fundamental Period for the entire fundamental engine.
 * TTM (native and/or constructed from quarters) if complete enough → annual → quarter.
 */
export function selectFundamentalPeriod(input: {
  incomeTtm: Row[];
  incomeQuarter: Row[];
  incomeAnnual: Row[];
  balanceTtm: Row[];
  balanceQuarter: Row[];
  balanceAnnual: Row[];
  cashflowTtm: Row[];
  cashflowQuarter: Row[];
  cashflowAnnual: Row[];
  ratiosTtm: Row | null;
  ratiosAnnual: Row[];
  keyMetricsTtm: Row | null;
  keyMetricsAnnual: Row[];
}): PeriodSelection {
  const effective = resolveEffectiveTtm({
    incomeTtm: input.incomeTtm,
    balanceTtm: input.balanceTtm,
    cashflowTtm: input.cashflowTtm,
    incomeQuarter: input.incomeQuarter,
    balanceQuarter: input.balanceQuarter,
    cashflowQuarter: input.cashflowQuarter,
  });

  const ttmBundle: PeriodBundle = {
    income: effective.income,
    balance: effective.balance,
    cashflow: effective.cashflow,
    ratios: input.ratiosTtm,
    keyMetrics: input.keyMetricsTtm,
  };
  const annualBundle: PeriodBundle = {
    income: first(input.incomeAnnual),
    balance: first(input.balanceAnnual),
    cashflow: first(input.cashflowAnnual),
    ratios: first(input.ratiosAnnual),
    keyMetrics: first(input.keyMetricsAnnual),
  };
  const quarterBundle: PeriodBundle = {
    income: first(input.incomeQuarter),
    balance: first(input.balanceQuarter),
    cashflow: first(input.cashflowQuarter),
    ratios: null,
    keyMetrics: null,
  };

  const ttm = scorePeriodCompleteness(ttmBundle);
  const annual = scorePeriodCompleteness(annualBundle);
  const quarter = scorePeriodCompleteness(quarterBundle);

  const completeness = {
    ttm: ttm.ratio,
    annual: annual.ratio,
    quarter: quarter.ratio,
  };

  const hasEffectiveTtm =
    Boolean(effective.income) &&
    Boolean(effective.balance) &&
    Boolean(effective.cashflow);
  const hasAnnualStatements =
    Boolean(annualBundle.income) &&
    Boolean(annualBundle.balance) &&
    Boolean(annualBundle.cashflow);
  const hasQuarterStatements =
    Boolean(quarterBundle.income) &&
    Boolean(quarterBundle.balance) &&
    Boolean(quarterBundle.cashflow);

  const ttmSourceLabel =
    effective.ttmSource === "native"
      ? "native statement TTM"
      : effective.ttmSource === "constructed"
        ? "TTM constructed from last 4 quarters"
        : effective.ttmSource === "hybrid"
          ? "hybrid TTM (native + constructed from quarters)"
          : "no TTM statements";

  let period: FundamentalPeriod;
  let reason: string;
  let presentKeys: string[];
  let missingKeys: string[];

  if (hasEffectiveTtm && ttm.ratio >= TTM_COMPLETENESS_THRESHOLD) {
    period = "ttm";
    reason = `TTM selected via ${ttmSourceLabel} — coverage ${(ttm.ratio * 100).toFixed(0)}% of core fields (≥${(TTM_COMPLETENESS_THRESHOLD * 100).toFixed(0)}% threshold).`;
    presentKeys = ttm.present;
    missingKeys = ttm.missing;
  } else if (hasAnnualStatements) {
    period = "annual";
    reason =
      hasEffectiveTtm && ttm.ratio < TTM_COMPLETENESS_THRESHOLD
        ? `Annual selected — effective TTM (${ttmSourceLabel}) coverage only ${(ttm.ratio * 100).toFixed(0)}% (below ${(TTM_COMPLETENESS_THRESHOLD * 100).toFixed(0)}% threshold); annual coverage ${(annual.ratio * 100).toFixed(0)}%.`
        : `Annual selected — usable TTM unavailable (${ttmSourceLabel}); annual coverage ${(annual.ratio * 100).toFixed(0)}%.`;
    presentKeys = annual.present;
    missingKeys = annual.missing;
  } else if (hasQuarterStatements) {
    period = "quarter";
    reason = `Latest quarter selected as last resort — TTM/annual incomplete. Quarter coverage ${(quarter.ratio * 100).toFixed(0)}%.`;
    presentKeys = quarter.present;
    missingKeys = quarter.missing;
  } else if (hasEffectiveTtm) {
    period = "ttm";
    reason = `TTM selected with thin coverage (${(ttm.ratio * 100).toFixed(0)}%) via ${ttmSourceLabel}.`;
    presentKeys = ttm.present;
    missingKeys = ttm.missing;
  } else if (
    first(input.incomeAnnual) ||
    first(input.incomeQuarter) ||
    effective.income
  ) {
    if (annual.ratio >= quarter.ratio && annual.ratio >= ttm.ratio) {
      period = "annual";
      reason = `Annual selected on partial coverage (${(annual.ratio * 100).toFixed(0)}%).`;
      presentKeys = annual.present;
      missingKeys = annual.missing;
    } else if (ttm.ratio >= quarter.ratio && hasEffectiveTtm) {
      period = "ttm";
      reason = `TTM selected on partial coverage (${(ttm.ratio * 100).toFixed(0)}%) via ${ttmSourceLabel}.`;
      presentKeys = ttm.present;
      missingKeys = ttm.missing;
    } else {
      period = "quarter";
      reason = `Latest quarter selected on partial coverage (${(quarter.ratio * 100).toFixed(0)}%).`;
      presentKeys = quarter.present;
      missingKeys = quarter.missing;
    }
  } else {
    period = "annual";
    reason =
      "No usable statements — defaulting to annual frame with sparse inputs.";
    presentKeys = [];
    missingKeys = [
      "revenue",
      "ebitda",
      "operatingIncome",
      "netIncome",
      "freeCashFlow",
      "operatingCashFlow",
      "totalDebt",
      "equity",
      "totalAssets",
      "liquidity",
      "grossProfit",
    ];
  }

  // Trend / warning notes from non-selected periods (never used for scoring)
  const trendNotes: string[] = [];
  const ttmFcf = pick(effective.cashflow, "freeCashFlow");
  const qFcf = pick(first(input.cashflowQuarter), "freeCashFlow");
  const aFcf = pick(first(input.cashflowAnnual), "freeCashFlow");
  const ttmRev = pick(effective.income, "revenue");
  const qRev = pick(first(input.incomeQuarter), "revenue");

  if (period === "ttm" && ttmFcf != null && qFcf != null) {
    if (ttmFcf > 0 && qFcf < 0) {
      trendNotes.push(
        "Latest quarter FCF is negative while TTM FCF is healthy — scoring stays on TTM; quarter noted as warning only.",
      );
    } else if (
      ttmFcf > 0 &&
      qFcf > 0 &&
      qRev != null &&
      ttmRev != null &&
      ttmRev > 0
    ) {
      const ttmMargin = ttmFcf / ttmRev;
      const qMargin = qFcf / qRev;
      if (qMargin < ttmMargin - 0.05) {
        trendNotes.push(
          "Latest quarter FCF margin is softer than TTM — scored on TTM; quarter softness is a trend note.",
        );
      }
    }
  }
  if (
    period === "annual" &&
    aFcf != null &&
    qFcf != null &&
    aFcf > 0 &&
    qFcf < 0
  ) {
    trendNotes.push(
      "Latest quarter FCF is weak vs latest annual FCF — scoring stays on annual; quarter noted as warning only.",
    );
  }
  if (
    period !== "ttm" &&
    hasEffectiveTtm &&
    ttm.ratio < TTM_COMPLETENESS_THRESHOLD
  ) {
    trendNotes.push(
      `Effective TTM (${ttmSourceLabel}) incomplete (${(ttm.ratio * 100).toFixed(0)}% core fields) — not used for scoring.`,
    );
  }
  if (
    effective.ttmSource === "constructed" ||
    effective.ttmSource === "hybrid"
  ) {
    trendNotes.push(
      `TTM statement path: ${ttmSourceLabel}${effective.constructedFields.length ? ` (${effective.constructedFields.length} fields from quarters)` : ""}.`,
    );
  }

  return {
    period,
    reason,
    completeness,
    presentKeys,
    missingKeys,
    trendNotes,
    ttmSource: effective.ttmSource,
    constructedFields: effective.constructedFields,
    effectiveTtm: {
      income: effective.income,
      balance: effective.balance,
      cashflow: effective.cashflow,
    },
  };
}

/** @deprecated Prefer selectFundamentalPeriod — kept for callers. */
export function preferLatestStatement(
  ttm: Row[],
  quarter: Row[],
  annual: Row[],
): Row[] {
  const sel = selectFundamentalPeriod({
    incomeTtm: ttm,
    incomeQuarter: quarter,
    incomeAnnual: annual,
    balanceTtm: [],
    balanceQuarter: [],
    balanceAnnual: [],
    cashflowTtm: [],
    cashflowQuarter: [],
    cashflowAnnual: [],
    ratiosTtm: null,
    ratiosAnnual: [],
    keyMetricsTtm: null,
    keyMetricsAnnual: [],
  });
  return statementsFor(sel.period, ttm, quarter, annual);
}

/** @deprecated Prefer selectFundamentalPeriod */
export function detectStatementPeriod(
  ttm: Row[],
  quarter: Row[],
  annual: Row[],
): FundamentalPeriod | null {
  if (!ttm.length && !quarter.length && !annual.length) return null;
  return selectFundamentalPeriod({
    incomeTtm: ttm,
    incomeQuarter: quarter,
    incomeAnnual: annual,
    balanceTtm: ttm,
    balanceQuarter: quarter,
    balanceAnnual: annual,
    cashflowTtm: ttm,
    cashflowQuarter: quarter,
    cashflowAnnual: annual,
    ratiosTtm: null,
    ratiosAnnual: [],
    keyMetricsTtm: null,
    keyMetricsAnnual: [],
  }).period;
}

export type StatementPeriod = FundamentalPeriod;

export function buildFundamentalInputsFromPackage(input: {
  profile: {
    marketCap: number | null;
    sector: string | null;
    sectorKey: string | null;
    industry: string | null;
    industryKey: string | null;
  };
  /** Latest quote price — used to compute PE when provider multiples are missing. */
  price?: number | null;
  ratiosTtm: Row | null;
  ratiosAnnual?: Row[];
  keyMetricsTtm: Row | null;
  keyMetricsAnnual?: Row[];
  incomeTtm: Row[];
  incomeQuarter: Row[];
  incomeAnnual: Row[];
  balanceTtm: Row[];
  balanceQuarter: Row[];
  balanceAnnual: Row[];
  cashflowTtm: Row[];
  cashflowQuarter: Row[];
  cashflowAnnual: Row[];
  scores: Row | null;
  estimates: Row[];
  enterpriseValues?: Row[];
  growth?: Row[];
  ownerEarnings?: Row[];
}): FundamentalInputs {
  const selection = selectFundamentalPeriod({
    incomeTtm: input.incomeTtm,
    incomeQuarter: input.incomeQuarter,
    incomeAnnual: input.incomeAnnual,
    balanceTtm: input.balanceTtm,
    balanceQuarter: input.balanceQuarter,
    balanceAnnual: input.balanceAnnual,
    cashflowTtm: input.cashflowTtm,
    cashflowQuarter: input.cashflowQuarter,
    cashflowAnnual: input.cashflowAnnual,
    ratiosTtm: input.ratiosTtm,
    ratiosAnnual: input.ratiosAnnual ?? [],
    keyMetricsTtm: input.keyMetricsTtm,
    keyMetricsAnnual: input.keyMetricsAnnual ?? [],
  });
  const period = selection.period;

  // When TTM is selected, use effective (native and/or constructed) rows — not empty native arrays
  const income: Row[] =
    period === "ttm"
      ? selection.effectiveTtm.income
        ? [selection.effectiveTtm.income]
        : []
      : statementsFor(
          period,
          input.incomeTtm,
          input.incomeQuarter,
          input.incomeAnnual,
        );
  const balance: Row[] =
    period === "ttm"
      ? selection.effectiveTtm.balance
        ? [selection.effectiveTtm.balance]
        : []
      : statementsFor(
          period,
          input.balanceTtm,
          input.balanceQuarter,
          input.balanceAnnual,
        );
  const cashflow: Row[] =
    period === "ttm"
      ? selection.effectiveTtm.cashflow
        ? [selection.effectiveTtm.cashflow]
        : []
      : statementsFor(
          period,
          input.cashflowTtm,
          input.cashflowQuarter,
          input.cashflowAnnual,
        );

  // Same-period ratios / key metrics only — never mix TTM ratios into annual/quarter score
  const ratios =
    period === "ttm"
      ? input.ratiosTtm
      : period === "annual"
        ? first(input.ratiosAnnual ?? [])
        : null;
  const metrics =
    period === "ttm"
      ? input.keyMetricsTtm
      : period === "annual"
        ? first(input.keyMetricsAnnual ?? [])
        : null;

  // Annual series reserved for multi-year trends (not mixed into core snapshot)
  const incomeAnnual = input.incomeAnnual;
  const balanceAnnual = input.balanceAnnual;
  const cashflowAnnual = input.cashflowAnnual;

  const inc0 = first(income);
  const bal0 = first(balance);
  const cf0 = first(cashflow);
  const scoreRow = input.scores;

  const totalRevenue =
    pick(inc0, "revenue") ??
    pickPeriod(metrics, period, "revenuePerShare");
  let ebitda = pickTrueEbitda(inc0, metrics, period);
  const ebit = pick(inc0, "operatingIncome", "ebit");

  // If statement lacks EBITDA but same-period ratios have ebitdaMargin, derive level
  if (ebitda == null && totalRevenue != null && totalRevenue !== 0) {
    const marginOnly = pickPeriod(ratios, period, "ebitdaMargin");
    if (marginOnly != null) {
      ebitda = marginOnly * totalRevenue;
    }
  }

  const totalDebt =
    pick(bal0, "totalDebt") ??
    (() => {
      const shortD = pick(bal0, "shortTermDebt");
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
  const totalEquity = pick(bal0, "totalStockholdersEquity", "totalEquity");
  const totalLiabilities = pick(bal0, "totalLiabilities");
  const currentAssets = pick(bal0, "totalCurrentAssets");
  const currentLiabilities = pick(bal0, "totalCurrentLiabilities");
  const retainedEarnings = pick(bal0, "retainedEarnings");
  const shortTermDebt = pick(bal0, "shortTermDebt");
  const workingCapital =
    currentAssets != null && currentLiabilities != null
      ? currentAssets - currentLiabilities
      : null;

  // Owner earnings only as same-period FCF substitute when CF row lacks FCF
  const owner0 = first(input.ownerEarnings ?? []);
  const ownerEarningsFcf = pick(
    owner0,
    "ownersEarnings",
    "ownerEarnings",
    "freeCashFlow",
  );

  const operatingCashflow = pick(cf0, "operatingCashFlow");
  const freeCashflow = resolveFreeCashFlow(cf0, ownerEarningsFcf);

  const cashFlowDistorted = isCashFlowDistortedIndustry({
    industryKey: input.profile.industryKey,
    sectorKey: input.profile.sectorKey,
    industry: input.profile.industry,
  });
  const cashFlowReliable = !cashFlowDistorted;
  const cashFlowNote = cashFlowDistorted
    ? "OCF/FCF less reliable for financial intermediaries (customer/float cash) — cash margins down-weighted."
    : null;

  const fcfSeries = cashflowAnnual
    .map((row) => pick(row, "freeCashFlow"))
    .filter((v): v is number => v != null)
    .slice(0, 5);
  const fcfStability = fcfStabilityScore(fcfSeries);
  let fcfGrowth: number | null = null;
  if (fcfSeries.length >= 2 && fcfSeries[1] !== 0) {
    fcfGrowth = (fcfSeries[0]! - fcfSeries[1]!) / Math.abs(fcfSeries[1]!);
  }

  const marketCap =
    input.profile.marketCap ??
    pick(first(input.enterpriseValues ?? []), "marketCapitalization", "marketCap");

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
    pickPeriod(metrics, period, "piotroskiScore");
  const beneishMScore = pick(
    scoreRow,
    "beneishScore",
    "beneishMScore",
    "mScore",
  );

  const debtToEquity =
    pickPeriod(
      ratios,
      period,
      "debtEquityRatio",
      "debtToEquityRatio",
      "debtToEquity",
    ) ??
    (totalDebt != null && totalEquity != null && totalEquity !== 0
      ? (totalDebt / totalEquity) * 100
      : null);
  const debtToEquityPct =
    debtToEquity != null && Math.abs(debtToEquity) < 5
      ? debtToEquity * 100
      : debtToEquity;

  const currentRatio =
    pickPeriod(ratios, period, "currentRatio") ??
    (currentAssets != null &&
    currentLiabilities != null &&
    currentLiabilities !== 0
      ? currentAssets / currentLiabilities
      : null);
  const quickRatio = pickPeriod(
    ratios,
    period,
    "quickRatio",
    "acidTestRatio",
  );
  const interestExpense = pick(inc0, "interestExpense");
  // Signed coverage — never abs() a negative ratio (loss-making EBIT must stay weak).
  // FMP often returns 0 for N/A when interest is negligible — treat 0 as missing, not distress.
  let interestCoverage =
    pickPeriod(
      ratios,
      period,
      "interestCoverageRatio",
      "interestCoverage",
    ) ??
    (ebit != null &&
    interestExpense != null &&
    Math.abs(interestExpense) > 1e-6
      ? ebit / interestExpense
      : null);
  if (interestCoverage === 0) interestCoverage = null;

  // Leverage vs EBITDA is undefined when EBITDA ≤ 0 — do not invent / score.
  const ebitdaPositive = ebitda != null && ebitda > 0;
  let netDebtToEbitda = ebitdaPositive
    ? pickPeriod(
        metrics,
        period,
        "netDebtToEBITDA",
        "netDebtToEbitda",
      ) ??
      pickPeriod(ratios, period, "netDebtToEBITDA", "netDebtToEbitda") ??
      (totalDebt != null && totalCash != null
        ? (totalDebt - totalCash) / ebitda!
        : null)
    : null;
  let debtToEbitda = ebitdaPositive
    ? pickPeriod(metrics, period, "debtToEbitda", "debtToEBITDA") ??
      pickPeriod(ratios, period, "debtToEbitda", "debtToEBITDA") ??
      (totalDebt != null ? totalDebt / ebitda! : null)
    : null;

  const equityToAssets =
    totalEquity != null && totalAssets != null && totalAssets !== 0
      ? totalEquity / totalAssets
      : null;
  const cashToDebt =
    totalCash != null && totalDebt != null && totalDebt > 0
      ? totalCash / totalDebt
      : totalCash != null && totalDebt === 0
        ? Math.max(totalCash > 0 ? 10 : 0, 0)
        : null;
  const cashToShortTermDebt =
    totalCash != null && shortTermDebt != null && shortTermDebt > 0
      ? totalCash / shortTermDebt
      : null;
  const fcfToDebt =
    freeCashflow != null && totalDebt != null && totalDebt > 0
      ? freeCashflow / totalDebt
      : null;
  const ocfToDebt =
    operatingCashflow != null && totalDebt != null && totalDebt > 0
      ? operatingCashflow / totalDebt
      : null;
  const revenueForDebt =
    pick(inc0, "revenue") ?? totalRevenue;
  const debtToRevenue =
    totalDebt != null &&
    revenueForDebt != null &&
    revenueForDebt > 0
      ? totalDebt / revenueForDebt
      : null;

  const qualityNotes: string[] = [];

  const returnOnInvestedCapital = resolveReturnMetric({
    label: "ROIC",
    packageRatio:
      pickPeriod(metrics, period, "roic", "returnOnInvestedCapital") ??
      pickPeriod(ratios, period, "returnOnInvestedCapital", "returnOnCapitalEmployed"),
    computed: annualRoic(inc0, bal0),
    notes: qualityNotes,
  });
  const wacc = normalizePackageReturn(
    pickPeriod(metrics, period, "wacc", "weightedAverageCostOfCapital"),
  );

  const stmtGross = (() => {
    const fromGp = statementMargin(inc0, "gross");
    if (fromGp != null) return fromGp;
    const rev = pick(inc0, "revenue");
    const cogs = pick(inc0, "costOfRevenue", "costOfGoodsSold");
    if (rev != null && rev !== 0 && cogs != null) {
      const m = (rev - cogs) / rev;
      return Number.isFinite(m) ? m : null;
    }
    return null;
  })();

  let grossMargins = resolveMargin({
    label: "Gross margin",
    statement: stmtGross,
    packageRatio: pickPeriod(ratios, period, "grossProfitMargin"),
    notes: qualityNotes,
  });
  let operatingMargins = resolveMargin({
    label: "Operating margin",
    statement: statementMargin(inc0, "operating"),
    packageRatio: pickPeriod(
      ratios,
      period,
      "operatingProfitMargin",
      "ebitMargin",
      "operatingMargin",
    ),
    notes: qualityNotes,
  });
  let profitMargins = resolveMargin({
    label: "Net margin",
    statement: statementMargin(inc0, "net"),
    packageRatio: pickPeriod(
      ratios,
      period,
      "netProfitMargin",
      "continuousOperationsProfitMargin",
      "netMargin",
    ),
    notes: qualityNotes,
  });

  const niEquity =
    pick(inc0, "netIncome") != null &&
    totalEquity != null &&
    totalEquity !== 0
      ? pick(inc0, "netIncome")! / totalEquity
      : null;
  const returnOnEquity = resolveReturnMetric({
    label: "ROE",
    packageRatio:
      pickPeriod(ratios, period, "returnOnEquity") ??
      pickPeriod(metrics, period, "roe", "returnOnEquity"),
    computed: niEquity,
    notes: qualityNotes,
  });
  const niAssets =
    pick(inc0, "netIncome") != null &&
    totalAssets != null &&
    totalAssets !== 0
      ? pick(inc0, "netIncome")! / totalAssets
      : null;
  const returnOnAssets = resolveReturnMetric({
    label: "ROA",
    packageRatio:
      pickPeriod(ratios, period, "returnOnAssets") ??
      pickPeriod(metrics, period, "roa", "returnOnAssets"),
    computed: niAssets,
    notes: qualityNotes,
  });

  const revenueForMargins = pick(inc0, "revenue") ?? totalRevenue;
  // EBITDA margin: true EBITDA / revenue — never apply percent shrink to statement quotient
  const ebitdaMarginStmt =
    ebitda != null && revenueForMargins != null && revenueForMargins !== 0
      ? ebitda / revenueForMargins
      : null;
  let ebitdaMargin = resolveMargin({
    label: "EBITDA margin",
    statement: ebitdaMarginStmt,
    packageRatio: pickPeriod(
      ratios,
      period,
      "ebitdaMargin",
      "ebitdaToRevenue",
    ),
    notes: qualityNotes,
  });
  const fcfMarginStmt =
    freeCashflow != null &&
    revenueForMargins != null &&
    revenueForMargins !== 0
      ? freeCashflow / revenueForMargins
      : null;
  let fcfMargin = resolveMargin({
    label: "FCF margin",
    statement: fcfMarginStmt,
    packageRatio: pickPeriod(
      ratios,
      period,
      "freeCashFlowMargin",
      "freeCashFlowsToSales",
      "freeCashFlowToRevenue",
    ),
    notes: qualityNotes,
  });
  const ocfMarginStmt =
    operatingCashflow != null &&
    revenueForMargins != null &&
    revenueForMargins !== 0
      ? operatingCashflow / revenueForMargins
      : null;
  let ocfMargin = resolveMargin({
    label: "OCF margin",
    statement: ocfMarginStmt,
    packageRatio: pickPeriod(
      ratios,
      period,
      "operatingCashFlowMargin",
      "operatingCashFlowSalesRatio",
      "operatingCashFlowToSales",
    ),
    notes: qualityNotes,
  });

  let statementMarginsDegraded = false;

  // Extreme positive accrual vs deep cash losses — omit / temper distorted net/EBITDA
  const cashDeepNeg =
    (ocfMargin != null && ocfMargin < -0.2) ||
    (fcfMargin != null && fcfMargin < -0.2);
  if (cashDeepNeg && profitMargins != null && profitMargins > 0.5) {
    const pkgNet = normalizePackageMargin(
      pickPeriod(ratios, period, "netProfitMargin"),
    );
    if (pkgNet != null && pkgNet < profitMargins && pkgNet < 0.5) {
      qualityNotes.push(
        "Net margin extreme vs cash reality — using more conservative package ratio.",
      );
      profitMargins = pkgNet;
    } else {
      qualityNotes.push(
        "Net margin extreme vs cash reality — omitting distorted net margin.",
      );
      profitMargins = null;
    }
    statementMarginsDegraded = true;
  }
  if (cashDeepNeg && ebitdaMargin != null && ebitdaMargin > 0.5) {
    const pkgEb = normalizePackageMargin(
      pickPeriod(ratios, period, "ebitdaMargin"),
    );
    if (pkgEb != null && pkgEb < ebitdaMargin && pkgEb < 0.5) {
      qualityNotes.push(
        "EBITDA margin extreme vs cash reality — using more conservative package ratio.",
      );
      ebitdaMargin = pkgEb;
    } else {
      qualityNotes.push(
        "EBITDA margin extreme vs cash reality — omitting distorted EBITDA margin.",
      );
      ebitdaMargin = null;
    }
    statementMarginsDegraded = true;
  }

  // —— Statement coherence / scale guards (same Fundamental Period) ——
  const rev = pick(inc0, "revenue");
  const gp = pick(inc0, "grossProfit");
  const cogs = pick(inc0, "costOfRevenue", "costOfGoodsSold");
  const opInc = pick(inc0, "operatingIncome", "ebit");
  const netInc = pick(inc0, "netIncome");

  if (rev != null && rev !== 0 && gp != null && cogs != null) {
    const impliedGp = rev - cogs;
    const gpGap = Math.abs(impliedGp - gp) / Math.max(Math.abs(rev), 1);
    if (gpGap > 0.05) {
      qualityNotes.push(
        "Gross profit vs revenue−COGS inconsistent — margin confidence reduced.",
      );
      statementMarginsDegraded = true;
    }
  }

  // Gross healthy but implied opex from GP−OI is tiny vs reported operating loss severity mismatch
  if (
    rev != null &&
    rev > 0 &&
    gp != null &&
    opInc != null &&
    grossMargins != null &&
    grossMargins > 0.15 &&
    operatingMargins != null
  ) {
    const stmtOm = opInc / rev;
    if (
      Number.isFinite(stmtOm) &&
      Math.abs(stmtOm - operatingMargins) > 0.12
    ) {
      qualityNotes.push(
        "Operating margin inconsistent with operating income / revenue — degraded.",
      );
      statementMarginsDegraded = true;
    }
  }

  // Critical gaps for thin / messy packages
  const criticalMissing =
    rev == null ||
    (opInc == null && netInc == null) ||
    (operatingCashflow == null && freeCashflow == null);
  if (criticalMissing) {
    qualityNotes.push(
      "Critical income/cash fields missing for selected period — Profitability confidence reduced.",
    );
    statementMarginsDegraded = true;
  }

  if (
    rev != null &&
    Math.abs(rev) < 1e7 &&
    ((opInc != null && opInc < -1e7) || (netInc != null && netInc < -1e7))
  ) {
    // Small revenue + large losses → extreme negative margins are expected/valid
    qualityNotes.push(
      "Thin revenue base with large losses — extreme negative margins allowed.",
    );
  }

  const incomeRows = incomeAnnual.slice(0, 3);
  const balanceRows = balanceAnnual.slice(0, 3);
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

  // PE / PEG resolved after EPS + estimates (aliases + price/EPS compute).
  const enterpriseValue =
    pickPeriod(metrics, period, "enterpriseValue") ??
    pick(first(input.enterpriseValues ?? []), "enterpriseValue") ??
    (marketCap != null
      ? marketCap + (totalDebt ?? 0) - (totalCash ?? 0)
      : null);
  let enterpriseToEbitda =
    pickPeriod(
      metrics,
      period,
      "enterpriseValueOverEBITDA",
      "evToEBITDA",
    ) ??
    pickPeriod(
      ratios,
      period,
      "enterpriseValueMultiple",
      "evToEBITDA",
      "enterpriseValueOverEBITDA",
    ) ??
    (enterpriseValue != null && ebitda != null && ebitda > 0
      ? enterpriseValue / ebitda
      : null);
  if (enterpriseToEbitda != null && (enterpriseToEbitda <= 0 || !ebitdaPositive)) {
    enterpriseToEbitda = null;
  }
  const priceToSales = pickPeriod(
    ratios,
    period,
    "priceToSalesRatio",
    "priceToSales",
  );
  let priceToFcf =
    pickPeriod(
      ratios,
      period,
      "priceToFreeCashFlowsRatio",
      "priceToFreeCashFlowRatio",
    ) ??
    (marketCap != null && freeCashflow != null && freeCashflow > 0
      ? marketCap / freeCashflow
      : null);
  if (priceToFcf != null && (priceToFcf <= 0 || freeCashflow == null || freeCashflow <= 0)) {
    priceToFcf = null;
  }
  let evToFcf =
    pickPeriod(
      metrics,
      period,
      "evToFreeCashFlow",
      "evToFCF",
      "enterpriseValueToFreeCashFlow",
    ) ??
    (enterpriseValue != null && freeCashflow != null && freeCashflow > 0
      ? enterpriseValue / freeCashflow
      : null);
  if (evToFcf != null && (evToFcf <= 0 || freeCashflow == null || freeCashflow <= 0)) {
    evToFcf = null;
  }
  const revenueForEv = pick(inc0, "revenue") ?? totalRevenue;
  const evToSales =
    pickPeriod(
      metrics,
      period,
      "evToSales",
      "enterpriseValueOverRevenue",
      "enterpriseValueToSales",
    ) ??
    (enterpriseValue != null && revenueForEv != null && revenueForEv > 0
      ? enterpriseValue / revenueForEv
      : null);
  let priceToOcf =
    pickPeriod(
      ratios,
      period,
      "priceToOperatingCashFlowRatio",
      "priceToOperatingCashFlowsRatio",
    ) ??
    (marketCap != null && operatingCashflow != null && operatingCashflow > 0
      ? marketCap / operatingCashflow
      : null);
  if (
    priceToOcf != null &&
    (priceToOcf <= 0 || operatingCashflow == null || operatingCashflow <= 0)
  ) {
    priceToOcf = null;
  }
  const evToEbit =
    pickPeriod(
      metrics,
      period,
      "evToEBIT",
      "enterpriseValueOverEBIT",
      "enterpriseValueToEBIT",
    ) ??
    (enterpriseValue != null && ebit != null && ebit > 0
      ? enterpriseValue / ebit
      : null);

  // Growth: same-period YoY when possible; package growth as annual-style actuals
  const priorIncome =
    period === "quarter"
      ? input.incomeQuarter[4] ?? input.incomeQuarter[1] ?? null
      : period === "annual"
        ? incomeAnnual[1] ?? null
        : incomeAnnual[1] ?? input.incomeTtm[1] ?? null;

  const rev0 = pick(inc0, "revenue");
  const rev1 = pick(priorIncome, "revenue");
  const eps0 = pick(inc0, "epsdiluted", "eps");
  const eps1 = pick(priorIncome, "epsdiluted", "eps");

  const growthRows = (input.growth ?? []).filter(
    (r) => r && r.__empty !== true,
  );
  const pkgRevenueGrowth = pickPackageGrowth(
    growthRows,
    "revenueGrowth",
    "growthRevenue",
    "growthInRevenue",
  );
  const pkgEarningsGrowth = pickPackageGrowth(
    growthRows,
    "epsgrowth",
    "epsGrowth",
    "growthEPS",
    "growthEPSDiluted",
    "netIncomeGrowth",
    "growthNetIncome",
  );
  const pkgFcfGrowth = pickPackageGrowth(
    growthRows,
    "freeCashFlowGrowth",
    "growthFreeCashFlow",
    "fcfGrowth",
  );
  const pkgOpIncomeGrowth = pickPackageGrowth(
    growthRows,
    "operatingIncomeGrowth",
    "growthOperatingIncome",
    "ebitGrowth",
  );

  const statementRevenueGrowth = yoyGrowth(rev0, rev1);
  const statementEarningsGrowth = yoyGrowth(eps0, eps1);

  // Prefer package growth for TTM/annual; for quarter prefer statement YoY first
  const revenueGrowth =
    period === "quarter"
      ? statementRevenueGrowth ?? pkgRevenueGrowth
      : pkgRevenueGrowth ?? statementRevenueGrowth;
  const earningsGrowth =
    period === "quarter"
      ? statementEarningsGrowth ?? pkgEarningsGrowth ?? pkgOpIncomeGrowth
      : pkgEarningsGrowth ?? statementEarningsGrowth ?? pkgOpIncomeGrowth;
  if (pkgFcfGrowth != null && period !== "quarter") {
    fcfGrowth = pkgFcfGrowth;
  } else if (period === "quarter") {
    const qFcf0 = pick(cf0, "freeCashFlow");
    const qFcf1 = pick(
      input.cashflowQuarter[4] ?? input.cashflowQuarter[1] ?? null,
      "freeCashFlow",
    );
    const qGrowth = yoyGrowth(qFcf0, qFcf1);
    if (qGrowth != null) fcfGrowth = qGrowth;
  }

  // True geometric 3Y CAGR only (≥4 annual points, both ends > 0).
  // Do not fill with avg-YoY / capped package averages — those are not real CAGR.
  const annualRevSeries = incomeAnnual
    .slice(0, 4)
    .map((r) => pick(r, "revenue"));
  const annualEpsSeries = incomeAnnual
    .slice(0, 4)
    .map((r) => pick(r, "epsdiluted", "eps"));
  const annualOpSeries = incomeAnnual
    .slice(0, 4)
    .map((r) => pick(r, "operatingIncome", "ebit"));
  const revenueGrowth3y = geometricCagr3y(annualRevSeries);
  const earningsGrowth3y = geometricCagr3y(annualEpsSeries);
  const operatingGrowth3y = geometricCagr3y(annualOpSeries);
  const operatingIncomeGrowth = pkgOpIncomeGrowth;

  const growthSourceParts: string[] = [];
  if (
    period !== "quarter" &&
    (pkgRevenueGrowth != null || pkgEarningsGrowth != null || pkgFcfGrowth != null)
  ) {
    growthSourceParts.push("FMP growth package");
  }
  if (statementRevenueGrowth != null || statementEarningsGrowth != null) {
    growthSourceParts.push(`${period} statement YoY`);
  }
  const growthSourceNote =
    growthSourceParts.length > 0
      ? `Growth sourced from ${growthSourceParts.join(" + ")} (Fundamental Period: ${period.toUpperCase()}).`
      : revenueGrowth == null && earningsGrowth == null
        ? "Growth rates unavailable — package growth and statement YoY both empty."
        : null;

  const est0 = first(
    (input.estimates ?? []).filter((r) => r && r.__empty !== true),
  );
  const estRevenueAvg = pick(est0, "revenueAvg", "estimatedRevenueAvg");
  const revenueEstimateGrowth =
    estRevenueAvg != null && rev0 != null && rev0 !== 0
      ? (estRevenueAvg - rev0) / Math.abs(rev0)
      : null;
  const forwardEps = pick(
    est0,
    "epsAvg",
    "estimatedEpsAvg",
    "estimatedEps",
    "eps",
  );
  const earningsEstimateGrowth =
    forwardEps != null && eps0 != null && eps0 !== 0
      ? (forwardEps - eps0) / Math.abs(eps0)
      : null;

  /**
   * Trailing / forward P/E + PEG.
   * FMP ratios often use priceToEarnings* keys (not peRatio). Prefer provider
   * multiples; else compute from price / positive EPS. Never invent PE when EPS ≤ 0.
   */
  const quotePrice =
    input.price != null && Number.isFinite(input.price) && input.price > 0
      ? input.price
      : null;
  const trailingEps =
    (eps0 != null && Number.isFinite(eps0) ? eps0 : null) ??
    pickPeriod(ratios, period, "netIncomePerShare") ??
    pickPeriod(metrics, period, "netIncomePerShare");

  let trailingPE =
    pickPeriod(
      ratios,
      period,
      "priceToEarningsDilutedRatio",
      "priceToEarningsRatio",
      "peRatio",
      "priceEarningsRatio",
    ) ??
    pickPeriod(
      metrics,
      period,
      "peRatio",
      "priceToEarningsRatio",
      "priceEarningsRatio",
    );
  if (
    (trailingPE == null || trailingPE <= 0) &&
    quotePrice != null &&
    trailingEps != null &&
    trailingEps > 0
  ) {
    trailingPE = quotePrice / trailingEps;
  }
  if (trailingPE != null && trailingPE <= 0) trailingPE = null;

  let forwardPE =
    pickPeriod(
      metrics,
      period,
      "forwardPERatio",
      "forwardPriceToEarningsRatio",
      "peForward",
    ) ??
    pickPeriod(
      ratios,
      period,
      "forwardPERatio",
      "forwardPriceToEarningsRatio",
    );
  if (
    (forwardPE == null || forwardPE <= 0) &&
    quotePrice != null &&
    forwardEps != null &&
    forwardEps > 0
  ) {
    forwardPE = quotePrice / forwardEps;
  }
  if (forwardPE != null && forwardPE <= 0) forwardPE = null;

  let pegRatio =
    pickPeriod(
      ratios,
      period,
      "pegRatio",
      "priceToEarningsGrowthRatio",
      "priceToEarningsDilutedGrowthRatio",
      "forwardPriceToEarningsGrowthRatio",
    ) ??
    pickPeriod(
      metrics,
      period,
      "pegRatio",
      "priceToEarningsGrowthRatio",
      "forwardPriceToEarningsGrowthRatio",
    );
  // Compute PEG when provider missing: valid PE + meaningful positive growth.
  // Prefer forward PE; else trailing PE. Never invent from PEG-named fields as PE.
  const peForPeg =
    forwardPE != null && forwardPE > 0
      ? forwardPE
      : trailingPE != null && trailingPE > 0
        ? trailingPE
        : null;
  const pegGrowth =
    earningsEstimateGrowth != null && earningsEstimateGrowth > 0.01
      ? earningsEstimateGrowth
      : earningsGrowth != null && earningsGrowth > 0.01
        ? earningsGrowth
        : null;
  if (
    (pegRatio == null || pegRatio <= 0) &&
    peForPeg != null &&
    pegGrowth != null
  ) {
    pegRatio = peForPeg / (pegGrowth * 100);
  }
  if (pegRatio != null && pegRatio <= 0) pegRatio = null;
  // PEG without a valid PE is not meaningful for scoring (provider noise on loss-makers).
  const hasValidPe =
    (trailingPE != null && trailingPE > 0) ||
    (forwardPE != null && forwardPE > 0);
  if (!hasValidPe) pegRatio = null;

  const fcfYield =
    freeCashflow != null &&
    freeCashflow > 0 &&
    marketCap != null &&
    marketCap > 0
      ? freeCashflow / marketCap
      : null;
  const earningsYield =
    trailingPE != null && trailingPE > 0
      ? 1 / trailingPE
      : trailingEps != null &&
          trailingEps > 0 &&
          quotePrice != null
        ? trailingEps / quotePrice
        : pickPeriod(metrics, period, "earningsYield");
  const earningsYieldClean =
    earningsYield != null && earningsYield > 0 ? earningsYield : null;

  const bookValue = pickPeriod(metrics, period, "bookValuePerShare");
  const sharesOutstanding =
    pick(
      inc0,
      "weightedAverageShsOutDil",
      "weightedAverageShsOutDiluted",
      "weightedAverageShsOut",
    ) ?? pickPeriod(metrics, period, "numberOfShares");

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
  const grossProfitPrior = pick(priorIncome, "grossProfit");

  const periodLabel =
    period === "ttm" ? "TTM" : period === "annual" ? "Annual" : "Quarter";
  const ttmPathNote =
    period === "ttm"
      ? selection.ttmSource === "constructed"
        ? " TTM statements constructed from last 4 quarters."
        : selection.ttmSource === "hybrid"
          ? " TTM mixes native statement TTM with constructed quarterly sums."
          : selection.ttmSource === "native"
            ? " Native statement TTM used."
            : ""
      : "";
  const periodSourceNote = `All fundamental pillars score on ${periodLabel} (same-period policy). ${selection.reason}${ttmPathNote}`;

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
    operatingIncomeGrowth,
    revenueGrowth3y,
    earningsGrowth3y,
    operatingGrowth3y,
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
    sector: input.profile.sector,
    sectorKey: input.profile.sectorKey,
    industry: input.profile.industry,
    industryKey: input.profile.industryKey,
    dataAsOf: new Date().toISOString(),
    equityToAssets,
    interestCoverage,
    netDebtToEbitda,
    debtToEbitda,
    cashToDebt,
    cashToShortTermDebt,
    fcfToDebt,
    ocfToDebt,
    debtToRevenue,
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
    cashFlowReliable,
    cashFlowNote,
    statementMarginsDegraded,
    statementQualityNotes: qualityNotes,
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
    fcfYield,
    earningsYield: earningsYieldClean,
    trailingPeMedian5y: null,
    capitalExpenditure,
    researchAndDevelopment,
    grossProfit,
    grossProfitPrior,
    dataSource: "fmp",
    statementPeriod: period,
    fundamentalPeriod: period,
    periodSelectionReason: selection.reason,
    periodSourceNote,
    periodTrendNotes: selection.trendNotes,
    periodCompleteness: selection.completeness[period],
    ttmSource: selection.ttmSource,
    constructedTtmFields: selection.constructedFields,
    growthSourceNote,
  };
}
