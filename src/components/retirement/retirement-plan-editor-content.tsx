"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  RefreshCw,
  Settings2,
  Target,
  Wallet,
} from "lucide-react";
import {
  AddRetirementAssetButton,
  AddRetirementAssetDialog,
} from "@/components/retirement/add-retirement-asset-dialog";
import { RetirementPlanAssetsTable } from "@/components/retirement/retirement-plan-assets-table";
import { RetirementPlanProjectionsChart } from "@/components/retirement/retirement-plan-projections-chart";
import { RetirementPlanProjectionsTable } from "@/components/retirement/retirement-plan-projections-table";
import { CurrencyToggle } from "@/components/portfolio/currency-toggle";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatCard } from "@/components/ui/stat-card";
import { FreeResourceOpenGuard } from "@/components/plans/free-resource-open-guard";
import { useDisplayCurrency } from "@/hooks/use-display-currency";
import { useFxRate } from "@/hooks/use-fx-rate";
import { useRetirementPlanPrices } from "@/hooks/use-retirement-plan-prices";
import { useRetirementPlansStorage } from "@/hooks/use-retirement-plans-storage";
import { useUserPlan } from "@/hooks/use-user-preferences";
import { canOpenRetirementPlanOnPlan } from "@/lib/plans/free-access";
import { computeRetirementProjections } from "@/lib/retirement/projections";
import { formatDisplayMoney } from "@/lib/portfolio/format";
import { cn } from "@/lib/utils";
import {
  getPlanTotalValue,
  type RetirementPlan,
  type RetirementPlanAsset,
} from "@/types/retirement";
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

  const { currency, setCurrency, isLoaded: isCurrencyLoaded } =
    useDisplayCurrency();
  const { rates, isLoading: isFxLoading, error: fxError } = useFxRate();

  const [addAssetOpen, setAddAssetOpen] = useState(false);
  const [localPlan, setLocalPlan] = useState<RetirementPlan | null>(null);

  useEffect(() => {
    if (plan) {
      setLocalPlan(plan);
    }
  }, [plan]);

  const workingPlan = localPlan ?? plan ?? null;
  const assets = workingPlan?.assets ?? [];

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

  const totalValue = useMemo(
    () => (workingPlan ? getPlanTotalValue(workingPlan) : 0),
    [workingPlan],
  );

  const persistPlan = useCallback(
    (next: RetirementPlan) => {
      setLocalPlan(next);
      updatePlan(planId, () => next);
    },
    [planId, updatePlan],
  );

  const patchPlan = useCallback(
    (patch: Partial<RetirementPlan>) => {
      if (!workingPlan) return;
      persistPlan({ ...workingPlan, ...patch });
    },
    [workingPlan, persistPlan],
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

  if (!isLoaded || !isCurrencyLoaded || !isPlanLoaded) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading plan…
      </div>
    );
  }

  if (!workingPlan) {
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

  const closingAtRetirement = projections.find(
    (row) => row.year === workingPlan.retirementYear,
  )?.closingBalance;

  return (
    <FreeResourceOpenGuard
      resource="retirement"
      isResourceLoaded={isLoaded && isPlanLoaded}
      canOpen={canOpen}
      listHref="/retire/plans"
      listLabel="Back to Retirement Plans"
    >
      <div className="flex flex-1 flex-col gap-8">
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
            onChange={(event) => patchPlan({ name: event.target.value })}
            className="h-auto max-w-xl border-none bg-transparent px-0 text-2xl font-semibold tracking-tight shadow-none focus-visible:ring-0"
          />
          <p className="text-sm text-muted-foreground">
            Projections update live as you adjust assets, CAGR, spending, and
            retirement year.
          </p>
        </div>

        <CurrencyToggle
          currency={currency}
          onChange={setCurrency}
          rates={rates}
          isLoading={isFxLoading}
        />
      </div>

      {(syncError || pricesError || fxError) && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {syncError ?? pricesError ?? fxError}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Portfolio Overview"
          value={formatDisplayMoney(totalValue, currency, rates)}
          subValue={`${assets.length} asset${assets.length === 1 ? "" : "s"}`}
        />
        <div className="stat-card space-y-2">
          <p className="stat-label flex items-center gap-1.5">
            <Target className="size-3.5" />
            Retirement Year
          </p>
          <Input
            type="number"
            min={new Date().getFullYear()}
            max={new Date().getFullYear() + 80}
            value={workingPlan.retirementYear}
            onChange={(event) =>
              patchPlan({
                retirementYear:
                  Number(event.target.value) || workingPlan.retirementYear,
              })
            }
            className="h-9 text-lg font-semibold tabular-nums"
          />
          {closingAtRetirement !== undefined && (
            <p className="stat-sub">
              Projected {formatDisplayMoney(closingAtRetirement, currency, rates)} at retirement
            </p>
          )}
        </div>
        <div className="stat-card space-y-3">
          <p className="stat-label flex items-center gap-1.5">
            <Wallet className="size-3.5" />
            Retirement Settings
          </p>
          <div className="space-y-2">
            <Label htmlFor="spending" className="text-xs text-muted-foreground">
              Annual lifestyle spending (USD)
            </Label>
            <Input
              id="spending"
              type="number"
              min="0"
              step="1000"
              value={workingPlan.annualLifestyleSpending}
              onChange={(event) =>
                patchPlan({
                  annualLifestyleSpending:
                    Number(event.target.value) || 0,
                })
              }
              className="h-9 tabular-nums"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inflation" className="text-xs text-muted-foreground">
              Inflation rate %
            </Label>
            <Input
              id="inflation"
              type="number"
              step="0.1"
              value={workingPlan.inflationRate}
              onChange={(event) =>
                patchPlan({
                  inflationRate: Number(event.target.value) || 0,
                })
              }
              className="h-9 tabular-nums"
            />
          </div>
        </div>
        <StatCard
          label="Price Projection Scenario"
          value="Expected"
          subValue="CAGR-based asset growth"
        />
      </div>

      <Card className="surface-card gap-0 py-0 shadow-none">
        <CardHeader className="flex flex-col gap-4 border-b border-border/60 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold">
              Your Investment Breakdown
            </CardTitle>
            <CardDescription>
              {lastUpdated
                ? `Prices updated ${lastUpdated.toLocaleTimeString()}`
                : "Adjust quantities, CAGR, and prices for each asset"}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <AddRetirementAssetButton onClick={() => setAddAssetOpen(true)} />
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleFetchPrices}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={cn("size-4", isRefreshing && "animate-spin")}
              />
              Fetch Latest Prices
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
      />

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Settings2 className="size-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold tracking-tight">
            Year-by-Year Projections
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
      </div>
    </FreeResourceOpenGuard>
  );
}
