"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertCircle, Plus, RefreshCw, Star } from "lucide-react";
import {
  AddTransactionButton,
  AddTransactionDialog,
} from "@/components/portfolio/add-transaction-dialog";
import { DeleteHoldingDialog } from "@/components/portfolio/delete-holding-dialog";
import { EditHoldingDialog } from "@/components/portfolio/edit-holding-dialog";
import { CurrencyToggle } from "@/components/portfolio/currency-toggle";
import { LeveragePanel } from "@/components/portfolio/leverage-panel";
import { PortfolioTable } from "@/components/portfolio/portfolio-table";
import { InvestRiskChip, LeverageUtilChip } from "@/components/invest/risk-chip";
import { TargetMixPanel } from "@/components/invest/target-mix-panel";
import { FreeResourceOpenGuard } from "@/components/plans/free-resource-open-guard";
import { PillarBackLink } from "@/components/layout/pillar-back-link";
import {
  RetireEmptyState,
  RetireMoney,
  RetirePageHeader,
  RetirePanel,
} from "@/components/retirement/retire-ui";
import { Button } from "@/components/ui/button";
import { usePortfolioPlans } from "@/contexts/portfolio-plans-context";
import { useDisplayCurrency } from "@/hooks/use-display-currency";
import { useFxRate } from "@/hooks/use-fx-rate";
import { usePortfolioPrices } from "@/hooks/use-portfolio-prices";
import { useMoneyProfile } from "@/hooks/use-money-profile";
import { useUserPlan } from "@/hooks/use-user-preferences";
import { explainAddHoldingFields } from "@/lib/journey/density";
import {
  enrichHoldings,
  getPortfolioTotals,
} from "@/lib/portfolio/calculations";
import { buildInvestmentCheckup } from "@/lib/portfolio/checkup";
import { getPortfolioDayChange } from "@/lib/portfolio/day-change";
import {
  cashValueFromHoldings,
  leverageUtilizationFromPortfolio,
} from "@/lib/portfolio/leverage";
import { canOpenPortfolioOnPlan } from "@/lib/plans/free-access";
import { isArchivedHolding, isHoldingVisible } from "@/lib/portfolio/transactions";
import { formatDisplayMoney, formatPercent } from "@/lib/portfolio/format";
import {
  INVEST_PATH,
  INVEST_PORTFOLIO_PATH,
} from "@/lib/chrome/nav";
import { cn } from "@/lib/utils";
import type { PortfolioHolding } from "@/types/portfolio";

