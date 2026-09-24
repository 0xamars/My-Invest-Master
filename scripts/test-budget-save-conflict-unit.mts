/**
 * Budget plan saves must not silently overwrite a newer version.
 *   npx tsx --tsconfig tsconfig.json scripts/test-budget-save-conflict-unit.mts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BudgetPlanConflictError,
  budgetPlanWriteAction,
  isBudgetPlanConflict,
  nextBudgetPlanVersion,
} from "../src/lib/budget/plan-version.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

assert(
  budgetPlanWriteAction({ expectedVersion: null, storedVersion: null }) === "insert",
  "a new plan inserts",
);
assert(
  budgetPlanWriteAction({ expectedVersion: null, storedVersion: 1 }) === "conflict",
  "an insert that finds a row is a conflict",
);
assert(
  budgetPlanWriteAction({ expectedVersion: 1, storedVersion: null }) === "conflict",
  "an update of a deleted plan is a conflict",
);
assert(
  budgetPlanWriteAction({ expectedVersion: 1, storedVersion: 1 }) === "update",
  "the loaded version can update",
);
assert(
  budgetPlanWriteAction({ expectedVersion: 1, storedVersion: 2 }) === "conflict",
  "a stale version conflicts",
);
assert(nextBudgetPlanVersion(1) === 2, "a successful save bumps the version by one");

type Row = { version: number; label: string };
const store = new Map<string, Row>();

function write(id: string, expected: number | null, label: string): number {
  const stored = store.get(id) ?? null;
  const action = budgetPlanWriteAction({
    expectedVersion: expected,
    storedVersion: stored?.version ?? null,
  });
  if (action === "conflict") throw new BudgetPlanConflictError();
  if (action === "insert") {
    store.set(id, { version: 1, label });
    return 1;
  }
  const version = nextBudgetPlanVersion(expected ?? 0);
  store.set(id, { version, label });
  return version;
}

const first = write("plan_sandbox", null, "Groceries");
assert(first === 1 && store.get("plan_sandbox")?.label === "Groceries", "first save inserts");

const tabA = write("plan_sandbox", 1, "Rent");
assert(tabA === 2 && store.get("plan_sandbox")?.label === "Rent", "first writer wins");

let conflict: unknown;
try {
  write("plan_sandbox", 1, "Coffee");
} catch (error) {
  conflict = error;
}
assert(isBudgetPlanConflict(conflict), "second tab gets a conflict");
assert(
  store.get("plan_sandbox")?.label === "Rent" && store.get("plan_sandbox")?.version === 2,
  "the stale tab does not overwrite",
);

const again = write("plan_sandbox", 2, "Rent and utilities");
assert(again === 3, "the tab that reloads the new version can save");
assert(
  store.get("plan_sandbox")?.label === "Rent and utilities",
  "the reloaded tab writes its plan",
);

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/015_budget_plan_version.sql"),
  "utf8",
);
assert(
  migration.includes("add column if not exists version") &&
    migration.includes("default 1"),
  "existing budget rows start at version 1",
);

const saver = readFileSync(
  join(process.cwd(), "src/lib/supabase/user-data.ts"),
  "utf8",
);
assert(
  saver.includes('eq("version", expectedVersion)') &&
    saver.includes("BudgetPlanConflictError") &&
    saver.includes("nextBudgetPlanVersion"),
  "cloud save updates only the loaded version",
);
assert(
  !saver.includes('from("user_budget_plans").upsert'),
  "budget plan saves no longer upsert over a newer row",
);

console.log("budget save conflict unit tests passed");
