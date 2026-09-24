import {
  DEFAULT_PLAN_CURRENCY,
  DEFAULT_PLAN_END_AGE,
  DEFAULT_RETIREMENT_AGE,
  DEFAULT_WITHDRAWAL_RATE,
  defaultAccountKind,
  isAccountKind,
  retirementAgeFromYear,
  retirementYearFromAges,
  DEFAULT_WITHDRAWAL_ASSUMPTIONS,
  type RetirementIncomeKind,
  type RetirementIncomeStream,
  type RetirementPersonId,
  type RetirementPlan,
  type RetirementPlanAsset,
  type RetirementPlanCurrency,
  type RetirementSpouse,
  type RetirementWithdrawalAssumptions,
  type WithdrawalOrderId,
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

/** A stored age, or null when the field was never entered. */
function optionalAge(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(120, Math.max(0, value));
}

/** A stored spending amount, including zero. Null when the field is absent. */
function optionalSpending(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, value);
}

function normalizeAssetType(value: unknown): AssetType {
  return typeof value === "string" && ASSET_TYPES.has(value as AssetType)
    ? (value as AssetType)
    : "custom";
}

const WITHDRAWAL_ORDERS = new Set<WithdrawalOrderId>([
  "rrsp-first",
  "tfsa-last",
  "non-registered-first",
  "meltdown",
]);

function normalizeWithdrawalOrder(value: unknown): WithdrawalOrderId {
  return typeof value === "string" && WITHDRAWAL_ORDERS.has(value as WithdrawalOrderId)
    ? (value as WithdrawalOrderId)
    : DEFAULT_WITHDRAWAL_ASSUMPTIONS.selectedOrder;
}

function clampUnit(value: unknown, fallback: number): number {
  const number = finiteNumber(value, fallback);
  return Math.min(1, Math.max(0, number));
}

function optionalNonNegative(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, value);
}

function normalizeWithdrawalAssumptions(raw: unknown): RetirementWithdrawalAssumptions {
  const source = isRecord(raw) ? raw : {};
  return {
    selectedOrder: normalizeWithdrawalOrder(source.selectedOrder),
    unrealizedGainShare: clampUnit(
      source.unrealizedGainShare,
      DEFAULT_WITHDRAWAL_ASSUMPTIONS.unrealizedGainShare,
    ),
    capitalGainsInclusionRate: clampUnit(
      source.capitalGainsInclusionRate,
      DEFAULT_WITHDRAWAL_ASSUMPTIONS.capitalGainsInclusionRate,
    ),
    meltdownTargetIncome: optionalNonNegative(source.meltdownTargetIncome),
    annualTfsaRoom: optionalNonNegative(source.annualTfsaRoom),
  };
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

  const type = normalizeAssetType(raw.type);
  const owner: RetirementPersonId = raw.owner === "person2" ? "person2" : "person1";

  return {
    id: optionalString(raw.id, `asset-${index}`),
    symbol,
    name: optionalString(raw.name, symbol),
    type,
    priceId: typeof raw.priceId === "string" ? raw.priceId : undefined,
    logoUrl: typeof raw.logoUrl === "string" ? raw.logoUrl : undefined,
    unitPrice: Math.max(0, finiteNumber(raw.unitPrice, 0)),
    quantity: Math.max(0, finiteNumber(raw.quantity, 0)),
    expectedCagr: finiteNumber(raw.expectedCagr, 0),
    accountKind: isAccountKind(raw.accountKind)
      ? raw.accountKind
      : defaultAccountKind(type),
    owner,
    annualContribution: Math.max(0, finiteNumber(raw.annualContribution, 0)),
  };
}

function normalizeSpouse(raw: unknown): RetirementSpouse | null {
  if (!isRecord(raw)) return null;

  return {
    name: optionalString(raw.name, ""),
    currentAge: optionalAge(raw.currentAge),
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
    owner: raw.owner === "person2" ? "person2" : "person1",
    survivorPercent: Math.min(100, Math.max(0, finiteNumber(raw.survivorPercent, 0))),
  };
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

  const currentAge = optionalAge(source.currentAge);
  const storedRetirementYear =
    typeof source.retirementYear === "number" && Number.isFinite(source.retirementYear)
      ? Math.round(source.retirementYear)
      : null;
  const storedRetirementAge = optionalAge(source.retirementAge);

  const retirementAge =
    storedRetirementAge != null
      ? storedRetirementAge
      : currentAge != null && storedRetirementYear != null
        ? clampAge(
            retirementAgeFromYear(currentAge, storedRetirementYear, currentYear),
            DEFAULT_RETIREMENT_AGE,
          )
        : DEFAULT_RETIREMENT_AGE;

  // A target year needs a real current age. A stored year is kept as-is
  // when age is still missing, and is never invented from a default age.
  const retirementYear =
    currentAge != null
      ? retirementYearFromAges(currentAge, retirementAge, currentYear)
      : storedRetirementYear;

  return {
    id: optionalString(source.id, crypto.randomUUID()),
    name: optionalString(source.name, "New Retire plan"),
    retirementYear,
    annualLifestyleSpending: optionalSpending(source.annualLifestyleSpending),
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
    pensionSplitPercent: Math.min(
      50,
      Math.max(0, finiteNumber(source.pensionSplitPercent, 0)),
    ),
    incomeStreams: Array.isArray(source.incomeStreams)
      ? source.incomeStreams
          .map((stream, index) => normalizeIncomeStream(stream, index))
          .filter((stream): stream is RetirementIncomeStream => stream !== null)
      : [],
    withdrawalAssumptions: normalizeWithdrawalAssumptions(source.withdrawalAssumptions),
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

  if (patch.currentAge === null) {
    next.retirementYear = null;
  } else if (
    (patch.currentAge != null || patch.retirementAge != null) &&
    next.currentAge != null
  ) {
    next.retirementYear = retirementYearFromAges(
      next.currentAge,
      next.retirementAge,
      currentYear,
    );
  } else if (patch.retirementYear != null && next.currentAge != null) {
    next.retirementAge = retirementAgeFromYear(
      next.currentAge,
      patch.retirementYear,
      currentYear,
    );
  }

  if (next.planEndAge < next.retirementAge) {
    next.planEndAge = next.retirementAge;
  }

  return next;
}
