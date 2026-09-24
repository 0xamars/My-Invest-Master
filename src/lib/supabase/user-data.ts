import {
  CLIENT_DELETABLE_USER_TABLES,
  PLAID_ITEM_EXPORT_COLUMNS,
  type AccountExportRows,
} from "@/lib/account/export";
import { preferencesCloudWrite } from "@/lib/account/preferences-write";
import { createClient } from "@/lib/supabase/client";
import {
  BudgetPlanConflictError,
  nextBudgetPlanVersion,
  readBudgetPlanVersion,
} from "@/lib/budget/plan-version";
import type { BudgetData, BudgetPlan } from "@/types/budget";
import { createDefaultAccount } from "@/types/budget";
import { normalizeBudgetPlan } from "@/lib/budget/migrate-plan";
import type { DisplayCurrency } from "@/types/currency";
import type { MoneyProfile } from "@/types/money-profile";
import { isMissingMoneyProfileTable } from "@/lib/journey/landing";
import { normalizeMoneyProfile } from "@/lib/journey/profile";
import type { OptionsPosition } from "@/types/options";
import { isUserPlan, type UserPlan } from "@/types/plan";
import type { PortfolioHolding, UserPortfolio } from "@/types/portfolio";
import { createEmptyPortfolio } from "@/types/portfolio";
import { parseStoredTargetAllocation } from "@/lib/portfolio/allocation-targets";
import { parseStoredLeverage } from "@/lib/portfolio/leverage";
import { normalizeRetirementPlan } from "@/lib/retirement/normalize";
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

  const targetAllocation = parseStoredTargetAllocation(data.targetAllocation);

  return {
    id: data.id,
    name: data.name.trim() || "My Portfolio",
    isPrimary: Boolean(data.isPrimary),
    holdings: Array.isArray(data.holdings)
      ? (data.holdings as PortfolioHolding[])
      : [],
    ...(targetAllocation ? { targetAllocation } : {}),
    leverage: parseStoredLeverage(data.leverage),
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
  },
): Promise<void> {
  await waitForSupabaseSession();
  const supabase = getClient();
  const { error } = await supabase.from("user_preferences").upsert(
    preferencesCloudWrite({
      userId,
      displayCurrency: preferences.displayCurrency,
      updatedAt: new Date().toISOString(),
    }),
    { onConflict: "user_id" },
  );

  if (error) throw error;
}

export async function loadMoneyProfileFromCloud(
  userId: string,
): Promise<MoneyProfile | null> {
  await waitForSupabaseSession();
  const supabase = getClient();
  const { data, error } = await supabase
    .from("user_money_profiles")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingMoneyProfileTable(error)) return null;
    throw error;
  }
  if (!data?.data) return null;
  return normalizeMoneyProfile(data.data);
}

