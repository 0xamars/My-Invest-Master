import type {
  BudgetPlan,
  BudgetScheduledTransaction,
  BudgetTransaction,
  BudgetTransactionSplit,
  RecurringFrequency,
} from "@/types/budget";
import { isSplitTransaction } from "@/lib/budget/transactions";

export const RECURRING_FREQUENCIES: RecurringFrequency[] = [
  "weekly",
  "every-2-weeks",
  "monthly",
  "yearly",
];

export const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: "Weekly",
  "every-2-weeks": "Every 2 weeks",
  monthly: "Monthly",
  yearly: "Yearly",
};

export interface UpcomingScheduledInstance {
  scheduleId: string;
  date: string;
  payee: string;
  accountId: string;
  transferAccountId?: string;
  categoryId: string | null;
  splits?: BudgetTransactionSplit[];
  amount: number;
  type: BudgetScheduledTransaction["type"];
  frequency: RecurringFrequency;
  memo?: string;
}

export function todayDateKey(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function padDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day + days);
  return padDateKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function addMonthsToDateKey(dateKey: string, months: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const totalMonths = year * 12 + (month - 1) + months;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonthIndex = totalMonths % 12;
  const clampedDay = Math.min(day, lastDayOfMonth(nextYear, nextMonthIndex));
  return padDateKey(nextYear, nextMonthIndex + 1, clampedDay);
}

export function addYearsToDateKey(dateKey: string, years: number): string {
  return addMonthsToDateKey(dateKey, years * 12);
}

export function nextScheduledDate(
  dateKey: string,
  frequency: RecurringFrequency,
): string {
  switch (frequency) {
    case "weekly":
      return addDaysToDateKey(dateKey, 7);
    case "every-2-weeks":
      return addDaysToDateKey(dateKey, 14);
    case "monthly":
      return addMonthsToDateKey(dateKey, 1);
    case "yearly":
      return addYearsToDateKey(dateKey, 1);
  }
}

export function isScheduledTransactionActive(
  schedule: BudgetScheduledTransaction,
): boolean {
  if (schedule.active === false) return false;
  if (
    typeof schedule.remainingCount === "number" &&
    schedule.remainingCount <= 0
  ) {
    return false;
  }
  if (schedule.endDate && schedule.nextDate > schedule.endDate) return false;
  return true;
}

export function canPostScheduledOccurrence(
  schedule: BudgetScheduledTransaction,
  date: string,
): boolean {
  if (!isScheduledTransactionActive(schedule)) return false;
  if (schedule.endDate && date > schedule.endDate) return false;
  return true;
}

function cloneSplits(
  splits: BudgetTransactionSplit[] | undefined,
): BudgetTransactionSplit[] | undefined {
  if (!splits || splits.length === 0) return undefined;
  return splits.map((line) => ({ ...line, id: crypto.randomUUID() }));
}

export function scheduledToPostedTransaction(
  schedule: BudgetScheduledTransaction,
  date: string,
  id: string = crypto.randomUUID(),
): BudgetTransaction {
  const splits =
    schedule.type === "outflow" ? cloneSplits(schedule.splits) : undefined;

  return {
    id,
    date,
    payee: schedule.payee,
    accountId: schedule.accountId,
    categoryId:
      schedule.type === "inflow" || schedule.type === "transfer" || splits
        ? null
        : schedule.categoryId,
    amount: Math.abs(schedule.amount),
    type: schedule.type,
    cleared: "uncleared",
    memo: schedule.memo,
    transferAccountId:
      schedule.type === "transfer" ? schedule.transferAccountId : undefined,
    splits,
    scheduledTransactionId: schedule.id,
  };
}

function alreadyPosted(
  transactions: BudgetTransaction[],
  scheduleId: string,
  date: string,
): boolean {
  return transactions.some(
    (tx) => tx.scheduledTransactionId === scheduleId && tx.date === date,
  );
}

function advanceAfterPost(
  schedule: BudgetScheduledTransaction,
  postedDate: string,
): BudgetScheduledTransaction {
  const remainingCount =
    typeof schedule.remainingCount === "number"
      ? Math.max(0, schedule.remainingCount - 1)
      : undefined;
  const nextDate = nextScheduledDate(postedDate, schedule.frequency);
  const exhausted =
    (typeof remainingCount === "number" && remainingCount <= 0) ||
    (schedule.endDate != null && nextDate > schedule.endDate);

  return {
    ...schedule,
    nextDate,
    remainingCount,
    active: exhausted ? false : schedule.active,
  };
}

const MAX_CATCH_UP = 400;

/**
 * Post due scheduled transactions as normal register rows.
 * Safe to run more than once: already-posted dates are skipped.
 * Returns the same plan reference when nothing is due.
 */
