import type { AssistantPageId } from "@/lib/assistant/page-context";
import type { AssistantUserContext } from "@/lib/assistant/types";

export type AssistantDataScope =
  | "portfolio"
  | "options"
  | "retirement"
  | "budget";

/** Which personal data domains are relevant for the current page. */
export function getDataScopesForPage(pageId: AssistantPageId): AssistantDataScope[] {
  switch (pageId) {
    case "invest":
      return ["portfolio", "options"];
    case "portfolio":
      return ["portfolio"];
    case "options":
      return ["options"];
    case "retire":
    case "retire-plans":
    case "retire-plan":
      return ["retirement"];
    case "budget":
    case "budget-plan":
    case "budget-accounts":
    case "budget-transactions":
    case "budget-reports":
      return ["budget"];
    case "home":
    case "settings":
    case "market":
    case "other":
    default:
      return [];
  }
}

/**
 * Strip personal data domains that are not relevant to the current page.
 * Keeps the payload small and reduces unnecessary data exposure to the model.
 */
export function scopeAssistantContext(
  context: AssistantUserContext,
): AssistantUserContext {
  const scopes = new Set(getDataScopesForPage(context.page.id));
  const includePortfolio = scopes.has("portfolio");
  const includeOptions = scopes.has("options");
  const includeRetirement = scopes.has("retirement");
  const includeBudget = scopes.has("budget");

  let retirementPlans = includeRetirement ? context.retirementPlans : [];
  let activeRetirementPlanId = includeRetirement
    ? context.activeRetirementPlanId
    : null;

  if (includeRetirement && context.page.id === "retire-plan" && activeRetirementPlanId) {
    retirementPlans = retirementPlans.filter(
      (plan) => plan.id === activeRetirementPlanId,
    );
  } else if (includeRetirement && context.page.id !== "retire-plan") {
    // List pages: summaries only, no need to highlight a stale active id
    activeRetirementPlanId = null;
  }

  let budgetPlans = includeBudget ? context.budgetPlans : [];
  let activeBudgetPlan = includeBudget ? context.activeBudgetPlan : null;

  if (
    includeBudget &&
    (context.page.id === "budget-plan" ||
      context.page.id === "budget-accounts" ||
      context.page.id === "budget-transactions" ||
      context.page.id === "budget-reports")
  ) {
    // Detail pages: keep active plan + a short list of other plan names
    budgetPlans = budgetPlans
      .filter((plan) => plan.id === activeBudgetPlan?.id)
      .concat(
        budgetPlans
          .filter((plan) => plan.id !== activeBudgetPlan?.id)
          .slice(0, 3)
          .map((plan) => ({
            id: plan.id,
            name: plan.name,
            availableToBudget: plan.availableToBudget,
            totalAssigned: plan.totalAssigned,
            totalSpent: plan.totalSpent,
          })),
      );
  } else if (includeBudget && context.page.id === "budget") {
    activeBudgetPlan = null;
  }

  if (activeBudgetPlan) {
    if (context.page.id === "budget-accounts") {
      activeBudgetPlan = {
        ...activeBudgetPlan,
        categorySpend: [],
      };
    } else if (context.page.id === "budget-transactions") {
      activeBudgetPlan = {
        ...activeBudgetPlan,
        accounts: activeBudgetPlan.accounts.slice(0, 8),
        categorySpend: activeBudgetPlan.categorySpend.slice(0, 12),
      };
    } else if (context.page.id === "budget-reports") {
      activeBudgetPlan = {
        ...activeBudgetPlan,
        accounts: [],
        categorySpend: activeBudgetPlan.categorySpend.slice(0, 15),
      };
    } else {
      activeBudgetPlan = {
        ...activeBudgetPlan,
        categorySpend: activeBudgetPlan.categorySpend.slice(0, 12),
        accounts: activeBudgetPlan.accounts.slice(0, 8),
      };
    }
  }

  return {
    page: context.page,
    signedIn: context.signedIn,
    currency: context.currency,
    dataScopes: [...scopes],
    portfolio: includePortfolio
      ? context.portfolio
        ? {
            ...context.portfolio,
            topHoldings: context.portfolio.topHoldings.slice(0, 10),
          }
        : null
      : null,
    options: includeOptions ? context.options : null,
    retirementPlans,
    activeRetirementPlanId,
    budgetPlans,
    activeBudgetPlan,
    generatedAt: context.generatedAt,
  };
}
