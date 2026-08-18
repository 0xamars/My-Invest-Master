import type { BudgetClearedState } from "@/types/budget";

const CLEARED_STATES = new Set<BudgetClearedState>([
  "uncleared",
  "cleared",
  "reconciled",
]);

export function isBudgetClearedState(value: unknown): value is BudgetClearedState {
  return typeof value === "string" && CLEARED_STATES.has(value as BudgetClearedState);
}

/**
 * Legacy `cleared: true` → cleared, `false` → uncleared.
 * Does not invent reconciled history.
 */
export function normalizeClearedState(value: unknown): BudgetClearedState {
  if (isBudgetClearedState(value)) return value;
  if (value === true) return "cleared";
  return "uncleared";
}

export function isClearedForBalance(state: BudgetClearedState | boolean | undefined): boolean {
  const normalized = normalizeClearedState(state);
  return normalized === "cleared" || normalized === "reconciled";
}

export function isUnclearedState(state: BudgetClearedState | boolean | undefined): boolean {
  return normalizeClearedState(state) === "uncleared";
}

export function isReconciledState(state: BudgetClearedState | boolean | undefined): boolean {
  return normalizeClearedState(state) === "reconciled";
}

/** Casual toggle: uncleared ↔ cleared. Reconciled stays locked. */
export function toggleClearedState(state: BudgetClearedState): BudgetClearedState {
  if (state === "reconciled") return "reconciled";
  return state === "cleared" ? "uncleared" : "cleared";
}

export function clearedStateFromCsvFlag(cleared: boolean): BudgetClearedState {
  return cleared ? "cleared" : "uncleared";
}
