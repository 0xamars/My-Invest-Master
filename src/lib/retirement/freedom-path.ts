import { isHoldingVisible } from "@/lib/portfolio/transactions";
import {
  portfolioHoldingToPlanAsset,
  resolveHoldingUnitPrice,
} from "@/lib/retirement/portfolio-import";
import { applyRetirementPlanPatch } from "@/lib/retirement/normalize";
import { computeRetirementProjections } from "@/lib/retirement/projections";
import { computeTargetNestEgg, presentValue } from "@/lib/retirement/target";
import type { LeftoverPresence } from "@/lib/invest/leftover";
import { getCashCurrency, type PortfolioHolding } from "@/types/portfolio";
import {
  DEFAULT_CAGR_BY_TYPE,
  getPlanTotalValue,
  type RetirementPlan,
  type RetirementPlanAsset,
} from "@/types/retirement";

export const FREEDOM_LEFTOVER_ASSET_ID = "freedom-leftover-cash";

export type BookPresence =
  | { status: "missing" }
  | {
      status: "present";
      portfolioId: string;
      portfolioName: string;
      holdings: PortfolioHolding[];
    };

export type FreedomLever =
  | "missing-book"
  | "missing-leftover"
  | "save-more"
  | "spend-less"
  | "book-path";

export function bookPresenceFromPortfolio(
  portfolio:
    | {
        id: string;
        name: string;
        holdings: PortfolioHolding[];
      }
    | null
    | undefined,
): BookPresence {
  const holdings = (portfolio?.holdings ?? []).filter(isHoldingVisible);
  if (!portfolio || holdings.length === 0) return { status: "missing" };
  return {
    status: "present",
    portfolioId: portfolio.id,
    portfolioName: portfolio.name,
    holdings,
  };
}

export function leftoverAlreadyInBook(
  book: BookPresence,
  leftover: LeftoverPresence,
): boolean {
  if (book.status !== "present" || leftover.status !== "present") return false;
  const cash = book.holdings
    .filter(
      (holding) =>
        holding.type === "cash" &&
        getCashCurrency(holding) === leftover.currency,
    )
    .reduce((sum, holding) => sum + holding.quantity, 0);
  return cash + 1e-9 >= leftover.amount;
}

export function leftoverCashAsset(
  leftover: LeftoverPresence,
): RetirementPlanAsset | null {
  if (leftover.status !== "present") return null;
  return {
    id: FREEDOM_LEFTOVER_ASSET_ID,
    symbol: "CASH",
    name: `Leftover (${leftover.currency})`,
    type: "cash",
    unitPrice: 1,
    quantity: leftover.amount,
    expectedCagr: DEFAULT_CAGR_BY_TYPE.cash,
  };
}

export function assetsFromBook(
  book: BookPresence,
  prices: Record<string, number> = {},
): RetirementPlanAsset[] {
  if (book.status !== "present") return [];
  return book.holdings.map((holding) =>
    portfolioHoldingToPlanAsset(
      holding,
      resolveHoldingUnitPrice(holding, prices),
    ),
  );
}

/**
 * One Freedom path: Invest book + Budget leftover. Leftover is a stock of
 * Ready to Assign, not an invented annual savings rate. Leftover already
 * sitting as matching book cash is not added again. Contribution and
 * income streams stay empty so this path does not invent cash.
 */
export function bindFreedomPathPlan(
  assumptions: RetirementPlan,
  leftover: LeftoverPresence,
  book: BookPresence,
  prices: Record<string, number> = {},
): RetirementPlan {
  const fromBook = assetsFromBook(book, prices);
  const leftoverAsset = leftoverCashAsset(leftover);
  const includeLeftover =
    leftoverAsset != null && !leftoverAlreadyInBook(book, leftover);

  return {
    ...assumptions,
    assets:
      includeLeftover && leftoverAsset
        ? [...fromBook, leftoverAsset]
        : fromBook,
    annualContribution: 0,
    incomeStreams: [],
  };
}

export function findFreedomCrossing(
  plan: RetirementPlan,
  options?: { currentYear?: number },
): { year: number; age: number } | null {
  const currentYear = options?.currentYear ?? new Date().getFullYear();
  const target = computeTargetNestEgg(
    plan.annualLifestyleSpending,
    plan.withdrawalRate,
  );
  if (target <= 0 || plan.assets.length === 0) return null;

  const currentValue = getPlanTotalValue(plan);
  if (currentValue >= target) {
    return { year: currentYear, age: plan.currentAge };
  }

  const accumulating = applyRetirementPlanPatch(
    plan,
    { retirementAge: plan.planEndAge },
    currentYear,
  );
  const rows = computeRetirementProjections(accumulating, { currentYear });

  for (const row of rows) {
    const today = presentValue(
      row.closingBalance,
      plan.inflationRate,
      row.year - currentYear,
    );
    if (today >= target) {
      return { year: row.year, age: row.age };
    }
  }

  return null;
}

export function formatFreedomDate(
  freedom: { year: number } | null,
  currentYear: number,
): string {
  if (!freedom) return "Not on this path";
  if (freedom.year <= currentYear) return "This year";
  return String(freedom.year);
}

export function pickFreedomLever(
  leftover: LeftoverPresence,
  book: BookPresence,
  dashboard: { verdict: string; freedomYear: number | null },
): FreedomLever {
  if (book.status === "missing") return "missing-book";
  if (leftover.status !== "present") {
    return dashboard.verdict === "behind" || dashboard.freedomYear == null
      ? "missing-leftover"
      : "book-path";
  }
  if (dashboard.verdict === "behind" || dashboard.freedomYear == null) {
    return "spend-less";
  }
  return "book-path";
}

export function freedomLeverSentence(lever: FreedomLever): string {
  switch (lever) {
    case "missing-book":
      return "The book is missing. Add holdings in Invest.";
    case "missing-leftover":
      return "Leftover is missing. Save more in Budget, or spend less.";
    case "save-more":
      return "Save more — leftover on this path is the cash you can add.";
    case "spend-less":
      return "Spend less to pull the date closer, or save more.";
    case "book-path":
      return "The book path. Stay with this mix, or spend less to pull the date closer.";
  }
}
