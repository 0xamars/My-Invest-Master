import { pickOpenablePlan } from "@/lib/invest/leftover";

export const LAST_OPENED_BUDGET_PLAN_PREFIX =
  "investsalsa.last-opened-budget-plan";

const PLAN_SECTIONS = [
  "accounts",
  "transactions",
  "payee-rules",
  "reports",
] as const;

export type DatedBudgetPlanRef = {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export type PlanIdStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export function lastOpenedBudgetPlanStorageKey(
  userId: string | null | undefined,
): string {
  const scope = userId?.trim() ? userId.trim() : "local";
  return `${LAST_OPENED_BUDGET_PLAN_PREFIX}:${scope}`;
}

export function readLastOpenedBudgetPlanId(
  storage: PlanIdStorage | null | undefined,
  userId: string | null | undefined,
): string | null {
  if (!storage) return null;
  try {
    const value = storage.getItem(lastOpenedBudgetPlanStorageKey(userId));
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

export function writeLastOpenedBudgetPlanId(
  storage: PlanIdStorage | null | undefined,
  userId: string | null | undefined,
  planId: string,
): void {
  if (!storage) return;
  const trimmed = planId.trim();
  if (!trimmed) return;
  try {
    storage.setItem(lastOpenedBudgetPlanStorageKey(userId), trimmed);
  } catch {
    // Private mode and blocked storage stay quiet.
  }
}

/**
 * Home Budget link. Last opened wins when that plan still exists and the
 * tier can open it. Otherwise the latest plan from pickOpenablePlan, when
 * that one can be opened. Otherwise the first plan the tier can open.
 */
export function selectHomeBudgetPlan<T extends DatedBudgetPlanRef>(
  plans: readonly T[],
  lastOpenedId: string | null | undefined,
  canOpen: (planId: string) => boolean = () => true,
): T | null {
  if (lastOpenedId) {
    const remembered = plans.find((plan) => plan.id === lastOpenedId) ?? null;
    if (remembered && canOpen(remembered.id)) return remembered;
  }

  const latest = pickOpenablePlan([...plans]);
  if (latest && canOpen(latest.id)) return latest;

  return plans.find((plan) => canOpen(plan.id)) ?? null;
}

/** Same budget section on another plan, or that plan's overview. */
export function budgetPlanSwitchPath(
  pathname: string,
  fromPlanId: string,
  toPlanId: string,
): string {
  const root = `/budget/plans/${toPlanId}`;
  const prefix = `/budget/plans/${fromPlanId}`;
  if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) return root;
  const section = pathname.slice(prefix.length).split("/").filter(Boolean)[0];
  if (section && (PLAN_SECTIONS as readonly string[]).includes(section)) {
    return `${root}/${section}`;
  }
  return root;
}
