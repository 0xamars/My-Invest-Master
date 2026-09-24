/**
 * Whole-plan saves use `user_budget_plans.version`.
 * Callers pass the version they loaded. A mismatch is a conflict.
 * Inserts are only for plans that are not on the server yet.
 */
export class BudgetPlanConflictError extends Error {
  constructor(
    message = "This budget was updated in another tab or device. This tab did not overwrite it. Reload to see the latest version.",
  ) {
    super(message);
    this.name = "BudgetPlanConflictError";
  }
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
