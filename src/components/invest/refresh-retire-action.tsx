"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, RefreshCw } from "lucide-react";
import { RetirePanel } from "@/components/retirement/retire-ui";
import { Button } from "@/components/ui/button";
import { usePortfolioPlans } from "@/contexts/portfolio-plans-context";
import { usePortfolioPrices } from "@/hooks/use-portfolio-prices";
import { useRetirementPlansStorage } from "@/hooks/use-retirement-plans-storage";
import { pickOpenablePlan } from "@/lib/invest/leftover";
import { isHoldingVisible } from "@/lib/portfolio/transactions";
import { refreshAssetsFromPortfolio } from "@/lib/retirement/portfolio-import";

export function RefreshRetireAction() {
  const { primaryPortfolio } = usePortfolioPlans();
  const retirement = useRetirementPlansStorage();
  const { prices } = usePortfolioPrices(primaryPortfolio?.holdings ?? []);
  const retirePlan = pickOpenablePlan(retirement.plans);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!retirement.isLoaded) return null;
  if (!retirePlan) return null;

  const visible = (primaryPortfolio?.holdings ?? []).filter(isHoldingVisible);
  const canRefresh = visible.length > 0;

  async function handleRefresh() {
    if (!retirePlan || !canRefresh) {
      setStatus("Add holdings to the book, then refresh Freedom.");
      return;
    }
    setBusy(true);
    setStatus(null);
    const assets = refreshAssetsFromPortfolio(
      retirePlan.assets,
      visible,
      prices,
    );
    retirement.updatePlan(retirePlan.id, (plan) => ({ ...plan, assets }));
    setBusy(false);
    setStatus("Freedom quantities and prices updated from this book.");
  }

  return (
    <RetirePanel className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">Refresh Freedom from this book</p>
        <p className="text-xs text-muted-foreground">
          Updates matched holdings on {retirePlan.name}. Does not change
          projection math or re-key the plan.
        </p>
        {status ? (
          <p className="mt-1 text-xs text-muted-foreground">{status}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={() => void handleRefresh()}
          disabled={busy || !canRefresh}
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Refresh Freedom from this book
        </Button>
        <Button
          size="sm"
          variant="outline"
          render={<Link href={`/freedom/plans/${retirePlan.id}`} />}
        >
          Open plan
          <ArrowRight className="size-3.5" />
        </Button>
      </div>
    </RetirePanel>
  );
}
