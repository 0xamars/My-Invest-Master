import {
  DEFAULT_CURRENT_AGE,
  DEFAULT_PLAN_CURRENCY,
  DEFAULT_PLAN_END_AGE,
  DEFAULT_RETIREMENT_AGE,
  DEFAULT_WITHDRAWAL_RATE,
  retirementAgeFromYear,
  retirementYearFromAges,
  type RetirementIncomeKind,
  type RetirementIncomeStream,
  type RetirementPlan,
  type RetirementPlanAsset,
  type RetirementPlanCurrency,
  type RetirementSpouse,
} from "@/types/retirement";
import type { AssetType } from "@/types/portfolio";

const ASSET_TYPES = new Set<AssetType>(["stock", "crypto", "custom", "cash"]);
const INCOME_KINDS = new Set<RetirementIncomeKind>([
  "cpp",
  "oas",
  "pension",
  "other",
]);

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function optionalString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function clampAge(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(120, Math.max(0, value));
}

function normalizeAssetType(value: unknown): AssetType {
  return typeof value === "string" && ASSET_TYPES.has(value as AssetType)
    ? (value as AssetType)
    : "custom";
}

function normalizeIncomeKind(value: unknown): RetirementIncomeKind {
  return typeof value === "string" && INCOME_KINDS.has(value as RetirementIncomeKind)
    ? (value as RetirementIncomeKind)
    : "other";
}

function normalizeCurrency(value: unknown): RetirementPlanCurrency {
  return value === "USD" || value === "CAD" ? value : DEFAULT_PLAN_CURRENCY;
}

function normalizeAsset(raw: unknown, index: number): RetirementPlanAsset | null {
  if (!isRecord(raw)) return null;

  const symbol = optionalString(raw.symbol, "").trim();
  if (!symbol) return null;

  return {
    id: optionalString(raw.id, `asset-${index}`),
    symbol,
    name: optionalString(raw.name, symbol),
    type: normalizeAssetType(raw.type),
    priceId: typeof raw.priceId === "string" ? raw.priceId : undefined,
    logoUrl: typeof raw.logoUrl === "string" ? raw.logoUrl : undefined,
    unitPrice: Math.max(0, finiteNumber(raw.unitPrice, 0)),
    quantity: Math.max(0, finiteNumber(raw.quantity, 0)),
    expectedCagr: finiteNumber(raw.expectedCagr, 0),
  };
}

function normalizeSpouse(raw: unknown): RetirementSpouse | null {
  if (!isRecord(raw)) return null;

  return {
    name: optionalString(raw.name, ""),
    currentAge: clampAge(finiteNumber(raw.currentAge, DEFAULT_CURRENT_AGE), DEFAULT_CURRENT_AGE),
    retirementAge: clampAge(
      finiteNumber(raw.retirementAge, DEFAULT_RETIREMENT_AGE),
      DEFAULT_RETIREMENT_AGE,
    ),
  };
}

function normalizeIncomeStream(
  raw: unknown,
  index: number,
): RetirementIncomeStream | null {
  if (!isRecord(raw)) return null;

  const kind = normalizeIncomeKind(raw.kind);

  return {
    id: optionalString(raw.id, `income-${index}`),
    name: optionalString(raw.name, kind.toUpperCase()),
    kind,
    annualAmount: Math.max(0, finiteNumber(raw.annualAmount, 0)),
    startAge: clampAge(finiteNumber(raw.startAge, 65), 65),
    colaWithInflation: raw.colaWithInflation !== false,
  };
}

function resolveCurrentAge(raw: UnknownRecord): number {
  if (typeof raw.currentAge === "number" && Number.isFinite(raw.currentAge)) {
    return clampAge(raw.currentAge, DEFAULT_CURRENT_AGE);
  }

  // Prefer an explicit currentAge (default 40). Inferring from
  // retirementYear − 20 is a last resort and is intentionally unused
  // while the calendar year is present — retirementAge is derived instead.
  return DEFAULT_CURRENT_AGE;
}

export function normalizeRetirementPlan(
  raw: unknown,
  options?: { currentYear?: number },
): RetirementPlan {
  const currentYear = options?.currentYear ?? new Date().getFullYear();
  const now = new Date().toISOString();
  const source = isRecord(raw) ? raw : {};

  const assets = Array.isArray(source.assets)
    ? source.assets
        .map((asset, index) => normalizeAsset(asset, index))
        .filter((asset): asset is RetirementPlanAsset => asset !== null)
    : [];

  const currentAge = resolveCurrentAge(source);
  const retirementYear = Math.round(
    finiteNumber(source.retirementYear, currentYear + 20),
  );

  const retirementAge = clampAge(
    typeof source.retirementAge === "number" && Number.isFinite(source.retirementAge)
      ? source.retirementAge
      : retirementAgeFromYear(currentAge, retirementYear, currentYear),
    DEFAULT_RETIREMENT_AGE,
  );

  const syncedRetirementYear =
    typeof source.retirementAge === "number" && Number.isFinite(source.retirementAge)
      ? retirementYearFromAges(currentAge, retirementAge, currentYear)
      : retirementYear;

  return {
    id: optionalString(source.id, crypto.randomUUID()),
    name: optionalString(source.name, "New Retirement Plan"),
    retirementYear: syncedRetirementYear,
    annualLifestyleSpending: Math.max(
      0,
      finiteNumber(source.annualLifestyleSpending, 60_000),
    ),
    inflationRate: finiteNumber(source.inflationRate, 3),
    priceProjectionScenario: "expected",
    assets,
    createdAt: optionalString(source.createdAt, now),
    updatedAt: optionalString(source.updatedAt, now),
    currentAge,
    retirementAge,
    planEndAge: clampAge(
      finiteNumber(source.planEndAge, DEFAULT_PLAN_END_AGE),
      DEFAULT_PLAN_END_AGE,
    ),
    spouse: normalizeSpouse(source.spouse),
    currency: normalizeCurrency(source.currency),
    withdrawalRate: Math.max(0.1, finiteNumber(source.withdrawalRate, DEFAULT_WITHDRAWAL_RATE)),
    annualContribution: Math.max(0, finiteNumber(source.annualContribution, 0)),
    incomeStreams: Array.isArray(source.incomeStreams)
      ? source.incomeStreams
          .map((stream, index) => normalizeIncomeStream(stream, index))
          .filter((stream): stream is RetirementIncomeStream => stream !== null)
      : [],
  };
}

export function normalizeRetirementPlans(
  plans: unknown[],
  options?: { currentYear?: number },
): RetirementPlan[] {
  return plans
    .filter((plan) => isRecord(plan) && typeof plan.id === "string")
    .map((plan) => normalizeRetirementPlan(plan, options));
}

export function applyRetirementPlanPatch(
  plan: RetirementPlan,
  patch: Partial<RetirementPlan>,
  currentYear: number = new Date().getFullYear(),
): RetirementPlan {
  const next: RetirementPlan = { ...plan, ...patch };

  if (patch.currentAge != null || patch.retirementAge != null) {
    next.retirementYear = retirementYearFromAges(
      next.currentAge,
      next.retirementAge,
      currentYear,
    );
  } else if (patch.retirementYear != null) {
    next.retirementAge = retirementAgeFromYear(
      next.currentAge,
      next.retirementYear,
      currentYear,
    );
  }

  if (next.planEndAge < next.retirementAge) {
    next.planEndAge = next.retirementAge;
  }

  return next;
}
