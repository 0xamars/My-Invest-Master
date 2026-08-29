import type { AssistantPageId } from "@/lib/assistant/page-context";
import type { AssistantUserContext } from "@/lib/assistant/types";

function formatMoneyHint(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${Math.round(value)}`;
  }
}

/**
 * Build suggested starter questions from the current page + available data.
 * Falls back to generic how-to prompts when personal data is empty.
 */
export function getDynamicSuggestedQuestions(
  context: AssistantUserContext,
): string[] {
  const pageId: AssistantPageId = context.page.id;
  const currency = context.currency || "USD";

  switch (pageId) {
    case "home":
      return [
        "What can InvestSalsa help me with?",
        "How do I get started with my portfolio?",
        "What does the market heatmap show?",
      ];

    case "invest": {
      const questions = [
        "Summarize my Invest overview",
        "How do Portfolio and Options differ?",
      ];
      if (context.portfolio && context.portfolio.holdingsCount > 0) {
        questions.unshift(
          `What is my portfolio value in ${currency}?`,
        );
      } else {
        questions.push("What is asset allocation?");
      }
      return questions.slice(0, 3);
    }

    case "portfolio": {
      if (!context.portfolio || context.portfolio.holdingsCount === 0) {
        return [
          "How do I add a new asset?",
          "What does cost basis mean?",
          "How is portfolio allocation calculated?",
        ];
      }
      const top = context.portfolio.topHoldings[0];
      return [
        `What is my current portfolio value?`,
        top
          ? `How much of my portfolio is in ${top.symbol}?`
          : "Which holding has the highest allocation?",
        "How do I add a new asset?",
      ];
    }

    case "options": {
      if (!context.options || context.options.positionsCount === 0) {
        return [
          "How do I add an options position?",
          "What is a synthetic long?",
          "What does DTE mean?",
        ];
      }
      return [
        "How many active options do I have?",
        "What is my net premium across positions?",
        "What is a synthetic long?",
      ];
    }

    case "market":
      return [
        "What are the popular themes right now?",
        "How are theme stocks selected?",
        "What does the Custom Theme Explorer do?",
      ];

    case "retire":
    case "retire-plans":
      return context.retirementPlans.length === 0
        ? [
            "How do I create a Freedom plan?",
            "How does a Freedom projection work?",
            "What is CAGR?",
          ]
        : [
            "Summarize my Freedom plans",
            "How does a Freedom projection work?",
            "How do I create a plan from my portfolio?",
          ];

    case "retire-plan": {
      const plan =
        context.retirementPlans.find(
          (entry) => entry.id === context.activeRetirementPlanId,
        ) ?? context.retirementPlans[0];
      if (!plan) {
        return [
          "How does a Freedom projection work?",
          "What is CAGR?",
          "How does inflation affect later spending?",
        ];
      }
      return [
        plan.projectedDepletionYear
          ? `When might ${plan.name} run out of money?`
          : `What is the projected end balance for ${plan.name}?`,
        `Explain the assumptions for ${plan.name}`,
        "How does inflation affect later spending?",
      ];
    }

    case "budget":
      return context.budgetPlans.length === 0
        ? [
            "How do Budget Plans work?",
            "How do I create a new budget plan?",
            "What is Available to Budget?",
          ]
        : [
            "Summarize my budget plans",
            "What is Available to Budget?",
            "How do I create a new budget plan?",
          ];

    case "budget-plan": {
      const plan = context.activeBudgetPlan;
      if (!plan) {
        return [
          "How do I assign money to a category?",
          "What does Ready to Assign mean?",
          "What is Available to Budget?",
        ];
      }
      return [
        `How much is available to budget in ${plan.name}?`,
        plan.categorySpend[0]
          ? `How much have I spent in ${plan.categorySpend[0].name} this month?`
          : "Which categories have spending this month?",
        "How do I assign money to a category?",
      ];
    }

    case "budget-accounts": {
      const account = context.activeBudgetPlan?.accounts[0];
      return [
        "How do I reconcile an account?",
        account
          ? `What is the balance of ${account.name}?`
          : "How are account balances calculated?",
        "What does Cleared mean?",
      ];
    }

    case "budget-transactions": {
      const category = context.activeBudgetPlan?.categorySpend.find(
        (row) => row.spent > 0,
      );
      return [
        category
          ? `How much did I spend on ${category.name} this month?`
          : "How do I filter transactions by account?",
        "How do I mark a transaction as cleared?",
        "How do I add a transaction?",
      ];
    }

    case "budget-reports":
      return [
        "What do the budget reports show?",
        context.activeBudgetPlan
          ? `How much did I spend this month (${formatMoneyHint(context.activeBudgetPlan.totalSpent, currency)})?`
          : "How is spending by category calculated?",
        "Where can I see income vs expenses?",
      ];

    case "settings":
      return [
        "How do I change display currency?",
        "Is my data synced across devices?",
        "How does account sign-in work?",
      ];

    default:
      return [
        "What can you help me with?",
        "How do I navigate InvestSalsa?",
        "Explain asset allocation simply",
      ];
  }
}
