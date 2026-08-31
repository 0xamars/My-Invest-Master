/**
 * Build typed annual/quarter tape series from the FMP warehouse package.
 * Never invents years — skips missing series and footnotes gaps.
 */
import { classifyCapitalProfile } from "@/lib/analysis/rating/industry-model";
import {
  detectNonOperatingVehicle,
  nonOperatingVehicleFundamentalsMessage,
} from "@/lib/analysis/rating/non-operating-vehicle";
import type { AnalysisPackage, JsonRow } from "@/lib/market-data/warehouse/types";
import { fiscalYearLabel, pick, str } from "@/lib/ticker/pick";
import type {
  TapeBundle,
  TapeMissingEntry,
  TapePeriodKind,
  TapePoint,
  TapeVehicleInfo,
} from "@/lib/invest/assess/types";

type Row = JsonRow;

const ANNUAL_LIMIT = 10;
const QUARTER_LIMIT = 8;

const SERIES_KEYS = [
  "revenue",
  "netIncome",
  "ebitda",
  "operatingCashFlow",
  "freeCashFlow",
  "stockBasedCompensation",
  "dividendsPaid",
  "cashAndSti",
  "totalDebt",
] as const;

export type TapeSeriesMeta = TapeBundle & { hasDividends: boolean };

function periodKey(row: Row, kind: TapePeriodKind): string | null {
  if (kind === "annual") {
    return fiscalYearLabel(row);
  }
  const date = str(row.date) ?? str(row.fiscalDateEnding);
  if (date && date.length >= 7) return date.slice(0, 7);
  const year = fiscalYearLabel(row);
  const quarter = str(row.period);
  if (year && quarter) return `${year}-${quarter}`;
  return year;
}

function cashAndSti(row: Row | null): number | null {
  if (!row) return null;
  const combined = pick(row, "cashAndShortTermInvestments");
  if (combined != null) return combined;
  const cash = pick(row, "cashAndCashEquivalents");
  const sti = pick(row, "shortTermInvestments");
  if (cash != null && sti != null) return cash + sti;
  return cash ?? sti;
}

function dividendsPaid(row: Row | null): number | null {
  if (!row) return null;
  return (
    pick(row, "dividendsPaid", "commonDividendsPaid", "commonStockDividendsPaid") ??
    null
  );
}

function freeCashFlow(
  cfRow: Row | null,
  constructed: { ocf: number | null; capex: number | null },
): number | null {
  const reported = pick(cfRow, "freeCashFlow");
  if (reported != null) return reported;
  if (constructed.ocf != null && constructed.capex != null) {
    return constructed.ocf + constructed.capex;
  }
  return null;
}

function ebitda(incRow: Row | null): number | null {
  if (!incRow) return null;
  return pick(incRow, "ebitda", "EBITDA");
}

function indexRows(rows: Row[], kind: TapePeriodKind): Map<string, Row> {
  const map = new Map<string, Row>();
  for (const row of rows) {
    const key = periodKey(row, kind);
    if (!key || map.has(key)) continue;
    map.set(key, row);
  }
  return map;
}

function sortedPeriods(keys: string[], kind: TapePeriodKind): string[] {
  const unique = [...new Set(keys)];
  unique.sort((a, b) => a.localeCompare(b));
  if (kind === "annual") {
    return unique.slice(-ANNUAL_LIMIT);
  }
  return unique.slice(-QUARTER_LIMIT);
}

