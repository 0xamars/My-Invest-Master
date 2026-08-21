"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Calendar,
  Copy,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { PillarBackLink } from "@/components/layout/pillar-back-link";
import { CreateRetirementFromPortfolioDialog } from "@/components/retirement/create-retirement-from-portfolio-dialog";
import { DeleteRetirementPlanDialog } from "@/components/retirement/delete-retirement-plan-dialog";
import { RetirePageHeader, RetireVerdictChip } from "@/components/retirement/retire-ui";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { usePortfolioPlans } from "@/contexts/portfolio-plans-context";
import { useDisplayCurrency } from "@/hooks/use-display-currency";
import { useFxRate } from "@/hooks/use-fx-rate";
import { useRetirementPlansStorage } from "@/hooks/use-retirement-plans-storage";
import { isHoldingVisible } from "@/lib/portfolio/transactions";
import { computeRetirementDashboard } from "@/lib/retirement/dashboard";
import { formatDisplayMoney } from "@/lib/portfolio/format";
import { normalizeRetirementPlan } from "@/lib/retirement/normalize";
import type { RetirementPlan } from "@/types/retirement";

function formatUpdatedAt(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export function RetirementPlansListContent() {
  const router = useRouter();
  const {
    summaries,
    plans,
    createPlanAndSave,
    deletePlan,
    isLoaded,
    syncError,
    isPlanReady,
  } = useRetirementPlansStorage();
  const {
    portfolios,
    activePortfolioId,
    primaryPortfolio,
    isLoaded: portfoliosLoaded,
  } = usePortfolioPlans();
  const { currency } = useDisplayCurrency();
  const { rates } = useFxRate();

  const [deletingPlan, setDeletingPlan] = useState<RetirementPlan | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingFromPortfolio, setIsCreatingFromPortfolio] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const portfoliosWithHoldings = portfolios.filter((portfolio) =>
    portfolio.holdings.some(isHoldingVisible),
  );
  const hasImportablePortfolio = portfoliosWithHoldings.length > 0;

  async function handleCreateNew() {
    if (!isPlanReady) return;

    setIsCreating(true);
    try {
      const plan = await createPlanAndSave({ name: "New Retirement Plan" });
      router.push(`/retire/plans/${plan.id}`);
    } finally {
      setIsCreating(false);
    }
  }

  function handleOpenImportFromPortfolio() {
    if (!isPlanReady) return;
    if (!hasImportablePortfolio) return;
    setImportDialogOpen(true);
  }

  function openPlan(planId: string) {
    router.push(`/retire/plans/${planId}`);
  }

  if (!isLoaded || !portfoliosLoaded) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading retirement plans…
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      <PillarBackLink href="/retire" label="Back to Retire" />
      <RetirePageHeader
        title="Retirement plans"
        description="Create from a blank model, or import holdings from Invest. Create as many plans as you need."
        action={
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => void handleCreateNew()}
            className="gap-2"
            disabled={isCreating || !isPlanReady}
          >
            {isCreating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Create New Plan
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleOpenImportFromPortfolio}
            disabled={
              isCreatingFromPortfolio ||
              isCreating ||
              !isPlanReady ||
              !hasImportablePortfolio
            }
            title={
              !hasImportablePortfolio
                ? "Add holdings to a portfolio first"
                : undefined
            }
          >
            {isCreatingFromPortfolio ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Copy className="size-4" />
            )}
            Create Plan from Existing Portfolio
          </Button>
        </div>
        }
      />

      {syncError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {syncError}
        </div>
      )}

      {summaries.length === 0 ? (
        <Card className="surface-card border-dashed shadow-none">
          <CardHeader className="text-center">
            <CardTitle>No retirement plans yet</CardTitle>
            <CardDescription>
              Create a blank model, or import holdings from an Invest book.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap justify-center gap-3 pb-8">
            <Button
              onClick={() => void handleCreateNew()}
              className="gap-2"
              disabled={isCreating || !isPlanReady}
            >
              {isCreating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Create New Plan
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleOpenImportFromPortfolio}
              disabled={
                isCreatingFromPortfolio ||
                !isPlanReady ||
                !hasImportablePortfolio
              }
            >
              <Copy className="size-4" />
              Import from Portfolio
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {summaries.map((summary) => {
            const plan = plans.find((item) => item.id === summary.id);
            const normalized = plan ? normalizeRetirementPlan(plan) : null;
            const dash = normalized
              ? computeRetirementDashboard(normalized)
              : null;

            return (
              <Card
                key={summary.id}
                className="surface-card gap-0 py-0 shadow-none transition-colors hover:border-border"
              >
                <CardHeader className="border-b border-border/60 px-5 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="truncate text-base font-semibold">
                      {summary.name}
                    </CardTitle>
                  </div>
                  <CardDescription className="flex flex-wrap items-center gap-1.5">
                    <Calendar className="size-3.5" />
                    Retire {normalized?.retirementAge ?? summary.retirementYear}
                    {dash ? (
                      <RetireVerdictChip verdict={dash.verdict} />
                    ) : null}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="stat-label">Portfolio value</p>
                      <p className="stat-value text-xl">
                        {formatDisplayMoney(
                          summary.totalPortfolioValue,
                          currency,
                          rates,
                        )}
                      </p>
                    </div>
                    <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <TrendingUp className="size-5" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Updated {formatUpdatedAt(summary.updatedAt)}
                  </p>
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5"
                      onClick={() => openPlan(summary.id)}
                    >
                      <Pencil className="size-3.5" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      onClick={() => plan && setDeletingPlan(plan)}
                    >
                      <Trash2 className="size-3.5" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CreateRetirementFromPortfolioDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        portfolios={portfoliosWithHoldings}
        defaultPortfolioId={primaryPortfolio?.id ?? activePortfolioId}
        isSubmitting={isCreatingFromPortfolio}
        onConfirm={async ({ portfolioName, assets }) => {
          setIsCreatingFromPortfolio(true);
          try {
            const plan = await createPlanAndSave({
              name: `${portfolioName} Retirement Plan`,
              assets,
            });
            setImportDialogOpen(false);
            router.push(`/retire/plans/${plan.id}`);
          } finally {
            setIsCreatingFromPortfolio(false);
          }
        }}
      />

      <DeleteRetirementPlanDialog
        plan={deletingPlan}
        open={Boolean(deletingPlan)}
        onOpenChange={(open) => !open && setDeletingPlan(null)}
        onConfirm={deletePlan}
        currency={currency}
        rates={rates}
      />
    </div>
  );
}
