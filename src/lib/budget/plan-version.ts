/**
 * Whole-plan saves use `user_budget_plans.version`.
 * Callers pass the version they loaded. A mismatch is a conflict.
 * Inserts are only for plans that are not on the server yet.
 */
export const BUDGET_PLAN_CONFLICT_MESSAGE =
  "This budget was updated in another tab or device. This tab did not overwrite it. Reload the page to see the latest version.";

export class BudgetPlanConflictError extends Error {
  constructor(message = BUDGET_PLAN_CONFLICT_MESSAGE) {
    super(message);
    this.name = "BudgetPlanConflictError";
  }
}

/**
 * PostgREST reports a missing `version` column as 42703 (undefined_column)
 * or PGRST204 (column not in the schema cache). That happens when this
 * code ships before `016_budget_plan_version.sql` is applied.
 */
export function isMissingBudgetPlanVersionColumn(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }
  const code = String((error as { code?: unknown }).code ?? "");
  return code === "42703" || code === "PGRST204";
}

export function isBudgetPlanConflict(error: unknown): boolean {
  return (
    error instanceof BudgetPlanConflictError ||
    (error instanceof Error && error.name === "BudgetPlanConflictError")
  );
}

export function budgetPlanWriteAction(input: {
  expectedVersion: number | null;
  storedVersion: number | null;
}): "insert" | "update" | "conflict" {
  if (input.expectedVersion == null) {
    return input.storedVersion == null ? "insert" : "conflict";
  }
  if (input.storedVersion == null) return "conflict";
  if (input.storedVersion !== input.expectedVersion) return "conflict";
  return "update";
}

export function nextBudgetPlanVersion(expectedVersion: number): number {
  return expectedVersion + 1;
}

export function readBudgetPlanVersion(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}
