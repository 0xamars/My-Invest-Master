import {
  getCategoryAvailable,
  getReadyToAssign,
} from "@/lib/budget/calculations";
import {
  getClosedThrough,
  isMonthClosed,
} from "@/lib/budget/closed-months";
import { isPaymentCategory } from "@/lib/budget/credit-card-payments";
import { formatMonthLabel, getMonthKey, shiftMonthKey, type BudgetData } from "@/types/budget";

export interface MonthCloseEnvelopeLine {
  id: string;
  name: string;
  available: number;
}

export interface MonthClosePreview {
  monthKey: string;
  nextMonthKey: string;
  leftover: number;
  envelopes: MonthCloseEnvelopeLine[];
  cashOverspend: number;
  canClose: boolean;
  reason?: string;
}

export function canCloseMonth(
  budget: BudgetData,
  monthKey: string,
  today: Date = new Date(),
): { ok: true } | { ok: false; reason: string } {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    return { ok: false, reason: "Invalid month." };
  }
  if (monthKey > getMonthKey(today)) {
    return { ok: false, reason: "A future month cannot be closed." };
  }
  if (isMonthClosed(budget, monthKey)) {
    return { ok: false, reason: "This month is already closed." };
  }

  const leftover = getReadyToAssign(budget, monthKey);
  if (leftover < 0) {
    return {
      ok: false,
      reason: "Leftover is negative. Assign less or add income before closing.",
    };
  }

  const through = getClosedThrough(budget);
  if (typeof through === "string") {
    const expected = shiftMonthKey(through, 1);
    if (monthKey !== expected) {
      return {
        ok: false,
        reason: `Close ${formatMonthLabel(expected)} first.`,
      };
    }
  }

  return { ok: true };
}

export function previewMonthClose(
  budget: BudgetData,
  monthKey: string,
  today: Date = new Date(),
): MonthClosePreview {
  const check = canCloseMonth(budget, monthKey, today);
  const leftover = getReadyToAssign(budget, monthKey);
  const envelopes: MonthCloseEnvelopeLine[] = budget.categories
    .filter((category) => !isPaymentCategory(category))
    .map((category) => ({
      id: category.id,
      name: category.name,
      available: getCategoryAvailable(budget, category.id, monthKey),
    }));
  const cashOverspend = envelopes.reduce(
    (sum, line) => sum + Math.max(0, -line.available),
    0,
  );

  return {
    monthKey,
    nextMonthKey: shiftMonthKey(monthKey, 1),
    leftover,
    envelopes,
    cashOverspend,
    canClose: check.ok,
    reason: check.ok ? undefined : check.reason,
  };
}

export function applyMonthClose<T extends BudgetData>(
  budget: T,
  monthKey: string,
  options?: { now?: Date; closedAt?: string },
): T {
  const today = options?.now ?? new Date();
  const preview = previewMonthClose(budget, monthKey, today);
  if (!preview.canClose) return budget;

  const closedAt = options?.closedAt ?? today.toISOString();
  const currentMonth = budget.monthBudgets[monthKey] ?? { assignments: {} };
  const nextMonth = budget.monthBudgets[preview.nextMonthKey] ?? {
    assignments: {},
  };

  const closed: T = {
    ...budget,
    closedThrough: monthKey,
    monthBudgets: {
      ...budget.monthBudgets,
      [monthKey]: {
        ...currentMonth,
        closedAt,
      },
      [preview.nextMonthKey]: {
        ...nextMonth,
      },
    },
  };

  return {
    ...closed,
    monthBudgets: {
      ...closed.monthBudgets,
      [preview.nextMonthKey]: {
        ...closed.monthBudgets[preview.nextMonthKey],
        opening: {
          leftover: getReadyToAssign(closed, preview.nextMonthKey),
          envelopes: Object.fromEntries(
            preview.envelopes.map((line) => [
              line.id,
              getCategoryAvailable(closed, line.id, preview.nextMonthKey),
            ]),
          ),
        },
      },
    },
  };
}
