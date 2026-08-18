"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Copy,
  Loader2,
  RefreshCw,
  Settings2,
} from "lucide-react";
import {
  AddRetirementAssetButton,
  AddRetirementAssetDialog,
} from "@/components/retirement/add-retirement-asset-dialog";
import { CreateRetirementFromPortfolioDialog } from "@/components/retirement/create-retirement-from-portfolio-dialog";
import { RetirementIncomeStreams } from "@/components/retirement/retirement-income-streams";
import { RetirementMonteCarloPanel } from "@/components/retirement/retirement-monte-carlo-panel";
import { RetirementPlanAssetsTable } from "@/components/retirement/retirement-plan-assets-table";
import { RetirementPlanLevers } from "@/components/retirement/retirement-plan-levers";
import { RetirementPlanProjectionsChart } from "@/components/retirement/retirement-plan-projections-chart";
import { RetirementPlanProjectionsTable } from "@/components/retirement/retirement-plan-projections-table";
import { RetirementVerdictHero } from "@/components/retirement/retirement-verdict-hero";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FreeResourceOpenGuard } from "@/components/plans/free-resource-open-guard";
import { usePortfolioPlans } from "@/contexts/portfolio-plans-context";
import { useFxRate } from "@/hooks/use-fx-rate";
import { useRetirementPlanPrices } from "@/hooks/use-retirement-plan-prices";
import { useRetirementPlansStorage } from "@/hooks/use-retirement-plans-storage";
import { useUserPlan } from "@/hooks/use-user-preferences";
import { canOpenRetirementPlanOnPlan } from "@/lib/plans/free-access";
import { computeRetirementDashboard } from "@/lib/retirement/dashboard";
import { runRetirementMonteCarlo } from "@/lib/retirement/monte-carlo";
import { normalizeRetirementPlan } from "@/lib/retirement/normalize";
import { isHoldingVisible } from "@/lib/portfolio/transactions";
import { computeRetirementProjections } from "@/lib/retirement/projections";
import { cn } from "@/lib/utils";
import type { RetirementPlan, RetirementPlanAsset } from "@/types/retirement";
import { isLivePricedAsset } from "@/types/portfolio";

interface RetirementPlanEditorContentProps {
  planId: string;
}

