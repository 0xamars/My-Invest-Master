import type { CategoryGoal, CategoryGoalType } from "@/types/budget";
import { parseMonthKey } from "@/types/budget";

export const GOAL_TYPE_LABELS: Record<CategoryGoalType, string> = {
  "monthly-funding": "Monthly funding",
  "needed-for-spending": "Needed for spending",
  "target-balance": "Target balance",
};

export type CategoryGoalProgressStatus = "underfunded" | "on-track";

export interface CategoryGoalProgress {
  neededThisMonth: number;
  assignedThisMonth: number;
  remaining: number;
  monthsLeft: number | null;
  status: CategoryGoalProgressStatus;
}

const GOAL_TYPES = new Set<CategoryGoalType>([
  "monthly-funding",
  "needed-for-spending",
  "target-balance",
]);

export function isCategoryGoalType(value: unknown): value is CategoryGoalType {
  return typeof value === "string" && GOAL_TYPES.has(value as CategoryGoalType);
}

/** Months from `fromMonthKey` through `toMonthKey`, inclusive. Minimum 1. */
export function monthsInclusive(fromMonthKey: string, toMonthKey: string): number {
  const from = parseMonthKey(fromMonthKey);
  const to = parseMonthKey(toMonthKey);
  const delta =
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth()) +
    1;
  return Math.max(1, delta);
}

function targetMonthKey(targetDate: string | undefined): string | null {
  if (!targetDate || targetDate.length < 7) return null;
  return targetDate.slice(0, 7);
}

function neededByRemaining(
  remaining: number,
  targetDate: string | undefined,
  monthKey: string,
): { neededThisMonth: number; monthsLeft: number | null } {
  const targetMonth = targetMonthKey(targetDate);
  if (!targetMonth) {
    return { neededThisMonth: remaining, monthsLeft: null };
  }
  const monthsLeft = monthsInclusive(monthKey, targetMonth);
  return {
    neededThisMonth: Math.ceil(remaining / monthsLeft),
    monthsLeft,
  };
}

/**
 * How much should be assigned this month for the goal to stay on track.
 *
 * - Monthly funding: the target every month.
 * - Needed for spending: leftover of the target (minus prior assignments)
 *   spread across months left through the date.
 * - Target balance: leftover of the target (minus available at month start)
 *   spread across months left, or all remaining if there is no date.
 */
export function computeGoalProgress(
  goal: CategoryGoal,
  monthKey: string,
  input: {
    assignedThisMonth: number;
    assignedBeforeMonth: number;
    availableBeforeMonth: number;
  },
): CategoryGoalProgress {
  const assignedThisMonth = input.assignedThisMonth;
  const type = isCategoryGoalType(goal.type) ? goal.type : "target-balance";
  const target = Math.max(0, Math.round(goal.targetAmount));

  if (type === "monthly-funding") {
    return {
      neededThisMonth: target,
      assignedThisMonth,
      remaining: target,
      monthsLeft: null,
      status: assignedThisMonth >= target ? "on-track" : "underfunded",
    };
  }

  const remaining =
    type === "needed-for-spending"
      ? Math.max(0, target - input.assignedBeforeMonth)
      : Math.max(0, target - input.availableBeforeMonth);

  const { neededThisMonth, monthsLeft } = neededByRemaining(
    remaining,
    goal.targetDate,
    monthKey,
  );

  return {
    neededThisMonth,
    assignedThisMonth,
    remaining,
    monthsLeft,
    status: assignedThisMonth >= neededThisMonth ? "on-track" : "underfunded",
  };
}
