import type { AssistantPageInfo } from "@/lib/assistant/page-context";
import type { AssistantDataScope } from "@/lib/assistant/scope-context";

export interface AssistantPortfolioHoldingSummary {
  symbol: string;
  name: string;
  type: string;
  sector: string;
  quantity: number;
  currentValue: number | null;
  allocationPct: number | null;
  profitLoss: number | null;
}

export interface AssistantPortfolioSummary {
  id: string | null;
  name: string | null;
  /** primary = default portfolio; viewing = open on portfolio detail */
  role: "primary" | "viewing";
  currency: string;
  holdingsCount: number;
  totalCurrentValue: number;
  totalCostValue: number;
  totalProfitLoss: number;
  topHoldings: AssistantPortfolioHoldingSummary[];
}

export interface AssistantOptionsSummary {
  positionsCount: number;
  activeCount: number;
  /** Net premium (received − paid) */
  netPremium: number;
  unrealizedPl: number | null;
}

export interface AssistantRetirementPlanSummary {
  id: string;
  name: string;
  retirementYear: number;
  totalPortfolioValue: number;
  annualLifestyleSpending: number;
  inflationRate: number;
  assetCount: number;
  projectedDepletionYear: number | null;
  projectedEndBalance: number | null;
}

export interface AssistantBudgetCategorySpend {
  name: string;
  spent: number;
  assigned: number;
  available: number;
}

export interface AssistantBudgetAccountSummary {
  name: string;
  type: string;
  balance: number;
  lastReconciledAt?: string;
}

export interface AssistantBudgetPlanSummary {
  id: string;
  name: string;
  monthKey: string;
  availableToBudget: number;
  totalIncome: number;
  totalAssigned: number;
  totalSpent: number;
  categorySpend: AssistantBudgetCategorySpend[];
  accounts: AssistantBudgetAccountSummary[];
  transactionCount: number;
}

export interface AssistantBudgetPlanListItem {
  id: string;
  name: string;
  availableToBudget: number;
  totalAssigned: number;
  totalSpent: number;
}

export interface AssistantUserContext {
  page: AssistantPageInfo;
  signedIn: boolean;
  currency: string;
  /** Domains included for this page (set by scopeAssistantContext). */
  dataScopes: AssistantDataScope[];
  portfolio: AssistantPortfolioSummary | null;
  options: AssistantOptionsSummary | null;
  retirementPlans: AssistantRetirementPlanSummary[];
  activeRetirementPlanId: string | null;
  budgetPlans: AssistantBudgetPlanListItem[];
  activeBudgetPlan: AssistantBudgetPlanSummary | null;
  generatedAt: string;
}

export interface AssistantChatMessage {
  role: "user" | "assistant";
  content: string;
}