export async function saveMoneyProfileToCloud(
  userId: string,
  profile: MoneyProfile,
): Promise<void> {
  await waitForSupabaseSession();
  const supabase = getClient();
  const { error } = await supabase.from("user_money_profiles").upsert(
    {
      user_id: userId,
      data: profile,
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
    .filter((plan) => plan && typeof plan.id === "string")
    .map((plan) => normalizeRetirementPlan(plan));
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

export type CloudBudgetPlans = {
  plans: BudgetPlan[];
  /** Server version each plan was loaded at. Saves must send this back. */
  versions: Record<string, number>;
};

export async function loadBudgetPlansFromCloud(
  userId: string,
): Promise<CloudBudgetPlans> {
  await waitForSupabaseSession();
  const supabase = getClient();
  const { data, error } = await supabase
    .from("user_budget_plans")
    .select("id, data, version")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  const versions: Record<string, number> = {};
  const plans = (data ?? [])
    .map((row) => {
      const plan = row.data as BudgetPlan;
      if (!plan || typeof plan.id !== "string") return null;
      const normalized = normalizeBudgetPlan(plan);
      versions[normalized.id] = readBudgetPlanVersion(row.version) ?? 1;
      return normalized;
    })
    .filter((plan): plan is BudgetPlan => plan !== null);

  if (plans.length > 0) return { plans, versions };

  const legacy = await loadBudgetFromCloud(userId);
  if (!legacy) return { plans: [], versions: {} };

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

  const saved = await saveBudgetPlanToCloud(userId, migrated, {
    expectedVersion: null,
  });
  return { plans: [migrated], versions: { [migrated.id]: saved.version } };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

export async function saveBudgetPlanToCloud(
  userId: string,
  plan: BudgetPlan,
  options?: { expectedVersion?: number | null },
): Promise<{ version: number }> {
  await waitForSupabaseSession();
  const supabase = getClient();
  const expectedVersion = options?.expectedVersion ?? null;

  if (expectedVersion == null) {
    const { data, error } = await supabase
      .from("user_budget_plans")
      .insert({
        id: plan.id,
        user_id: userId,
        data: plan,
        updated_at: plan.updatedAt,
        version: 1,
      })
      .select("version")
      .single();
    if (error) {
      if (isUniqueViolation(error)) throw new BudgetPlanConflictError();
      throw error;
    }
    return { version: readBudgetPlanVersion(data?.version) ?? 1 };
  }

  const nextVersion = nextBudgetPlanVersion(expectedVersion);
  const { data, error } = await supabase
    .from("user_budget_plans")
    .update({
      data: plan,
      updated_at: plan.updatedAt,
      version: nextVersion,
    })
    .eq("id", plan.id)
    .eq("user_id", userId)
    .eq("version", expectedVersion)
    .select("version");

  if (error) throw error;
  const row = data?.[0];
  if (!row) throw new BudgetPlanConflictError();
  return { version: readBudgetPlanVersion(row.version) ?? nextVersion };
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

export async function loadAccountExportRows(
  userId: string,
): Promise<AccountExportRows> {
  await waitForSupabaseSession();
  const supabase = getClient();

  const [
    budgetPlans,
    budgets,
    retirement,
    portfolioPlans,
    portfolios,
    watchlists,
    options,
    preferences,
    moneyProfiles,
    plaidAccounts,
    plaidItems,
  ] = await Promise.all([
    supabase
      .from("user_budget_plans")
      .select("id, user_id, data, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("user_budgets")
      .select("user_id, data, updated_at")
      .eq("user_id", userId),
    supabase
      .from("user_retirement_plans")
      .select("id, user_id, data, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("user_portfolio_plans")
      .select("id, user_id, data, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("user_portfolios")
      .select("user_id, holdings, updated_at")
      .eq("user_id", userId),
    supabase
      .from("user_watchlist_plans")
      .select("id, user_id, data, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("user_options")
      .select("user_id, positions, updated_at")
      .eq("user_id", userId),
    supabase
      .from("user_preferences")
      .select("user_id, display_currency, plan, updated_at")
      .eq("user_id", userId),
    supabase
      .from("user_money_profiles")
      .select("user_id, data, updated_at")
      .eq("user_id", userId),
    supabase
      .from("user_plaid_accounts")
      .select(
        "id, user_id, item_row_id, plaid_account_id, budget_account_id, name, official_name, mask, type, subtype, created_at",
      )
      .eq("user_id", userId),
    supabase
      .from("user_plaid_items")
      .select(PLAID_ITEM_EXPORT_COLUMNS)
      .eq("user_id", userId),
  ]);

  const results = [
    budgetPlans,
    budgets,
    retirement,
    portfolioPlans,
    portfolios,
    watchlists,
    options,
    preferences,
    moneyProfiles,
    plaidAccounts,
    plaidItems,
  ];
  for (const result of results) {
    if (result.error) throw result.error;
  }

  return {
    user_budget_plans: budgetPlans.data ?? [],
    user_budgets: budgets.data ?? [],
    user_retirement_plans: retirement.data ?? [],
    user_portfolio_plans: portfolioPlans.data ?? [],
    user_portfolios: portfolios.data ?? [],
    user_watchlist_plans: watchlists.data ?? [],
    user_options: options.data ?? [],
    user_preferences: preferences.data ?? [],
    user_money_profiles: moneyProfiles.data ?? [],
    user_plaid_accounts: plaidAccounts.data ?? [],
    user_plaid_items: plaidItems.data ?? [],
  };
}

/**
 * Deletes every user-owned table the browser session is allowed to delete.
 * Plaid items stay until the server calls /item/remove.
 */
export async function deleteOwnUserData(userId: string): Promise<void> {
  await waitForSupabaseSession();
  const supabase = getClient();

  const results = await Promise.all(
    CLIENT_DELETABLE_USER_TABLES.map((table) =>
      supabase.from(table).delete().eq("user_id", userId),
    ),
  );

  for (const result of results) {
    if (result.error) throw result.error;
  }
}