export function RetirementPlanEditorContent({
  planId,
}: RetirementPlanEditorContentProps) {
  const { getPlan, updatePlan, plans, isLoaded, syncError } =
    useRetirementPlansStorage();
  const { plan: userPlan, isLoaded: isPlanLoaded } = useUserPlan();
  const plan = getPlan(planId);
  const canOpen = canOpenRetirementPlanOnPlan(userPlan, plans, planId);
  const { rates, error: fxError } = useFxRate();
  const {
    portfolios,
    activePortfolioId,
    primaryPortfolio,
    isLoaded: portfoliosLoaded,
  } = usePortfolioPlans();

  const [addAssetOpen, setAddAssetOpen] = useState(false);
  const [refreshOpen, setRefreshOpen] = useState(false);
  const [isRefreshingPortfolio, setIsRefreshingPortfolio] = useState(false);
  const [localPlan, setLocalPlan] = useState<RetirementPlan | null>(null);

  useEffect(() => {
    if (plan) {
      setLocalPlan(normalizeRetirementPlan(plan));
    }
  }, [plan]);

  const workingPlan = localPlan ?? (plan ? normalizeRetirementPlan(plan) : null);
  const assets = workingPlan?.assets ?? [];
  const currency = workingPlan?.currency ?? "CAD";

  const {
    prices,
    isRefreshing,
    loadingSymbols,
    lastUpdated,
    error: pricesError,
    refetch,
  } = useRetirementPlanPrices(assets);

  const projections = useMemo(
    () => (workingPlan ? computeRetirementProjections(workingPlan) : []),
    [workingPlan],
  );

  const monteCarlo = useMemo(
    () =>
      workingPlan && workingPlan.assets.length > 0
        ? runRetirementMonteCarlo(workingPlan, { paths: 750, seed: 17 })
        : null,
    [workingPlan],
  );

  const dashboard = useMemo(
    () =>
      workingPlan
        ? computeRetirementDashboard(workingPlan, {
            projections,
            monteCarlo,
          })
        : null,
    [workingPlan, projections, monteCarlo],
  );

  const persistPlan = useCallback(
    (next: RetirementPlan) => {
      const normalized = normalizeRetirementPlan(next);
      setLocalPlan(normalized);
      updatePlan(planId, () => normalized);
    },
    [planId, updatePlan],
  );

  const handleUpdateAsset = useCallback(
    (
      id: string,
      patch: Partial<
        Pick<RetirementPlanAsset, "unitPrice" | "quantity" | "expectedCagr">
      >,
    ) => {
      if (!workingPlan) return;
      persistPlan({
        ...workingPlan,
        assets: workingPlan.assets.map((asset) =>
          asset.id === id ? { ...asset, ...patch } : asset,
        ),
      });
    },
    [workingPlan, persistPlan],
  );

  const handleDeleteAsset = useCallback(
    (id: string) => {
      if (!workingPlan) return;
      persistPlan({
        ...workingPlan,
        assets: workingPlan.assets.filter((asset) => asset.id !== id),
      });
    },
    [workingPlan, persistPlan],
  );

  const handleAddAsset = useCallback(
    (asset: RetirementPlanAsset) => {
      if (!workingPlan) return;
      persistPlan({
        ...workingPlan,
        assets: [...workingPlan.assets, asset],
      });
    },
    [workingPlan, persistPlan],
  );

  const handleFetchPrices = useCallback(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    if (!workingPlan || Object.keys(prices).length === 0) return;

    let changed = false;
    const nextAssets = workingPlan.assets.map((asset) => {
      if (!isLivePricedAsset(asset.type)) return asset;
      const live = prices[asset.symbol];
      if (live === undefined || live === asset.unitPrice) return asset;
      changed = true;
      return { ...asset, unitPrice: live };
    });

    if (changed) {
      persistPlan({ ...workingPlan, assets: nextAssets });
    }
  }, [prices, workingPlan, persistPlan]);

  const portfoliosWithHoldings = portfolios.filter((portfolio) =>
    portfolio.holdings.some(isHoldingVisible),
  );

  if (!isLoaded || !isPlanLoaded) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading plan…
      </div>
    );
  }

  if (!workingPlan || !dashboard) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle>Plan not found</CardTitle>
          <CardDescription>
            This retirement plan may have been deleted or you don&apos;t have
            access to it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" render={<Link href="/retire/plans" />}>
            Back to plans
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <FreeResourceOpenGuard
      resource="retirement"
      isResourceLoaded={isLoaded && isPlanLoaded}
      canOpen={canOpen}
      listHref="/retire/plans"
      listLabel="Back to Retirement Plans"
    >
      <div className="flex flex-1 flex-col gap-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 gap-1.5 text-muted-foreground"
              render={<Link href="/retire/plans" />}
            >
              <ArrowLeft className="size-4" />
              All plans
            </Button>
            <Input
              value={workingPlan.name}
              onChange={(event) =>
                persistPlan({ ...workingPlan, name: event.target.value })
              }
              className="h-auto max-w-xl border-none bg-transparent px-0 text-2xl font-semibold tracking-tight shadow-none focus-visible:ring-0"
            />
            <p className="text-sm text-muted-foreground">
              Target, on-track verdict, and the lever that moves the date money
              runs out.
            </p>
          </div>
        </div>

        {(syncError || pricesError || fxError) && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {syncError ?? pricesError ?? fxError}
          </div>
        )}

        <RetirementVerdictHero
          dashboard={dashboard}
          currency={currency}
          rates={rates}
          planName={workingPlan.name}
          emptyActions={
            <>
              <AddRetirementAssetButton onClick={() => setAddAssetOpen(true)} />
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setRefreshOpen(true)}
                disabled={!portfoliosLoaded || portfoliosWithHoldings.length === 0}
              >
                <Copy className="size-4" />
                Import from portfolio
              </Button>
            </>
          }
        />

        <RetirementPlanLevers plan={workingPlan} onChange={persistPlan} />
        <RetirementIncomeStreams
          streams={workingPlan.incomeStreams}
          onChange={(incomeStreams) =>
            persistPlan({ ...workingPlan, incomeStreams })
          }
        />

        <RetirementMonteCarloPanel
          plan={workingPlan}
          result={monteCarlo}
          currency={currency}
          rates={rates}
          onApply={persistPlan}
        />

        <Card className="surface-card gap-0 py-0 shadow-none">
          <CardHeader className="flex flex-col gap-4 border-b border-border/60 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                Assets
              </CardTitle>
              <CardDescription>
                {lastUpdated
                  ? `Prices updated ${lastUpdated.toLocaleTimeString()}`
                  : "Quantities and prices can refresh from Invest. CAGR stays yours."}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <AddRetirementAssetButton onClick={() => setAddAssetOpen(true)} />
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setRefreshOpen(true)}
                disabled={!portfoliosLoaded || portfoliosWithHoldings.length === 0}
              >
                <Copy className="size-4" />
                Refresh from portfolio
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleFetchPrices}
                disabled={isRefreshing}
              >
                <RefreshCw
                  className={cn("size-4", isRefreshing && "animate-spin")}
                />
                Fetch latest prices
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 py-4 sm:px-6">
            <RetirementPlanAssetsTable
              assets={assets}
              currency={currency}
              rates={rates}
              loadingSymbols={loadingSymbols}
              onUpdateAsset={handleUpdateAsset}
              onDeleteAsset={handleDeleteAsset}
            />
          </CardContent>
        </Card>

        <RetirementPlanProjectionsChart
          projections={projections}
          assets={assets}
          currency={currency}
          rates={rates}
          retirementYear={workingPlan.retirementYear}
          percentiles={monteCarlo?.percentiles}
        />

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Settings2 className="size-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold tracking-tight">
              Year-by-year
            </h2>
          </div>
          <RetirementPlanProjectionsTable
            projections={projections}
            assets={assets}
            currency={currency}
            rates={rates}
            retirementYear={workingPlan.retirementYear}
          />
        </div>

        <AddRetirementAssetDialog
          open={addAssetOpen}
          onOpenChange={setAddAssetOpen}
          onAdd={handleAddAsset}
          existingSymbols={assets.map((asset) => asset.symbol)}
        />
        <CreateRetirementFromPortfolioDialog
          open={refreshOpen}
          onOpenChange={setRefreshOpen}
          mode={assets.length === 0 ? "create" : "refresh"}
          existingAssets={assets}
          portfolios={portfoliosWithHoldings}
          defaultPortfolioId={primaryPortfolio?.id ?? activePortfolioId}
          isSubmitting={isRefreshingPortfolio}
          onConfirm={async ({ assets: nextAssets }) => {
            setIsRefreshingPortfolio(true);
            try {
              persistPlan({ ...workingPlan, assets: nextAssets });
              setRefreshOpen(false);
            } finally {
              setIsRefreshingPortfolio(false);
            }
          }}
        />
      </div>
    </FreeResourceOpenGuard>
  );
}
