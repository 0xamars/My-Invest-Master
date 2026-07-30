import { resolveAssistantPage } from "@/lib/assistant/page-context";
import { scopeAssistantContext } from "@/lib/assistant/scope-context";
import type {
  AssistantBudgetPlanSummary,
  AssistantChatMessage,
  AssistantPortfolioSummary,
  AssistantRetirementPlanSummary,
  AssistantUserContext,
} from "@/lib/assistant/types";

const MAX_CONTEXT_CHARS = 60_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function sanitizePortfolio(value: unknown): AssistantPortfolioSummary | null {
  if (!isRecord(value)) return null;
  const topHoldingsRaw = Array.isArray(value.topHoldings) ? value.topHoldings : [];
  const topHoldings = topHoldingsRaw
    .filter(isRecord)
    .slice(0, 10)
    .map((holding) => ({
      symbol: asString(holding.symbol) ?? "?",
      name: asString(holding.name) ?? "Unknown",
      type: asString(holding.type) ?? "unknown",
      sector: asString(holding.sector) ?? "Unknown",
      quantity: asNumber(holding.quantity) ?? 0,
      currentValue: asNumber(holding.currentValue),
      allocationPct: asNumber(holding.allocationPct),
      profitLoss: asNumber(holding.profitLoss),
    }));

  return {
    id: asString(value.id),
    name: asString(value.name),
    role: value.role === "viewing" ? "viewing" : "primary",
    currency: asString(value.currency) ?? "USD",
    holdingsCount: asNumber(value.holdingsCount) ?? topHoldings.length,
    totalCurrentValue: asNumber(value.totalCurrentValue) ?? 0,
    totalCostValue: asNumber(value.totalCostValue) ?? 0,
    totalProfitLoss: asNumber(value.totalProfitLoss) ?? 0,
    topHoldings,
  };
}

function sanitizeRetirementPlans(value: unknown): AssistantRetirementPlanSummary[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .slice(0, 8)
    .map((plan) => ({
      id: asString(plan.id) ?? crypto.randomUUID(),
      name: asString(plan.name) ?? "Untitled plan",
      retirementYear: asNumber(plan.retirementYear) ?? new Date().getFullYear(),
      totalPortfolioValue: asNumber(plan.totalPortfolioValue) ?? 0,
      annualLifestyleSpending: asNumber(plan.annualLifestyleSpending) ?? 0,
      inflationRate: asNumber(plan.inflationRate) ?? 0,
      assetCount: asNumber(plan.assetCount) ?? 0,
      projectedDepletionYear: asNumber(plan.projectedDepletionYear),
      projectedEndBalance: asNumber(plan.projectedEndBalance),
    }));
}

function sanitizeBudgetPlan(value: unknown): AssistantBudgetPlanSummary | null {
  if (!isRecord(value)) return null;
  const categorySpend = (Array.isArray(value.categorySpend) ? value.categorySpend : [])
    .filter(isRecord)
    .slice(0, 15)
    .map((row) => ({
      name: asString(row.name) ?? "Category",
      spent: asNumber(row.spent) ?? 0,
      assigned: asNumber(row.assigned) ?? 0,
      available: asNumber(row.available) ?? 0,
    }));
  const accounts = (Array.isArray(value.accounts) ? value.accounts : [])
    .filter(isRecord)
    .slice(0, 10)
    .map((account) => ({
      name: asString(account.name) ?? "Account",
      type: asString(account.type) ?? "Other",
      balance: asNumber(account.balance) ?? 0,
      lastReconciledAt: asString(account.lastReconciledAt) ?? undefined,
    }));

  return {
    id: asString(value.id) ?? "unknown",
    name: asString(value.name) ?? "Budget plan",
    monthKey: asString(value.monthKey) ?? "",
    availableToBudget: asNumber(value.availableToBudget) ?? 0,
    totalIncome: asNumber(value.totalIncome) ?? 0,
    totalAssigned: asNumber(value.totalAssigned) ?? 0,
    totalSpent: asNumber(value.totalSpent) ?? 0,
    categorySpend,
    accounts,
    transactionCount: asNumber(value.transactionCount) ?? 0,
  };
}

/** Validate + normalize client context, then apply page scoping. */
export function normalizeAssistantContext(
  raw: unknown,
  fallbackPath = "/",
): AssistantUserContext | null {
  if (!isRecord(raw)) return null;

  const pageRaw = isRecord(raw.page) ? raw.page : null;
  const path = asString(pageRaw?.path) ?? fallbackPath;
  const pageFromPath = resolveAssistantPage(path);
  const page = {
    ...pageFromPath,
    title:
      pageRaw && asString(pageRaw.path) === pageFromPath.path
        ? (asString(pageRaw.title) ?? pageFromPath.title)
        : pageFromPath.title,
  };

  const draft: AssistantUserContext = {
    page,
    signedIn: Boolean(raw.signedIn),
    currency: asString(raw.currency) ?? "USD",
    dataScopes: [],
    portfolio: sanitizePortfolio(raw.portfolio),
    options: isRecord(raw.options)
      ? {
          positionsCount: asNumber(raw.options.positionsCount) ?? 0,
          activeCount: asNumber(raw.options.activeCount) ?? 0,
          netPremium: asNumber(raw.options.netPremium) ?? 0,
          unrealizedPl: asNumber(raw.options.unrealizedPl),
        }
      : null,
    retirementPlans: sanitizeRetirementPlans(raw.retirementPlans),
    activeRetirementPlanId: asString(raw.activeRetirementPlanId),
    budgetPlans: (Array.isArray(raw.budgetPlans) ? raw.budgetPlans : [])
      .filter(isRecord)
      .slice(0, 12)
      .map((plan) => ({
        id: asString(plan.id) ?? crypto.randomUUID(),
        name: asString(plan.name) ?? "Budget plan",
        availableToBudget: asNumber(plan.availableToBudget) ?? 0,
        totalAssigned: asNumber(plan.totalAssigned) ?? 0,
        totalSpent: asNumber(plan.totalSpent) ?? 0,
      })),
    activeBudgetPlan: sanitizeBudgetPlan(raw.activeBudgetPlan),
    generatedAt: asString(raw.generatedAt) ?? new Date().toISOString(),
  };

  const scoped = scopeAssistantContext(draft);
  const encoded = JSON.stringify(scoped);
  if (encoded.length <= MAX_CONTEXT_CHARS) return scoped;

  // Emergency shrink
  return scopeAssistantContext({
    ...scoped,
    portfolio: scoped.portfolio
      ? { ...scoped.portfolio, topHoldings: scoped.portfolio.topHoldings.slice(0, 3) }
      : null,
    retirementPlans: scoped.retirementPlans.slice(0, 2),
    budgetPlans: scoped.budgetPlans.slice(0, 3),
    activeBudgetPlan: scoped.activeBudgetPlan
      ? {
          ...scoped.activeBudgetPlan,
          categorySpend: scoped.activeBudgetPlan.categorySpend.slice(0, 5),
          accounts: scoped.activeBudgetPlan.accounts.slice(0, 4),
        }
      : null,
  });
}

export function sanitizeAssistantMessages(
  messages: unknown,
  maxMessages = 20,
  maxChars = 3000,
): AssistantChatMessage[] {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter(isRecord)
    .filter(
      (message) =>
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim().length > 0,
    )
    .slice(-maxMessages)
    .map((message) => ({
      role: message.role as "user" | "assistant",
      content: String(message.content).trim().slice(0, maxChars),
    }));
}
