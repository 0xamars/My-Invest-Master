import type { UserPlan } from "@/types/plan";

/** Fixed sentence. This app does not persist client or server errors. */
export const APP_ERRORS_NOTE = "This app does not store error reports.";

export const USER_HEALTH_KEYS = [
  "userId",
  "email",
  "createdAt",
  "plan",
  "budgetPlans",
  "accounts",
  "transactions",
  "portfolios",
  "retirePlans",
  "lastActivity",
  "errorsNote",
  "testAccount",
] as const;

export type UserHealthKey = (typeof USER_HEALTH_KEYS)[number];

export type UserHealth = {
  userId: string;
  email: string;
  createdAt: string | null;
  plan: UserPlan | "unknown";
  budgetPlans: number;
  accounts: number;
  transactions: number;
  portfolios: number;
  retirePlans: number;
  lastActivity: string | null;
  errorsNote: string;
  testAccount: boolean;
};

const MONEY_OR_SECRET_KEYS = [
  "holdings",
  "balances",
  "balance",
  "access_token",
  "transactions_cursor",
  "payee",
  "amount",
  "quantity",
  "unitPrice",
  "costPrice",
] as const;

export function healthExposesMoneyOrSecrets(value: object): boolean {
  return Object.keys(value).some((key) =>
    (MONEY_OR_SECRET_KEYS as readonly string[]).includes(key),
  );
}

export function isUserHealth(value: object): value is UserHealth {
  const keys = Object.keys(value);
  if (keys.length !== USER_HEALTH_KEYS.length) return false;
  if (!USER_HEALTH_KEYS.every((key) => keys.includes(key))) return false;
  if (healthExposesMoneyOrSecrets(value)) return false;
  const health = value as UserHealth;
  return (
    typeof health.transactions === "number" &&
    typeof health.accounts === "number" &&
    health.errorsNote === APP_ERRORS_NOTE
  );
}

function count(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.floor(number);
}

function planTier(value: unknown): UserPlan | "unknown" {
  if (value === "premium" || value === "free") return value;
  if (value == null || value === "") return "free";
  return "unknown";
}

export function buildUserHealth(input: {
  userId: string;
  email: string;
  createdAt: string | null;
  testAccount: boolean;
  row: {
    budget_plans?: unknown;
    budget_accounts?: unknown;
    budget_transactions?: unknown;
    portfolios?: unknown;
    retire_plans?: unknown;
    plan?: unknown;
    last_activity?: unknown;
  };
}): UserHealth {
  const last = input.row.last_activity;
  return {
    userId: input.userId,
    email: input.email,
    createdAt: input.createdAt,
    plan: planTier(input.row.plan),
    budgetPlans: count(input.row.budget_plans),
    accounts: count(input.row.budget_accounts),
    transactions: count(input.row.budget_transactions),
    portfolios: count(input.row.portfolios),
    retirePlans: count(input.row.retire_plans),
    lastActivity: typeof last === "string" && last.length > 0 ? last : null,
    errorsNote: APP_ERRORS_NOTE,
    testAccount: input.testAccount,
  };
}
