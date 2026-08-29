export type AssistantPageId =
  | "home"
  | "invest"
  | "portfolio"
  | "options"
  | "market"
  | "retire"
  | "retire-plans"
  | "retire-plan"
  | "budget"
  | "budget-plan"
  | "budget-accounts"
  | "budget-transactions"
  | "budget-reports"
  | "settings"
  | "other";

export interface AssistantPageInfo {
  id: AssistantPageId;
  path: string;
  title: string;
  description: string;
}

export function resolveAssistantPage(pathname: string): AssistantPageInfo {
  if (pathname === "/") {
    return {
      id: "home",
      path: pathname,
      title: "Home",
      description: "Public marketing homepage for InvestSalsa.",
    };
  }
  if (pathname === "/home") {
    return {
      id: "invest",
      path: pathname,
      title: "Invest",
      description: "Invest checkup: concentration, mix, leftover, and the book.",
    };
  }
  if (pathname === "/invest") {
    return {
      id: "invest",
      path: pathname,
      title: "Invest",
      description:
        "Invest checkup: concentration, mix, allocation drift, and performance for the Primary book.",
    };
  }
  if (
    pathname === "/invest/portfolio" ||
    pathname.startsWith("/invest/portfolio/") ||
    pathname === "/portfolio" ||
    pathname.startsWith("/portfolio/")
  ) {
    return {
      id: "portfolio",
      path: pathname,
      title: "Portfolio",
      description: "Track holdings, cost basis, and live portfolio value.",
    };
  }
  if (
    pathname === "/invest/watchlist" ||
    pathname.startsWith("/invest/watchlist/")
  ) {
    return {
      id: "invest",
      path: pathname,
      title: "Watchlist",
      description: "Queue of names you are watching — not a second book.",
    };
  }
  if (
    pathname === "/invest/options" ||
    pathname === "/options" ||
    pathname.startsWith("/options/")
  ) {
    return {
      id: "options",
      path: pathname,
      title: "Options",
      description: "Track calls, puts, premiums, and option metrics.",
    };
  }
  if (
    pathname === "/market" ||
    pathname.startsWith("/market/") ||
    pathname === "/markets" ||
    pathname === "/analysis" ||
    pathname.startsWith("/analysis/")
  ) {
    return {
      id: "invest",
      path: pathname,
      title: "Invest",
      description:
        "Research routes fold into the Invest book — checkup, mix, leftover, and owned names.",
    };
  }
  if (
    (pathname.startsWith("/freedom/plans/") ||
      pathname.startsWith("/retire/plans/")) &&
    pathname.split("/").length >= 4
  ) {
    return {
      id: "retire-plan",
      path: pathname,
      title: "Freedom plan",
      description: "Edit a Freedom model and view projections.",
    };
  }
  if (pathname === "/freedom/plans" || pathname === "/retire/plans") {
    return {
      id: "retire-plans",
      path: pathname,
      title: "Freedom plans",
      description: "List and create Freedom plan scenarios.",
    };
  }
  if (pathname.startsWith("/freedom") || pathname.startsWith("/retire")) {
    return {
      id: "retire",
      path: pathname,
      title: "Freedom",
      description: "Freedom planning hub.",
    };
  }
  if (pathname.startsWith("/budget/plans/")) {
    if (pathname.endsWith("/accounts")) {
      return {
        id: "budget-accounts",
        path: pathname,
        title: "Budget Accounts",
        description: "Manage accounts and reconcile statement balances.",
      };
    }
    if (pathname.endsWith("/transactions")) {
      return {
        id: "budget-transactions",
        path: pathname,
        title: "Budget Transactions",
        description: "View and filter income and spending transactions.",
      };
    }
    if (pathname.endsWith("/reports")) {
      return {
        id: "budget-reports",
        path: pathname,
        title: "Budget Reports",
        description: "Spending and cash-flow reports for a budget plan.",
      };
    }
    return {
      id: "budget-plan",
      path: pathname,
      title: "Budget Plan",
      description: "Envelope budgeting for one plan — leftover you assign, then a real month close.",
    };
  }
  if (pathname === "/budget" || pathname.startsWith("/budget/")) {
    return {
      id: "budget",
      path: pathname,
      title: "Budget Plans",
      description: "Create and open budget plans.",
    };
  }
  if (pathname === "/settings") {
    return {
      id: "settings",
      path: pathname,
      title: "Settings",
      description: "Account and display preferences.",
    };
  }
  return {
    id: "other",
    path: pathname,
    title: "InvestSalsa",
    description: "General app page.",
  };
}

export function getStarterQuestions(pageId: AssistantPageId): string[] {
  // Kept for compatibility; prefer getDynamicSuggestedQuestions(context).
  switch (pageId) {
    case "home":
      return [
        "What can InvestSalsa help me with?",
        "How do I get started with my portfolio?",
        "What does the market heatmap show?",
      ];
    case "invest":
      return [
        "Summarize my Invest overview",
        "How do Portfolio and Options differ?",
        "What is asset allocation?",
      ];
    case "portfolio":
      return [
        "What is my current portfolio value?",
        "Which holding has the highest allocation?",
        "How do I add a new asset?",
      ];
    case "options":
      return [
        "How many active options do I have?",
        "What is a synthetic long?",
        "How do I add an options position?",
      ];
    case "market":
      return [
        "What are the popular themes right now?",
        "How are theme stocks selected?",
        "What does the Custom Theme Explorer do?",
      ];
    case "retire":
    case "retire-plans":
      return [
        "How does a Freedom projection work?",
        "How do I create a plan from my portfolio?",
        "What is CAGR?",
      ];
    case "retire-plan":
      return [
        "When might this plan run out of money?",
        "Explain my projection assumptions",
        "How does inflation affect later spending?",
      ];
    case "budget":
      return [
        "How do Budget Plans work?",
        "How do I create a new budget plan?",
        "What is Available to Budget?",
      ];
    case "budget-plan":
      return [
        "How much is available to budget this month?",
        "How do I assign leftover to an envelope?",
        "What does leftover mean?",
      ];
    case "budget-accounts":
      return [
        "How do I reconcile an account?",
        "What does Cleared mean?",
        "How are account balances calculated?",
      ];
    case "budget-transactions":
      return [
        "How much did I spend on Groceries this month?",
        "How do I mark a transaction as cleared?",
        "How do I filter transactions by account?",
      ];
    case "budget-reports":
      return [
        "What do the budget reports show?",
        "How is spending by category calculated?",
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
