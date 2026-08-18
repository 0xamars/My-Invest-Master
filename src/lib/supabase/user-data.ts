import { createClient } from "@/lib/supabase/client";
import type { BudgetData, BudgetPlan } from "@/types/budget";
import { createDefaultAccount } from "@/types/budget";
import { normalizeBudgetPlan } from "@/lib/budget/migrate-plan";
import type { DisplayCurrency } from "@/types/currency";
import type { OptionsPosition } from "@/types/options";
import { isUserPlan, type UserPlan } from "@/types/plan";
import type { PortfolioHolding, UserPortfolio } from "@/types/portfolio";
import { createEmptyPortfolio } from "@/types/portfolio";
import type { RetirementPlan } from "@/types/retirement";
import {
  isWatchlistAssetType,
  type UserWatchlist,
  type WatchlistItem,
} from "@/types/watchlist";
import { parseDisplayCurrency } from "@/types/currency";

function getClient() {
  return createClient();
}

export async function waitForSupabaseSession(
  timeoutMs = 5000,
): Promise<void> {
  const supabase = getClient();
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error("Unable to establish auth session for cloud sync.");
}

/** @deprecated Legacy single-portfolio table. Prefer portfolio plans APIs. */
export async function loadPortfolioFromCloud(
  userId: string,
): Promise<PortfolioHolding[] | null> {
  await waitForSupabaseSession();
  const supabase = getClient();
  const { data, error } = await supabase
    .from("user_portfolios")
    .select("holdings")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return parseJsonArray<PortfolioHolding>(data.holdings);
}

function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizePortfolio(raw: unknown): UserPortfolio | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<UserPortfolio>;
  if (typeof data.id !== "string" || typeof data.name !== "string") return null;

  return {
    id: data.id,
    name: data.name.trim() || "My Portfolio",
    isPrimary: Boolean(data.isPrimary),
    holdings: Array.isArray(data.holdings)
      ? (data.holdings as PortfolioHolding[])
      : [],
    createdAt:
      typeof data.createdAt === "string"
        ? data.createdAt
        : new Date().toISOString(),
    updatedAt:
      typeof data.updatedAt === "string"
        ? data.updatedAt
        : new Date().toISOString(),
  };
}

function ensureSinglePrimary(portfolios: UserPortfolio[]): UserPortfolio[] {
  if (portfolios.length === 0) return portfolios;

  const primaryIndex = portfolios.findIndex((portfolio) => portfolio.isPrimary);
  const resolvedPrimaryIndex = primaryIndex >= 0 ? primaryIndex : 0;

  return portfolios.map((portfolio, index) => ({
    ...portfolio,
    isPrimary: index === resolvedPrimaryIndex,
  }));
}

