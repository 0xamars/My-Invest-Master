import { ASSET_TYPE_LABELS } from "@/lib/portfolio/analytics";
import type { AssetType, TargetAllocation } from "@/types/portfolio";

export type { TargetAllocation };

export const TARGET_ALLOCATION_TYPES: AssetType[] = [
  "stock",
  "crypto",
  "cash",
  "custom",
];

/** Used when the portfolio JSONB has no saved targets. */
export const DEFAULT_TARGET_ALLOCATION: TargetAllocation = {
  stock: 80,
  crypto: 10,
  cash: 10,
  custom: 0,
};

export type AllocationDriftAction = "trim" | "add" | "hold";

export interface AllocationDriftRow {
  type: AssetType;
  label: string;
  actualPercent: number;
  targetPercent: number;
  /** Actual minus target, in percentage points. */
  driftPercent: number;
  /** Positive = overweight (trim); negative = underweight (add). */
  dollarDelta: number;
  action: AllocationDriftAction;
}

function asFinitePercent(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

export function isTargetAllocation(
  value: unknown,
): value is TargetAllocation {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return TARGET_ALLOCATION_TYPES.every(
    (type) => typeof record[type] === "number" && Number.isFinite(record[type]),
  );
}

export function parseStoredTargetAllocation(
  value: unknown,
): TargetAllocation | undefined {
  if (!isTargetAllocation(value)) return undefined;
  return {
    stock: asFinitePercent(value.stock),
    crypto: asFinitePercent(value.crypto),
    cash: asFinitePercent(value.cash),
    custom: asFinitePercent(value.custom),
  };
}

export function resolveTargetAllocation(
  stored: TargetAllocation | undefined,
): { targets: TargetAllocation; isDefault: boolean } {
  if (!stored) {
    return { targets: { ...DEFAULT_TARGET_ALLOCATION }, isDefault: true };
  }
  const sum = TARGET_ALLOCATION_TYPES.reduce(
    (total, type) => total + asFinitePercent(stored[type]),
    0,
  );
  if (sum <= 0) {
    return { targets: { ...DEFAULT_TARGET_ALLOCATION }, isDefault: true };
  }
  return { targets: stored, isDefault: false };
}

export function normalizeTargetAllocation(
  input: Partial<TargetAllocation> | null | undefined,
): TargetAllocation {
  const raw: TargetAllocation = {
    stock: asFinitePercent(input?.stock),
    crypto: asFinitePercent(input?.crypto),
    cash: asFinitePercent(input?.cash),
    custom: asFinitePercent(input?.custom),
  };
  const sum = TARGET_ALLOCATION_TYPES.reduce(
    (total, type) => total + raw[type],
    0,
  );
  if (sum <= 0) return { ...DEFAULT_TARGET_ALLOCATION };
  return {
    stock: (raw.stock / sum) * 100,
    crypto: (raw.crypto / sum) * 100,
    cash: (raw.cash / sum) * 100,
    custom: (raw.custom / sum) * 100,
  };
}

const HOLD_THRESHOLD_PERCENT = 0.5;
const HOLD_THRESHOLD_DOLLARS = 1;

export function buildAllocationDrift(
  actualPercents: Partial<Record<AssetType, number>>,
  targets: TargetAllocation,
  totalValue: number,
): AllocationDriftRow[] {
  return TARGET_ALLOCATION_TYPES.map((type) => {
    const actualPercent = asFinitePercent(actualPercents[type]);
    const targetPercent = asFinitePercent(targets[type]);
    const driftPercent = actualPercent - targetPercent;
    const dollarDelta = totalValue > 0 ? (driftPercent / 100) * totalValue : 0;
    const action: AllocationDriftAction =
      Math.abs(driftPercent) < HOLD_THRESHOLD_PERCENT ||
      Math.abs(dollarDelta) < HOLD_THRESHOLD_DOLLARS
        ? "hold"
        : dollarDelta > 0
          ? "trim"
          : "add";

    return {
      type,
      label: ASSET_TYPE_LABELS[type],
      actualPercent,
      targetPercent,
      driftPercent,
      dollarDelta,
      action,
    };
  });
}
