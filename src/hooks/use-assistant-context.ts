"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useBudgetPlans } from "@/contexts/budget-plans-context";
import { useDisplayCurrency } from "@/hooks/use-display-currency";
import { useEnrichedPortfolio } from "@/hooks/use-enriched-portfolio";
import { useInvestSummary } from "@/hooks/use-invest-summary";
import { useRetirementPlansStorage } from "@/hooks/use-retirement-plans-storage";
import { resolveAssistantPage } from "@/lib/assistant/page-context";
import { scopeAssistantContext } from "@/lib/assistant/scope-context";
import { getDynamicSuggestedQuestions } from "@/lib/assistant/suggested-questions";
import type {
  AssistantBudgetPlanSummary,
  AssistantRetirementPlanSummary,
  AssistantUserContext,
} from "@/lib/assistant/types";
import {
  ACCOUNT_TYPE_LABELS,
  getAccountBalance,
  sortedAccounts,
} from "@/lib/budget/accounts";
import {
  buildCategoryRows,
  computeMonthSummary,
  getCurrentMonthKey,
} from "@/lib/budget/calculations";
import { computeRetirementProjections } from "@/lib/retirement/projections";
import { isSupabaseConfigured } from "@/lib/supabase/config";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function summarizeRetirementPlan(
  plan: Parameters<typeof computeRetirementProjections>[0],
): AssistantRetirementPlanSummary {
  const projections = computeRetirementProjections(plan);
  const depletion = projections.find((row) => row.closingBalance <= 0);
  const last = projections[projections.length - 1] ?? null;

  return {
    id: plan.id,
    name: plan.name,
    retirementYear: plan.retirementYear,
    totalPortfolioValue: roundMoney(
      plan.assets.reduce(
        (sum, asset) => sum + asset.unitPrice * asset.quantity,
        0,
      ),
    ),
    annualLifestyleSpending: plan.annualLifestyleSpending,
    inflationRate: plan.inflationRate,
    assetCount: plan.assets.length,
    projectedDepletionYear: depletion?.year ?? null,
    projectedEndBalance: last ? roundMoney(last.closingBalance) : null,
  };
}

export function useAssistantContext() {
  const pathname = usePathname();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { currency } = useDisplayCurrency();
  const portfolio = useEnrichedPortfolio();
  const invest = useInvestSummary();
  const retirement = useRetirementPlansStorage();
  const budgetPlans = useBudgetPlans();
  const authRequired = isSupabaseConfigured();
  const isAuthenticated = !authRequired || Boolean(user);

  const page = useMemo(() => resolveAssistantPage(pathname), [pathname]);

  const fullContext: AssistantUserContext = useMemo(() => {
    const totalValue = portfolio.totals.currentValue || 0;
    const topHoldings = [...portfolio.enrichedHoldings]
      .map((holding) => {
        const currentValue = holding.currentValue;
        return {
          symbol: holding.symbol,
          name: holding.name,
          type: holding.type,
          sector: holding.sector,
          quantity: holding.quantity,
          currentValue: currentValue == null ? null : roundMoney(currentValue),
          allocationPct:
            currentValue == null || totalValue <= 0
              ? null
              : roundMoney((currentValue / totalValue) * 100),
          profitLoss:
            holding.profitLoss == null ? null : roundMoney(holding.profitLoss),
        };
      })
      .sort((a, b) => (b.currentValue ?? 0) - (a.currentValue ?? 0))
      .slice(0, 12);

    const retirementSummaries = retirement.plans.map(summarizeRetirementPlan);
    const retireMatch = pathname.match(/^\/(?:freedom|retire)\/plans\/([^/]+)/);
    const activeRetirementPlanId = retireMatch?.[1] ?? null;

    const budgetMatch = pathname.match(/^\/budget\/plans\/([^/]+)/);
    const activeBudgetPlanId = budgetMatch?.[1] ?? null;
    const activePlan = activeBudgetPlanId
      ? budgetPlans.getPlan(activeBudgetPlanId)
      : undefined;

    let activeBudgetPlan: AssistantBudgetPlanSummary | null = null;
    if (activePlan) {
      const monthKey = getCurrentMonthKey();
      const summary = computeMonthSummary(activePlan, monthKey);
      const categoryRows = buildCategoryRows(activePlan, monthKey)
        .flatMap((group) => group.categories)
        .map((row) => ({
          name: row.category.name,
          spent: roundMoney(row.activity),
          assigned: roundMoney(row.assigned),
          available: roundMoney(row.available),
        }))
        .sort((a, b) => b.spent - a.spent)
        .slice(0, 20);

      activeBudgetPlan = {
        id: activePlan.id,
        name: activePlan.name,
        monthKey,
        availableToBudget: roundMoney(summary.availableToBudget),
        totalIncome: roundMoney(summary.totalIncome),
        totalAssigned: roundMoney(summary.totalAssigned),
        totalSpent: roundMoney(summary.totalSpent),
        categorySpend: categoryRows,
        accounts: sortedAccounts(activePlan.accounts).map((account) => ({
          name: account.name,
          type: ACCOUNT_TYPE_LABELS[account.type],
          balance: roundMoney(
            getAccountBalance(account, activePlan.transactions),
          ),
          lastReconciledAt: account.lastReconciledAt,
        })),
        transactionCount: activePlan.transactions.length,
      };
    }

    return {
      page,
      signedIn: Boolean(user),
      currency,
      dataScopes: [],
      portfolio: portfolio.isLoaded
        ? {
            id: portfolio.portfolioId,
            name: portfolio.portfolioName,
            role: portfolio.scope === "active" ? "viewing" : "primary",
            currency,
            holdingsCount: portfolio.enrichedHoldings.length,
            totalCurrentValue: roundMoney(portfolio.totals.currentValue),
            totalCostValue: roundMoney(portfolio.totals.costValue),
            totalProfitLoss: roundMoney(portfolio.totals.profitLoss),
            topHoldings,
          }
        : null,
      options: invest.isLoaded
        ? {
            positionsCount: invest.optionsCount,
            activeCount: invest.activeOptionsCount,
            netPremium: roundMoney(invest.optionsSummary.netPremium),
            unrealizedPl: roundMoney(invest.optionsSummary.unrealizedPl),
          }
        : null,
      retirementPlans: retirementSummaries,
      activeRetirementPlanId,
      budgetPlans: budgetPlans.summaries.map((summary) => ({
        id: summary.id,
        name: summary.name,
        availableToBudget: roundMoney(summary.availableToBudget),
        totalAssigned: roundMoney(summary.totalAssigned),
        totalSpent: roundMoney(summary.totalSpent),
      })),
      activeBudgetPlan,
      generatedAt: new Date().toISOString(),
    };
  }, [
    pathname,
    page,
    user,
    currency,
    portfolio.isLoaded,
    portfolio.enrichedHoldings,
    portfolio.totals,
    portfolio.portfolioId,
    portfolio.portfolioName,
    portfolio.scope,
    invest.isLoaded,
    invest.optionsCount,
    invest.activeOptionsCount,
    invest.optionsSummary,
    retirement.plans,
    budgetPlans,
  ]);

  const context = useMemo(
    () => scopeAssistantContext(fullContext),
    [fullContext],
  );

  const starterQuestions = useMemo(
    () => getDynamicSuggestedQuestions(context),
    [context],
  );

  return {
    page,
    starterQuestions,
    context,
    isAuthenticated,
    authRequired,
    isAuthLoading,
  };
}