function buildPoints(input: {
  periods: string[];
  kind: TapePeriodKind;
  income: Map<string, Row>;
  cashflow: Map<string, Row>;
  balance: Map<string, Row>;
  missing: TapeMissingEntry[];
}): TapePoint[] {
  return input.periods.map((period) => {
    const inc = input.income.get(period) ?? null;
    const cf = input.cashflow.get(period) ?? null;
    const bal = input.balance.get(period) ?? null;
    const ocf = pick(cf, "operatingCashFlow");
    const capex = pick(cf, "capitalExpenditure");

    const point: TapePoint = {
      period,
      periodKind: input.kind,
      revenue: pick(inc, "revenue", "totalRevenue"),
      netIncome: pick(inc, "netIncome"),
      ebitda: ebitda(inc),
      operatingCashFlow: ocf,
      freeCashFlow: freeCashFlow(cf, { ocf, capex }),
      stockBasedCompensation: pick(
        cf,
        "stockBasedCompensation",
        "stockBasedCompensationExpense",
        "shareBasedCompensation",
        "shareBasedCompensationExpense",
      ),
      dividendsPaid: dividendsPaid(cf),
      cashAndSti: cashAndSti(bal),
      totalDebt: pick(bal, "totalDebt"),
    };

    for (const series of SERIES_KEYS) {
      if (point[series] == null) {
        input.missing.push({ period, series });
      }
    }

    return point;
  });
}

function hasDividends(points: TapePoint[]): boolean {
  return points.some((p) => p.dividendsPaid != null && p.dividendsPaid !== 0);
}

function detectQuarterlyBreak(
  annual: TapePoint[],
  quarterly: TapePoint[],
): { autoOpen: boolean; note: string | null } {
  if (quarterly.length < 2) {
    return { autoOpen: false, note: null };
  }

  const latest = quarterly[quarterly.length - 1]!;
  const prior = quarterly[quarterly.length - 2]!;

  const niFlip =
    latest.netIncome != null &&
    prior.netIncome != null &&
    Math.sign(latest.netIncome) !== Math.sign(prior.netIncome);

  const revFlip =
    latest.revenue != null &&
    prior.revenue != null &&
    Math.sign(latest.revenue) !== Math.sign(prior.revenue);

  if (niFlip || revFlip) {
    return {
      autoOpen: true,
      note: "Latest quarter flipped sign versus the prior quarter — check quarterly tape.",
    };
  }

  if (
    latest.freeCashFlow != null &&
    prior.freeCashFlow != null &&
    prior.freeCashFlow > 0 &&
    latest.freeCashFlow < prior.freeCashFlow * 0.5
  ) {
    return {
      autoOpen: true,
      note: "Free cash flow dropped sharply in the latest quarter.",
    };
  }

  if (annual.length >= 2) {
    const aLatest = annual[annual.length - 1]!;
    const aPrior = annual[annual.length - 2]!;
    const annualNiFlip =
      aLatest.netIncome != null &&
      aPrior.netIncome != null &&
      Math.sign(aLatest.netIncome) !== Math.sign(aPrior.netIncome);
    if (annualNiFlip) {
      return {
        autoOpen: true,
        note: "Annual net income sign changed — quarterly detail may clarify the break.",
      };
    }
  }

  return { autoOpen: false, note: null };
}

function resolveUnit(points: TapePoint[]): {
  unit: "millions" | "billions";
  unitLabel: string;
} {
  const max = points.reduce((acc, point) => {
    const values = [
      point.revenue,
      point.netIncome,
      point.ebitda,
      point.operatingCashFlow,
      point.freeCashFlow,
      point.cashAndSti,
      point.totalDebt,
    ].filter((v): v is number => v != null && Number.isFinite(v));
    const localMax = values.length ? Math.max(...values.map(Math.abs)) : 0;
    return Math.max(acc, localMax);
  }, 0);

  if (max >= 5_000_000_000) {
    return { unit: "billions", unitLabel: "USD billions" };
  }
  return { unit: "millions", unitLabel: "USD millions" };
}

