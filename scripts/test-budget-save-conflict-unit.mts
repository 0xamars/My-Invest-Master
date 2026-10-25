/**
 * Budget plan saves must not silently overwrite a newer version.
 *   npx tsx --tsconfig tsconfig.json scripts/test-budget-save-conflict-unit.mts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BUDGET_PLAN_CONFLICT_MESSAGE,
  BudgetPlanConflictError,
  budgetPlanWriteAction,
  isBudgetPlanConflict,
  isMissingBudgetPlanVersionColumn,
  nextBudgetPlanVersion,
} from "../src/lib/budget/plan-version.ts";
import { budgetPlanBaseForSync } from "../src/lib/budget/plan-save-queue.ts";
import {
  budgetPlanReloadAction,
  remoteBudgetLoadAction,
  shouldFlushBudgetPlanOnLeave,
} from "../src/lib/budget/plan-session.ts";

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

assert(
  isMissingBudgetPlanVersionColumn({
    code: "42703",
    message: 'column "version" does not exist',
  }),
  "undefined_column falls back when version is missing",
);
assert(
  isMissingBudgetPlanVersionColumn({
    code: "PGRST204",
    message: "Could not find the 'version' column of 'user_budget_plans' in the schema cache",
  }),
  "schema-cache miss falls back when version is missing",
);
assert(
  !isMissingBudgetPlanVersionColumn({ code: "23505", message: "duplicate key" }),
  "a unique violation is not a missing-column fallback",
);
assert(
  !isMissingBudgetPlanVersionColumn(new Error("column version does not exist")),
  "a message without a PostgREST code is not a missing-column fallback",
);

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/016_budget_plan_version.sql"),
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
  saver.includes("isMissingBudgetPlanVersionColumn") &&
    saver.includes('.select("id, data")') &&
    saver.includes("versioning === false") &&
    saver.includes('from("user_budget_plans").upsert'),
  "a missing version column falls back to the pre-version load and upsert",
);
const versionedSave = saver.slice(
  saver.indexOf("const expectedVersion = options?.expectedVersion"),
  saver.indexOf("export async function deleteBudgetPlanFromCloud"),
);
assert(
  versionedSave.includes('eq("version", expectedVersion)') &&
    !versionedSave.includes(".upsert("),
  "versioned saves update only the loaded version and do not upsert",
);
const conflictUi = readFileSync(
  join(process.cwd(), "src/components/budget/budget-sync-error.tsx"),
  "utf8",
);
assert(
  conflictUi.includes("BUDGET_PLAN_CONFLICT_MESSAGE") && conflictUi.includes("Reload"),
  "a conflict shows a reload prompt",
);
const shell = readFileSync(
  join(process.cwd(), "src/components/budget/budget-shell.tsx"),
  "utf8",
);
assert(
  shell.includes("BudgetSyncError") && shell.includes("syncError"),
  "every budget page shows the conflict",
);
assert(
  budgetPlanBaseForSync("pending-edit", "rendered") === "pending-edit",
  "a bank sync starts from the edit that has not saved yet",
);
assert(
  budgetPlanBaseForSync(undefined, "rendered") === "rendered",
  "a bank sync uses the open plan when nothing is waiting",
);
assert(
  new BudgetPlanConflictError().message === BUDGET_PLAN_CONFLICT_MESSAGE,
  "the conflict error tells the user to reload the page",
);
assert(
  BUDGET_PLAN_CONFLICT_MESSAGE.toLowerCase().includes("replaces") &&
    BUDGET_PLAN_CONFLICT_MESSAGE.toLowerCase().includes("saved budget"),
  "the warning says reload replaces this tab before those edits are discarded",
);

assert(
  budgetPlanReloadAction({ loadedUserId: undefined, nextUserId: "user_a" }) === "reload",
  "the first load reads the server",
);
assert(
  budgetPlanReloadAction({ loadedUserId: "user_a", nextUserId: "user_a" }) === "keep",
  "a token refresh is the same session and does not reload",
);
assert(
  budgetPlanReloadAction({ loadedUserId: "user_a", nextUserId: "user_b" }) === "reload",
  "a different sign-in reloads",
);
assert(
  budgetPlanReloadAction({ loadedUserId: "user_a", nextUserId: null }) === "reload",
  "sign-out reloads",
);
assert(
  budgetPlanReloadAction({ loadedUserId: null, nextUserId: null }) === "keep",
  "staying signed out does not reload again",
);

const base = new Map<string, number>([["plan_sandbox", 2]]);
assert(
  remoteBudgetLoadAction({
    pendingPlanIds: ["plan_sandbox"],
    baseVersions: base,
    serverVersions: { plan_sandbox: 3 },
  }) === "keep-conflict",
  "a pending edit is not saved on top of a newer server version",
);
assert(
  remoteBudgetLoadAction({
    pendingPlanIds: ["plan_sandbox"],
    baseVersions: base,
    serverVersions: { plan_sandbox: 2 },
  }) === "keep-pending",
  "a pending edit at the same version stays on screen so it can save",
);
assert(
  remoteBudgetLoadAction({
    pendingPlanIds: [],
    baseVersions: base,
    serverVersions: { plan_sandbox: 4 },
  }) === "replace",
  "a reload with nothing waiting takes the server snapshot",
);
assert(
  remoteBudgetLoadAction({
    pendingPlanIds: ["plan_new"],
    baseVersions: base,
    serverVersions: { plan_sandbox: 2 },
  }) === "keep-pending",
  "a plan that is not on the server yet is not dropped by a reload",
);

assert(
  shouldFlushBudgetPlanOnLeave({ reason: "visibilitychange", visibilityState: "hidden" }),
  "hiding the tab flushes a waiting edit",
);
assert(
  !shouldFlushBudgetPlanOnLeave({ reason: "visibilitychange", visibilityState: "visible" }),
  "a visible tab keeps the debounce",
);
assert(
  shouldFlushBudgetPlanOnLeave({ reason: "pagehide", visibilityState: "visible" }),
  "leaving the page flushes a waiting edit",
);

const storageHook = readFileSync(
  join(process.cwd(), "src/hooks/use-budget-plans-storage.ts"),
  "utf8",
);
assert(
  storageHook.includes("budgetPlanReloadAction") &&
    storageHook.includes("remoteBudgetLoadAction") &&
    storageHook.includes("shouldFlushBudgetPlanOnLeave") &&
    storageHook.includes("}, [userId, isAuthLoading]);") &&
    !storageHook.includes("}, [user, isAuthLoading]);"),
  "the budget load follows the signed-in id, not a new user object",
);

console.log("budget save conflict unit tests passed");