export function PortfolioContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const portfolioId = params.id;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState<PortfolioHolding | null>(
    null,
  );
  const [deletingHolding, setDeletingHolding] =
    useState<PortfolioHolding | null>(null);
  const [expandedHoldingId, setExpandedHoldingId] = useState<string | null>(
    null,
  );

  const {
    portfolios,
    holdings,
    addTransaction,
    updateHolding,
    removeHolding,
    updateTargetAllocation,
    updateLeverage,
    isLoaded,
    syncError,
    hasLegacyPortfolioBackup,
    reloadFromCloud,
    activePortfolio,
    setActivePortfolioId,
  } = usePortfolioPlans();
  const { plan, isLoaded: isPlanLoaded } = useUserPlan();
  const { profile } = useMoneyProfile();
  const explainFields = explainAddHoldingFields(profile);

  const { currency, setCurrency, isLoaded: isCurrencyLoaded } =
    useDisplayCurrency();
  const { rates, isLoading: isFxLoading, error: fxError } = useFxRate();
  const {
    prices,
    changes,
    isLoading,
    isRefreshing,
    loadingSymbols,
    lastUpdated,
    error,
    refetch,
  } = usePortfolioPrices(holdings);

  const targetPortfolio = portfolios.find(
    (portfolio) => portfolio.id === portfolioId,
  );
  const canOpen =
    Boolean(targetPortfolio) &&
    canOpenPortfolioOnPlan(plan, targetPortfolio);

  useEffect(() => {
    if (!isLoaded || !portfolioId) return;

    const portfolio = portfolios.find((item) => item.id === portfolioId);
    if (!portfolio) {
      router.replace(INVEST_PORTFOLIO_PATH);
      return;
    }

    if (!isPlanLoaded) return;
    if (!canOpenPortfolioOnPlan(plan, portfolio)) return;

    setActivePortfolioId(portfolioId);
  }, [
    isLoaded,
    isPlanLoaded,
    plan,
    portfolioId,
    portfolios,
    router,
    setActivePortfolioId,
  ]);

  const visibleHoldings = useMemo(
    () => holdings.filter(isHoldingVisible),
    [holdings],
  );

  const archivedHoldings = useMemo(
    () => holdings.filter(isArchivedHolding),
    [holdings],
  );

  const enrichedHoldings = useMemo(
    () => enrichHoldings(visibleHoldings, prices, loadingSymbols, rates),
    [visibleHoldings, prices, loadingSymbols, rates],
  );

  const totals = useMemo(
    () => getPortfolioTotals(enrichedHoldings),
    [enrichedHoldings],
  );

  const enrichedArchived = useMemo(
    () => enrichHoldings(archivedHoldings, prices, loadingSymbols, rates),
    [archivedHoldings, prices, loadingSymbols, rates],
  );

  const checkup = useMemo(
    () =>
      buildInvestmentCheckup(enrichedHoldings, totals, {
        storedTargets: activePortfolio?.targetAllocation,
        portfolioHref: `${INVEST_PORTFOLIO_PATH}/${portfolioId}`,
      }),
    [enrichedHoldings, totals, activePortfolio?.targetAllocation, portfolioId],
  );

  const dayChange = getPortfolioDayChange(
    enrichedHoldings,
    changes,
    totals.currentValue,
  );

  const cashValue = cashValueFromHoldings(enrichedHoldings);
  const leverageUtil = leverageUtilizationFromPortfolio(
    activePortfolio?.leverage,
    cashValue,
  );

  const showEmptyHint =
    isLoaded &&
    visibleHoldings.length === 0 &&
    archivedHoldings.length === 0 &&
    !hasLegacyPortfolioBackup;

  const showLegacyRestoreHint =
    isLoaded &&
    visibleHoldings.length === 0 &&
    archivedHoldings.length === 0 &&
    hasLegacyPortfolioBackup;

  const isActiveReady = activePortfolio?.id === portfolioId;

  if (!isLoaded || !isPlanLoaded) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <RefreshCw className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <FreeResourceOpenGuard
      resource="portfolio"
      isResourceLoaded={isLoaded && isPlanLoaded}
      canOpen={canOpen}
      listHref={INVEST_PORTFOLIO_PATH}
      listLabel="Back to Invest"
    >
      {!isCurrencyLoaded || !isActiveReady || !activePortfolio ? (
        <div className="flex flex-1 items-center justify-center py-24">
          <RefreshCw className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-5">
          <PillarBackLink href={INVEST_PATH} label="Back to Invest" />
          <RetirePageHeader
            title={activePortfolio.name}
            description={
              isLoading
                ? "Fetching live prices…"
                : lastUpdated
                  ? `The book — holdings, mix, and the leverage numbers you typed. Updated ${lastUpdated.toLocaleTimeString()}${isRefreshing ? " · refreshing" : ""}.`
                  : "Holdings, concentration, target mix, and leverage you type from the broker. This page does not place trades."
            }
            action={
              <div className="flex flex-wrap items-center gap-2">
                <CurrencyToggle
                  currency={currency}
                  onChange={setCurrency}
                  rates={rates}
                  isLoading={isFxLoading}
                  error={fxError}
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="size-10 rounded-xl border-border/80 bg-card"
                  onClick={() => refetch()}
                  disabled={isLoading || holdings.length === 0}
                  title="Refresh prices"
                >
                  <RefreshCw
                    className={cn("size-4", isRefreshing && "animate-spin")}
                  />
                </Button>
                <AddTransactionButton onClick={() => setDialogOpen(true)} />
              </div>
            }
          />

          {activePortfolio.isPrimary ? (
            <span className="inline-flex w-fit items-center gap-1 rounded-md border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[0.7rem] font-medium text-primary">
              <Star className="size-3 fill-primary" />
              Primary book
            </span>
          ) : (
            <p className="text-xs text-muted-foreground">
              Viewing this book — Primary is the checkup default.
            </p>
          )}

          {showLegacyRestoreHint ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3.5 text-sm">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <p>
                  A browser backup of holdings was found and is not in this
                  portfolio yet. Restore uploads it into your cloud portfolios
                  (only when cloud holdings are empty).
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void reloadFromCloud()}
              >
                Restore to cloud
              </Button>
            </div>
          ) : null}

          {(syncError || error || fxError) && (
            <div
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm",
                syncError || error
                  ? "border border-destructive/25 bg-destructive/5 text-destructive"
                  : "border border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-200",
              )}
            >
              <AlertCircle className="size-4 shrink-0" />
              {syncError ?? error ?? fxError}
            </div>
          )}

          {showEmptyHint ? (
            <RetirePanel>
              <RetireEmptyState
                icon={<Plus className="size-5" />}
                title="No holdings yet"
                description="Add a stock, crypto, cash, or custom asset to start the book. Buy and sell stay on this page."
                actions={
                  <AddTransactionButton onClick={() => setDialogOpen(true)} />
                }
              />
            </RetirePanel>
          ) : (
            <BookHero
              checkup={checkup}
              dayChange={dayChange}
              leverageUtil={leverageUtil}
              currency={currency}
              rates={rates}
              isLoading={totals.hasLoadingPrices || isLoading}
            />
          )}

          <LeveragePanel
            leverage={activePortfolio.leverage}
            cashValue={cashValue}
            currency={currency}
            rates={rates}
            onSave={(next) => updateLeverage(portfolioId, next)}
          />

          {!showEmptyHint ? (
            <RetirePanel>
              <div className="border-b border-border/60 px-5 py-4">
                <h2 className="text-sm font-semibold">Holdings</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Weight is % of this book. 10%+ is a note, 25%+ is a flag.
                  Expand a name for facts.
                </p>
              </div>
              <div className="px-2 pb-2 sm:px-3 sm:pb-3">
                <PortfolioTable
                  holdings={enrichedHoldings}
                  isLoading={isLoading}
                  currency={currency}
                  rates={rates}
                  expandedHoldingId={expandedHoldingId}
                  dayChanges={changes}
                  onToggleExpand={(holding) =>
                    setExpandedHoldingId((current) =>
                      current === holding.id ? null : holding.id,
                    )
                  }
                  onEdit={(holding) => setEditingHolding(holding)}
                  onDelete={(holding) => setDeletingHolding(holding)}
                  onAdd={() => setDialogOpen(true)}
                />
              </div>
            </RetirePanel>
          ) : null}

          {enrichedArchived.length > 0 ? (
            <RetirePanel>
              <div className="border-b border-border/60 px-5 py-4">
                <h2 className="text-sm font-semibold">Closed positions</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Zero quantity — kept for the buy/sell ledger.
                </p>
              </div>
              <div className="px-2 pb-2 sm:px-3 sm:pb-3">
                <PortfolioTable
                  holdings={enrichedArchived}
                  currency={currency}
                  rates={rates}
                  expandedHoldingId={expandedHoldingId}
                  dayChanges={changes}
                  onToggleExpand={(holding) =>
                    setExpandedHoldingId((current) =>
                      current === holding.id ? null : holding.id,
                    )
                  }
                  onEdit={(holding) => setEditingHolding(holding)}
                  onDelete={(holding) => setDeletingHolding(holding)}
                />
              </div>
            </RetirePanel>
          ) : null}

          {enrichedHoldings.length > 0 ? (
            <TargetMixPanel
              checkup={checkup}
              currency={currency}
              rates={rates}
              portfolioId={portfolioId}
              storedTargets={activePortfolio.targetAllocation}
              onSave={updateTargetAllocation}
            />
          ) : null}

          <AddTransactionDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            onAdd={addTransaction}
            holdings={holdings}
            explainFields={explainFields}
          />

          <EditHoldingDialog
            holding={editingHolding}
            open={editingHolding !== null}
            onOpenChange={(open) => {
              if (!open) setEditingHolding(null);
            }}
            onSave={updateHolding}
          />

          <DeleteHoldingDialog
            holding={deletingHolding}
            open={deletingHolding !== null}
            onOpenChange={(open) => {
              if (!open) setDeletingHolding(null);
            }}
            onConfirm={removeHolding}
          />
        </div>
      )}
    </FreeResourceOpenGuard>
  );
}

