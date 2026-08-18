export const ACCOUNT_EXPORT_TABLES = [
  "user_budget_plans",
  "user_retirement_plans",
  "user_portfolio_plans",
] as const;

export type AccountExportTable = (typeof ACCOUNT_EXPORT_TABLES)[number];

export interface AccountExportPayload {
  exportedAt: string;
  userId: string;
  user_budget_plans: unknown[];
  user_retirement_plans: unknown[];
  user_portfolio_plans: unknown[];
}

export function buildAccountExportPayload(input: {
  exportedAt: string;
  userId: string;
  user_budget_plans: unknown[];
  user_retirement_plans: unknown[];
  user_portfolio_plans: unknown[];
}): AccountExportPayload {
  return {
    exportedAt: input.exportedAt,
    userId: input.userId,
    user_budget_plans: input.user_budget_plans,
    user_retirement_plans: input.user_retirement_plans,
    user_portfolio_plans: input.user_portfolio_plans,
  };
}

export function isAccountExportPayload(
  value: unknown,
): value is AccountExportPayload {
  if (!value || typeof value !== "object") return false;
  const raw = value as Record<string, unknown>;
  return (
    typeof raw.exportedAt === "string" &&
    typeof raw.userId === "string" &&
    Array.isArray(raw.user_budget_plans) &&
    Array.isArray(raw.user_retirement_plans) &&
    Array.isArray(raw.user_portfolio_plans)
  );
}
