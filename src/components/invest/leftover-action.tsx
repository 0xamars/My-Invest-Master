"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { RetirePanel } from "@/components/retirement/retire-ui";
import { Button } from "@/components/ui/button";
import { useBudgetPlans } from "@/contexts/budget-plans-context";
import { usePortfolioPlans } from "@/contexts/portfolio-plans-context";
import { usePortfolioPrices } from "@/hooks/use-portfolio-prices";
import { useRetirementPlansStorage } from "@/hooks/use-retirement-plans-storage";
import { applyLeftoverToBookCash } from "@/lib/invest/apply-leftover-to-cash";
import {
  appendRulesChangelog,
  leftoverChangelogDetail,
} from "@/lib/invest/rules-changelog";
import {
  leftoverFromBudgetPlans,
  pickOpenablePlan,
} from "@/lib/invest/leftover";
import { formatBudgetMoney } from "@/lib/budget/format";
import { refreshAssetsFromPortfolio } from "@/lib/retirement/portfolio-import";
import { getTodayDateString, isHoldingVisible } from "@/lib/portfolio/transactions";

export function LeftoverAction() {
  const budget = useBudgetPlans();
  const { primaryPortfolio, patchPortfolio } = usePortfolioPlans();
  const retirement = useRetirementPlansStorage();
  const { prices } = usePortfolioPrices(primaryPortfolio?.holdings ?? []);
  const leftover = useMemo(
    () => leftoverFromBudgetPlans(budget.plans),
    [budget.plans],
  );
  const retirePlan = pickOpenablePlan(retirement.plans);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!budget.isLoaded) return null;
  if (!leftover) return null;

  const canApply = Boolean(primaryPortfolio);
  const willRefreshRetire = Boolean(retirePlan);

  async function handleApply() {
    if (!leftover || !primaryPortfolio) {
      setStatus("Create a portfolio first, then apply leftover to book cash.");
      return;
    }
    setBusy(true);
    setStatus(null);
    const result = applyLeftoverToBookCash(primaryPortfolio.holdings, {
      amount: leftover.amount,
      currency: leftover.currency,
      date: getTodayDateString(),
    });
    const amountLabel = formatBudgetMoney(leftover.amount, leftover.currency);
    patchPortfolio(primaryPortfolio.id, (portfolio) => ({
      ...portfolio,
      holdings: result.holdings,
      rulesChangelog: appendRulesChangelog(portfolio.rulesChangelog, {
        id: `leftover-${Date.now()}`,
        at: getTodayDateString(),
        area: "leftover",
        title: "Applied leftover to book cash",
        detail: leftoverChangelogDetail(amountLabel),
        status: "logged",
      }),
    }));

    if (retirePlan) {
      const visible = result.holdings.filter(isHoldingVisible);
      const assets = refreshAssetsFromPortfolio(
        retirePlan.assets,
        visible,
        prices,
      );
      retirement.updatePlan(retirePlan.id, (plan) => ({ ...plan, assets }));
    }

    setBusy(false);
    setStatus(
      willRefreshRetire
        ? "Added leftover to book cash and refreshed Retire from the book. Budget leftover is unchanged."
        : "Added leftover to book cash. Budget leftover is unchanged.",
    );
  }

  return (
    <RetirePanel className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
      <div className="min-w-0">
        <p className="text-sm">
          <span className="font-medium text-[var(--brand-green)]">
            {formatBudgetMoney(leftover.amount, leftover.currency)}
          </span>{" "}
          leftover in Budget
        </p>
        <p className="text-xs text-muted-foreground">
          Same Ready to Assign figure on Home and Invest. Applying adds cash to
          the primary book
          {willRefreshRetire ? " and refreshes Retire from that book" : ""}.
          Budget math does not change.
        </p>
        {status ? (
          <p className="mt-1 text-xs text-muted-foreground">{status}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={() => void handleApply()}
          disabled={busy || !canApply}
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Apply leftover to book cash
          {willRefreshRetire ? " + refresh Retire" : ""}
        </Button>
        {!canApply ? (
          <Button
            size="sm"
            variant="outline"
            render={<Link href="/portfolio" />}
          >
            Create a portfolio
            <ArrowRight className="size-3.5" />
          </Button>
        ) : null}
      </div>
    </RetirePanel>
  );
}