export function materializeDueSchedules(
  plan: BudgetPlan,
  asOf: string = todayDateKey(),
): BudgetPlan {
  const schedules = plan.scheduledTransactions ?? [];
  if (schedules.length === 0) return plan;

  let transactions = plan.transactions;
  let changed = false;
  const nextSchedules = schedules.map((schedule) => {
    if (!isScheduledTransactionActive(schedule)) return schedule;

    let current = schedule;
    let guard = 0;
    while (
      current.nextDate <= asOf &&
      canPostScheduledOccurrence(current, current.nextDate) &&
      guard < MAX_CATCH_UP
    ) {
      guard += 1;
      if (!alreadyPosted(transactions, current.id, current.nextDate)) {
        transactions = [
          ...transactions,
          scheduledToPostedTransaction(current, current.nextDate),
        ];
        changed = true;
      }
      const advanced = advanceAfterPost(current, current.nextDate);
      if (
        advanced.nextDate === current.nextDate &&
        advanced.remainingCount === current.remainingCount &&
        advanced.active === current.active
      ) {
        break;
      }
      current = advanced;
      changed = true;
    }
    return current;
  });

  if (!changed) return plan;

  return {
    ...plan,
    transactions,
    scheduledTransactions: nextSchedules,
  };
}

/**
 * Post the next scheduled occurrence immediately (even if the date is still
 * upcoming) and advance `nextDate`. Same posting rules as materialize.
 */
export function enterScheduledNow(
  plan: BudgetPlan,
  scheduleId: string,
): BudgetPlan {
  const schedules = plan.scheduledTransactions ?? [];
  const schedule = schedules.find((entry) => entry.id === scheduleId);
  if (!schedule) return plan;
  if (!canPostScheduledOccurrence(schedule, schedule.nextDate)) return plan;

  let transactions = plan.transactions;
  if (!alreadyPosted(transactions, schedule.id, schedule.nextDate)) {
    transactions = [
      ...transactions,
      scheduledToPostedTransaction(schedule, schedule.nextDate),
    ];
  }

  const advanced = advanceAfterPost(schedule, schedule.nextDate);
  if (
    transactions === plan.transactions &&
    advanced.nextDate === schedule.nextDate &&
    advanced.remainingCount === schedule.remainingCount &&
    advanced.active === schedule.active
  ) {
    return plan;
  }

  return {
    ...plan,
    transactions,
    scheduledTransactions: schedules.map((entry) =>
      entry.id === scheduleId ? advanced : entry,
    ),
  };
}

export function getUpcomingScheduledInstances(
  schedules: BudgetScheduledTransaction[] | undefined,
  options?: { fromDate?: string; horizonDays?: number; limitPerSchedule?: number },
): UpcomingScheduledInstance[] {
  const fromDate = options?.fromDate ?? todayDateKey();
  const horizonDays = options?.horizonDays ?? 60;
  const limitPerSchedule = options?.limitPerSchedule ?? 3;
  const until = addDaysToDateKey(fromDate, horizonDays);
  const instances: UpcomingScheduledInstance[] = [];

  for (const schedule of schedules ?? []) {
    if (!isScheduledTransactionActive(schedule)) continue;

    let date = schedule.nextDate;
    let remaining = schedule.remainingCount;
    let count = 0;
    let guard = 0;

    while (date <= until && count < limitPerSchedule && guard < MAX_CATCH_UP) {
      guard += 1;
      if (!canPostScheduledOccurrence({ ...schedule, remainingCount: remaining, nextDate: date }, date)) {
        break;
      }
      if (date >= fromDate) {
        instances.push({
          scheduleId: schedule.id,
          date,
          payee: schedule.payee,
          accountId: schedule.accountId,
          transferAccountId: schedule.transferAccountId,
          categoryId: schedule.categoryId,
          splits: schedule.splits,
          amount: schedule.amount,
          type: schedule.type,
          frequency: schedule.frequency,
          memo: schedule.memo,
        });
        count += 1;
      }
      if (typeof remaining === "number") {
        remaining -= 1;
        if (remaining <= 0) break;
      }
      date = nextScheduledDate(date, schedule.frequency);
      if (schedule.endDate && date > schedule.endDate) break;
    }
  }

  return instances.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.scheduleId.localeCompare(b.scheduleId);
  });
}

export function scheduleTouchesAccount(
  schedule: Pick<BudgetScheduledTransaction, "accountId" | "type" | "transferAccountId">,
  accountId: string,
): boolean {
  if (schedule.accountId === accountId) return true;
  return schedule.type === "transfer" && schedule.transferAccountId === accountId;
}

export function isScheduledSplit(
  schedule: Pick<BudgetScheduledTransaction, "splits">,
): boolean {
  return isSplitTransaction(schedule);
}
