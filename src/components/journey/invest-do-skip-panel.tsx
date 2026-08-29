"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMoneyProfile } from "@/hooks/use-money-profile";
import { confirmBudgetElsewhere, INVEST_DO_SKIP_WARNING } from "@/lib/journey/locks";
import { pillarTabHref } from "@/lib/journey/tabs";
import {
  deriveWorkingFlags,
  withDerivedWorking,
} from "@/lib/journey/working";
import { useBudgetPlans } from "@/contexts/budget-plans-context";
import { usePortfolioPlans } from "@/contexts/portfolio-plans-context";
import { useRetirementPlansStorage } from "@/hooks/use-retirement-plans-storage";

export function InvestDoSkipPanel() {
  const { profile, saveProfile, isSaving } = useMoneyProfile();
  const budget = useBudgetPlans();
  const { primaryPortfolio } = usePortfolioPlans();
  const { plans } = useRetirementPlansStorage();
  const [error, setError] = useState<string | null>(null);

  async function handleSkip() {
    if (!profile) return;
    setError(null);
    const next = confirmBudgetElsewhere(profile);
    const working = deriveWorkingFlags({
      flags: next.flags,
      completedLessons: next.completedLessons,
      budgetPlans: budget.plans,
      primaryBook: primaryPortfolio,
      freedomPlans: plans,
    });
    try {
      await saveProfile(withDerivedWorking(next, working));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save that you budget elsewhere.",
      );
    }
  }

  return (
    <div className="glass-card flex flex-1 flex-col gap-4 px-5 py-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Locked
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight">
          Invest Do waits on Budget
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {INVEST_DO_SKIP_WARNING} Start leftover in Budget so the book can stay
          honest — or confirm you budget elsewhere.
        </p>
      </div>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" render={<Link href={pillarTabHref("budget", "do")} />}>
          Open Budget
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!profile || isSaving}
          onClick={() => void handleSkip()}
        >
          {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
          I budget elsewhere
        </Button>
      </div>
    </div>
  );
}