function vehicleInfo(pkg: AnalysisPackage): TapeVehicleInfo {
  const profile = pkg.profile;
  const vehicle = detectNonOperatingVehicle(
    profile
      ? {
          name: profile.name,
          industry: profile.industry,
          industryKey: profile.industryKey,
          sector: profile.sector,
          sectorKey: profile.sectorKey,
          description: profile.description,
          exchange: profile.exchange,
          isEtf: profile.isEtf,
          isFund: profile.isFund,
          raw: profile.raw,
        }
      : {},
  );

  const fund = pkg.fundamentals;
  const capital = classifyCapitalProfile({
    industryKey: profile?.industryKey ?? null,
    sectorKey: profile?.sectorKey ?? null,
    industry: profile?.industry ?? null,
    sector: profile?.sector ?? null,
    name: profile?.name ?? null,
    description: profile?.description ?? null,
    profitMargins: fund?.profitMargins ?? null,
    operatingMargins: fund?.operatingMargins ?? null,
    freeCashflow: fund?.freeCashflow ?? null,
    operatingCashflow: fund?.operatingCashflow ?? null,
    totalRevenue: fund?.totalRevenue ?? null,
    ebitda: fund?.ebitda ?? null,
    revenueGrowth: fund?.revenueGrowth ?? null,
  });

  if (vehicle.isNonOperating) {
    return {
      isOperatingTape: false,
      label: vehicle.label,
      reason: nonOperatingVehicleFundamentalsMessage(vehicle),
      capitalProfile: capital,
    };
  }

  if (capital === "treasury_holding") {
    return {
      isOperatingTape: false,
      label: "Digital asset treasury",
      reason:
        "This is a treasury-holding vehicle, not a standard operating-company tape.",
      capitalProfile: capital,
    };
  }

  return {
    isOperatingTape: true,
    label: null,
    reason: null,
    capitalProfile: capital,
  };
}

export function buildTapeFromPackage(pkg: AnalysisPackage): TapeSeriesMeta {
  const missing: TapeMissingEntry[] = [];

  const incomeAnnual = indexRows(pkg.statements.income.annual ?? [], "annual");
  const incomeQuarter = indexRows(pkg.statements.income.quarter ?? [], "quarter");
  const cashflowAnnual = indexRows(pkg.statements.cashflow.annual ?? [], "annual");
  const cashflowQuarter = indexRows(pkg.statements.cashflow.quarter ?? [], "quarter");
  const balanceAnnual = indexRows(pkg.statements.balance.annual ?? [], "annual");
  const balanceQuarter = indexRows(pkg.statements.balance.quarter ?? [], "quarter");

  const annualPeriods = sortedPeriods(
    [
      ...incomeAnnual.keys(),
      ...cashflowAnnual.keys(),
      ...balanceAnnual.keys(),
    ],
    "annual",
  );

  const quarterPeriods = sortedPeriods(
    [
      ...incomeQuarter.keys(),
      ...cashflowQuarter.keys(),
      ...balanceQuarter.keys(),
    ],
    "quarter",
  );

  const annual = buildPoints({
    periods: annualPeriods,
    kind: "annual",
    income: incomeAnnual,
    cashflow: cashflowAnnual,
    balance: balanceAnnual,
    missing,
  });

  const quarterly = buildPoints({
    periods: quarterPeriods,
    kind: "quarter",
    income: incomeQuarter,
    cashflow: cashflowQuarter,
    balance: balanceQuarter,
    missing,
  });

  const { autoOpen, note } = detectQuarterlyBreak(annual, quarterly);
  const { unit, unitLabel } = resolveUnit([...annual, ...quarterly]);
  const vehicle = vehicleInfo(pkg);

  const hasAnyAnnual = annual.some((p) =>
    SERIES_KEYS.some((k) => p[k] != null),
  );

  const ttmIncome = pkg.statements.income.ttm?.[0];
  const ttmCaption =
    ttmIncome && hasAnyAnnual
      ? "Trailing twelve months (TTM) is shown in rating inputs only — not mixed onto the fiscal-year axis."
      : null;

  return {
    symbol: pkg.symbol,
    name: pkg.profile?.name ?? null,
    unit,
    unitLabel,
    annual,
    quarterly,
    missing,
    autoOpenQuarterly: autoOpen,
    quarterlyNote: note,
    vehicle,
    incomplete: !hasAnyAnnual || pkg.degraded,
    ttmCaption,
    hasDividends: hasDividends(annual),
  };
}

export function scaleTapeValue(
  value: number | null,
  unit: "millions" | "billions",
): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (unit === "billions") return value / 1_000_000_000;
  return value / 1_000_000;
}