function BookHero({
  checkup,
  dayChange,
  leverageUtil,
  currency,
  rates,
  isLoading,
}: {
  checkup: ReturnType<typeof buildInvestmentCheckup>;
  dayChange: ReturnType<typeof getPortfolioDayChange>;
  leverageUtil: ReturnType<typeof leverageUtilizationFromPortfolio>;
  currency: Parameters<typeof formatDisplayMoney>[1];
  rates: Parameters<typeof formatDisplayMoney>[2];
  isLoading: boolean;
}) {
  const money = (value: number) => formatDisplayMoney(value, currency, rates);

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <section className="budget-hero px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-wrap items-center gap-2">
          <InvestRiskChip chip={checkup.riskChip} />
          <LeverageUtilChip
            flag={leverageUtil.flag}
            percent={leverageUtil.utilizationPercent}
          />
        </div>
        <p className="budget-hero-value mt-3">
          {isLoading ? "…" : money(checkup.totalValue)}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Book value · {currency}
        </p>
      </section>

      <RetirePanel className="grid grid-cols-1 divide-y divide-border/60">
        <Metric
          label="Day change"
          value={
            !dayChange
              ? "—"
              : `${dayChange.change >= 0 ? "+" : "−"}${money(Math.abs(dayChange.change))}`
          }
          hint={dayChange ? formatPercent(dayChange.changePercent) : undefined}
          tone={!dayChange ? "neutral" : dayChange.change >= 0 ? "in" : "danger"}
        />
        <Metric
          label="Cost-basis P/L"
          value={
            isLoading
              ? "…"
              : `${checkup.profitLoss >= 0 ? "+" : "−"}${money(Math.abs(checkup.profitLoss))}`
          }
          hint={formatPercent(checkup.profitLossPercent)}
          tone={checkup.profitLoss >= 0 ? "in" : "danger"}
        />
      </RetirePanel>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "in" | "out" | "danger" | "neutral";
}) {
  return (
    <div className="flex flex-col justify-center px-5 py-4">
      <p className="budget-metric-label">{label}</p>
      <p className="budget-metric-value mt-1.5">
        <RetireMoney value={value} tone={tone} />
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