/** @deprecated Writes legacy table only — used during migration fallbacks. */
export async function savePortfolioToCloud(
  userId: string,
  holdings: PortfolioHolding[],
): Promise<void> {
  await waitForSupabaseSession();
  const supabase = getClient();
  const { error } = await supabase.from("user_portfolios").upsert(
    {
      user_id: userId,
      holdings,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) throw error;
}

export async function loadPortfolioPlansFromCloud(
  userId: string,
): Promise<UserPortfolio[]> {
  await waitForSupabaseSession();
  const supabase = getClient();
  const { data, error } = await supabase
    .from("user_portfolio_plans")
    .select("id, data")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  if (!data) return [];

  const portfolios = data
    .map((row) => {
      const normalized = normalizePortfolio(row.data);
      if (!normalized) return null;
      return { ...normalized, id: row.id };
    })
    .filter((portfolio): portfolio is UserPortfolio => portfolio !== null);

  return ensureSinglePrimary(portfolios);
}

export async function savePortfolioPlanToCloud(
  userId: string,
  portfolio: UserPortfolio,
): Promise<void> {
  await waitForSupabaseSession();
  const supabase = getClient();
  const { error } = await supabase.from("user_portfolio_plans").upsert(
    {
      id: portfolio.id,
      user_id: userId,
      data: portfolio,
      updated_at: portfolio.updatedAt,
    },
    { onConflict: "id" },
  );

  if (error) throw error;
}

export async function deletePortfolioPlanFromCloud(
  portfolioId: string,
): Promise<void> {
  await waitForSupabaseSession();
  const supabase = getClient();
  const { error } = await supabase
    .from("user_portfolio_plans")
    .delete()
    .eq("id", portfolioId);

  if (error) throw error;
}

/**
 * Load portfolio plans, migrating from the legacy single-portfolio row when needed.
 * New users with no legacy data start with zero portfolios (create the first one).
 */
export async function loadOrMigratePortfolioPlans(
  userId: string,
): Promise<UserPortfolio[]> {
  let plans: UserPortfolio[] = [];

  try {
    plans = await loadPortfolioPlansFromCloud(userId);
  } catch {
    // Table may not exist yet before migration 006 is applied.
    plans = [];
  }

  if (plans.length > 0) {
    return ensureSinglePrimary(plans);
  }

  const legacyHoldings = await loadPortfolioFromCloud(userId);
  // null = no legacy row (brand-new user). [] = legacy row with empty holdings.
  if (legacyHoldings === null) {
    return [];
  }

  const migrated = createEmptyPortfolio("My Portfolio", { isPrimary: true });
  migrated.holdings = legacyHoldings;

  try {
    await savePortfolioPlanToCloud(userId, migrated);
    return [migrated];
  } catch {
    // If multi-portfolio table is unavailable, still return an in-memory primary
    // so existing holdings remain usable until migration 006 is applied.
    return [migrated];
  }
}

export async function loadOptionsFromCloud(
  userId: string,
): Promise<OptionsPosition[] | null> {
  await waitForSupabaseSession();
  const supabase = getClient();
  const { data, error } = await supabase
    .from("user_options")
    .select("positions")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return parseJsonArray<OptionsPosition>(data.positions);
}

export async function saveOptionsToCloud(
  userId: string,
  positions: OptionsPosition[],
): Promise<void> {
  await waitForSupabaseSession();
  const supabase = getClient();
  const { error } = await supabase.from("user_options").upsert(
    {
      user_id: userId,
      positions,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) throw error;
}

export type UserPreferencesRecord = {
  displayCurrency: DisplayCurrency;
  plan: UserPlan;
};

export async function loadPreferencesFromCloud(
  userId: string,
): Promise<UserPreferencesRecord | null> {
  await waitForSupabaseSession();
  const supabase = getClient();
  const { data, error } = await supabase
    .from("user_preferences")
    .select("display_currency, plan")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    // Compatible with DBs that have not yet run 005_user_plan.sql
    const missingPlanColumn =
      error.message.includes("plan") ||
      error.code === "42703" ||
      error.message.toLowerCase().includes("column");

    if (!missingPlanColumn) throw error;

    const fallback = await supabase
      .from("user_preferences")
      .select("display_currency")
      .eq("user_id", userId)
      .maybeSingle();

    if (fallback.error) throw error;
    if (!fallback.data) return null;

    return {
      displayCurrency: parseDisplayCurrency(fallback.data.display_currency),
      plan: "free",
    };
  }

  if (!data) return null;

  return {
    displayCurrency: parseDisplayCurrency(data.display_currency),
    plan: isUserPlan(data.plan) ? data.plan : "free",
  };
}

export async function savePreferencesToCloud(
  userId: string,
  preferences: {
    displayCurrency: DisplayCurrency;
    plan?: UserPlan;
  },
): Promise<void> {
  await waitForSupabaseSession();
  const supabase = getClient();
  const { error } = await supabase.from("user_preferences").upsert(
    {
      user_id: userId,
      display_currency: preferences.displayCurrency,
      ...(preferences.plan ? { plan: preferences.plan } : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) throw error;
}

export async function loadRetirementPlansFromCloud(
  userId: string,
): Promise<RetirementPlan[]> {
  await waitForSupabaseSession();
  const supabase = getClient();
  const { data, error } = await supabase
    .from("user_retirement_plans")
    .select("data")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  if (!data) return [];

  return data
    .map((row) => row.data as RetirementPlan)
    .filter((plan) => plan && typeof plan.id === "string");
}

export async function saveRetirementPlanToCloud(
  userId: string,
  plan: RetirementPlan,
): Promise<void> {
  await waitForSupabaseSession();
  const supabase = getClient();
  const { error } = await supabase.from("user_retirement_plans").upsert(
    {
      id: plan.id,
      user_id: userId,
      data: plan,
      updated_at: plan.updatedAt,
    },
    { onConflict: "id" },
  );

  if (error) throw error;
}

export async function deleteRetirementPlanFromCloud(planId: string): Promise<void> {
  await waitForSupabaseSession();
  const supabase = getClient();
  const { error } = await supabase
    .from("user_retirement_plans")
    .delete()
    .eq("id", planId);

  if (error) throw error;
}

export async function loadBudgetPlansFromCloud(
  userId: string,
): Promise<BudgetPlan[]> {
  await waitForSupabaseSession();
  const supabase = getClient();
  const { data, error } = await supabase
    .from("user_budget_plans")
    .select("data")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  const plans = (data ?? [])
    .map((row) => row.data as BudgetPlan)
    .filter((plan) => plan && typeof plan.id === "string")
    .map(normalizeBudgetPlan);

  if (plans.length > 0) return plans;

  const legacy = await loadBudgetFromCloud(userId);
  if (!legacy) return [];

  const now = new Date().toISOString();
  const defaultAccount = createDefaultAccount();
  const migrated = normalizeBudgetPlan({
    id: crypto.randomUUID(),
    name: "My Budget",
    accounts: [defaultAccount],
    categoryGroups: legacy.categoryGroups,
    categories: legacy.categories,
    transactions: legacy.transactions.map((tx) => ({
      ...tx,
      accountId: defaultAccount.id,
      cleared: "uncleared",
    })),
    scheduledTransactions: [],
    monthBudgets: legacy.monthBudgets,
    goals: legacy.goals,
    createdAt: legacy.updatedAt || now,
    updatedAt: legacy.updatedAt || now,
  });

  await saveBudgetPlanToCloud(userId, migrated);
  return [migrated];
}

export async function saveBudgetPlanToCloud(
  userId: string,
  plan: BudgetPlan,
): Promise<void> {
  await waitForSupabaseSession();
  const supabase = getClient();
  const { error } = await supabase.from("user_budget_plans").upsert(
    {
      id: plan.id,
      user_id: userId,
      data: plan,
      updated_at: plan.updatedAt,
    },
    { onConflict: "id" },
  );

  if (error) throw error;
}

export async function deleteBudgetPlanFromCloud(planId: string): Promise<void> {
  await waitForSupabaseSession();
  const supabase = getClient();
  const { error } = await supabase
    .from("user_budget_plans")
    .delete()
    .eq("id", planId);

  if (error) throw error;
}

export async function loadBudgetFromCloud(
  userId: string,
): Promise<BudgetData | null> {
  await waitForSupabaseSession();
  const supabase = getClient();
  const { data, error } = await supabase
    .from("user_budgets")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data?.data) return null;
  return data.data as BudgetData;
}

export async function saveBudgetToCloud(
  userId: string,
  budget: BudgetData,
): Promise<void> {
  await waitForSupabaseSession();
  const supabase = getClient();
  const { error } = await supabase.from("user_budgets").upsert(
    {
      user_id: userId,
      data: budget,
      updated_at: budget.updatedAt,
    },
    { onConflict: "user_id" },
  );

  if (error) throw error;
}

function normalizeWatchlistItem(raw: unknown): WatchlistItem | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Partial<WatchlistItem>;
  if (
    typeof item.id !== "string" ||
    typeof item.symbol !== "string" ||
    typeof item.name !== "string" ||
    typeof item.type !== "string" ||
    !isWatchlistAssetType(item.type)
  ) {
    return null;
  }

  return {
    id: item.id,
    symbol: item.symbol.toUpperCase(),
    name: item.name,
    type: item.type,
    priceId: typeof item.priceId === "string" ? item.priceId : undefined,
    logoUrl: typeof item.logoUrl === "string" ? item.logoUrl : undefined,
    addedAt:
      typeof item.addedAt === "string"
        ? item.addedAt
        : new Date().toISOString(),
  };
}

export function normalizeWatchlist(raw: unknown): UserWatchlist | null {
  if (!raw || typeof raw !== "object") return null;
  const list = raw as Partial<UserWatchlist>;
  if (typeof list.id !== "string" || typeof list.name !== "string") {
    return null;
  }

  const items = Array.isArray(list.items)
    ? list.items
        .map(normalizeWatchlistItem)
        .filter((item): item is WatchlistItem => item !== null)
    : [];

  const now = new Date().toISOString();
  return {
    id: list.id,
    name: list.name.trim() || "Watchlist",
    items,
    createdAt: typeof list.createdAt === "string" ? list.createdAt : now,
    updatedAt: typeof list.updatedAt === "string" ? list.updatedAt : now,
  };
}

export async function loadWatchlistPlansFromCloud(
  userId: string,
): Promise<UserWatchlist[]> {
  await waitForSupabaseSession();
  const supabase = getClient();
  const { data, error } = await supabase
    .from("user_watchlist_plans")
    .select("id, data")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  if (!data) return [];

  return data
    .map((row) => {
      const normalized = normalizeWatchlist(row.data);
      if (!normalized) return null;
      return { ...normalized, id: row.id };
    })
    .filter((list): list is UserWatchlist => list !== null);
}

export async function saveWatchlistPlanToCloud(
  userId: string,
  list: UserWatchlist,
): Promise<void> {
  await waitForSupabaseSession();
  const supabase = getClient();
  const { error } = await supabase.from("user_watchlist_plans").upsert(
    {
      id: list.id,
      user_id: userId,
      data: list,
      updated_at: list.updatedAt,
    },
    { onConflict: "id" },
  );

  if (error) throw error;
}

export async function deleteWatchlistPlanFromCloud(
  listId: string,
): Promise<void> {
  await waitForSupabaseSession();
  const supabase = getClient();
  const { error } = await supabase
    .from("user_watchlist_plans")
    .delete()
    .eq("id", listId);

  if (error) throw error;
}
