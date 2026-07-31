"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Eye,
  Loader2,
  PieChart,
  RefreshCw,
} from "lucide-react";
import { AnalysisPriceChart } from "@/components/analysis/analysis-price-chart";
import { AnalysisRatingSection } from "@/components/analysis/analysis-rating-section";
import { AssetLogo } from "@/components/portfolio/asset-logo";
import {
  AnalyticsChartCard,
} from "@/components/analytics/analytics-chart-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatCard } from "@/components/ui/stat-card";
import { useDisplayCurrency } from "@/hooks/use-display-currency";
import { useFxRate } from "@/hooks/use-fx-rate";
import { usePortfolioPlans } from "@/contexts/portfolio-plans-context";
import { useWatchlistPlans } from "@/contexts/watchlist-plans-context";
import { buildAnalysisQuoteStats } from "@/lib/analysis/format-stats";
import type { InvestSalsaRating } from "@/lib/analysis/rating/types";
import type { AnalysisChartPoint } from "@/lib/analysis/history";
import {
  ANALYSIS_CHART_RANGES,
  type AnalysisAssetType,
  type AnalysisChartRange,
  type AnalysisQuote,
  type AnalysisRatingPayload,
} from "@/lib/analysis/types";
import {
  formatDisplayMoney,
  formatPercent,
  formatPrice,
  profitLossClass,
} from "@/lib/portfolio/format";
import { cn } from "@/lib/utils";

interface AnalysisTickerContentProps {
  symbol: string;
  type: AnalysisAssetType;
  priceId?: string;
  nameHint?: string;
}

async function fetchRatingPayload(params: {
  symbol: string;
  type: AnalysisAssetType;
  priceId?: string;
  name?: string;
  range: AnalysisChartRange;
  chartOnly?: boolean;
}): Promise<Partial<AnalysisRatingPayload> & { chart: AnalysisRatingPayload["chart"] }> {
  const search = new URLSearchParams({
    symbol: params.symbol,
    type: params.type,
    range: params.range,
  });
  if (params.priceId) search.set("priceId", params.priceId);
  if (params.name) search.set("name", params.name);
  if (params.chartOnly) search.set("chartOnly", "1");

  const response = await fetch(`/api/analysis/rating?${search.toString()}`);
  if (!response.ok) {
    throw new Error("Unable to load analysis rating");
  }
  return response.json() as Promise<
    Partial<AnalysisRatingPayload> & { chart: AnalysisRatingPayload["chart"] }
  >;
}

export function AnalysisTickerContent({
  symbol,
  type,
  priceId,
  nameHint,
}: AnalysisTickerContentProps) {
  const router = useRouter();
  const { currency } = useDisplayCurrency();
  const { rates, isLoading: isFxLoading, error: fxError } = useFxRate();
  const { lists, addTicker, isLoaded: watchlistsLoaded } = useWatchlistPlans();
  const { primaryPortfolio, portfolios } = usePortfolioPlans();

  const [quote, setQuote] = useState<AnalysisQuote | null>(null);
  const [rating, setRating] = useState<InvestSalsaRating | null>(null);
  const [chartPoints, setChartPoints] = useState<AnalysisChartPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<AnalysisChartRange>("1M");
  const [watchlistId, setWatchlistId] = useState("");
  const [watchlistMessage, setWatchlistMessage] = useState<string | null>(null);
  const [watchlistAdded, setWatchlistAdded] = useState(false);
  const hasLoadedRef = useRef(false);

  const upper = symbol.toUpperCase();

  const load = useCallback(
    async (nextRange: AnalysisChartRange, opts?: { soft?: boolean }) => {
      const soft = opts?.soft === true;
      if (soft) setIsChartLoading(true);
      else setIsLoading(true);
      setError(null);
      try {
        const payload = await fetchRatingPayload({
          symbol: upper,
          type,
          priceId,
          name: nameHint,
          range: nextRange,
          chartOnly: soft,
        });
        if (soft) {
          setChartPoints(payload.chart.points);
        } else {
          if (!payload.quote || !payload.rating) {
            throw new Error("Incomplete rating payload");
          }
          setQuote(payload.quote);
          setRating(payload.rating);
          setChartPoints(payload.chart.points);
          hasLoadedRef.current = true;
          if (payload.quote.error && payload.quote.price == null) {
            setError(payload.quote.error);
          }
        }
      } catch {
        if (!soft) {
          setQuote(null);
          setRating(null);
          setChartPoints([]);
          setError("Unable to load analysis data for this ticker.");
        }
      } finally {
        setIsLoading(false);
        setIsChartLoading(false);
      }
    },
    [upper, type, priceId, nameHint],
  );

  useEffect(() => {
    hasLoadedRef.current = false;
  }, [upper, type, priceId]);

  useEffect(() => {
    void load(range, { soft: hasLoadedRef.current });
  }, [load, range]);

  useEffect(() => {
    setWatchlistMessage(null);
    setWatchlistAdded(false);
  }, [upper, type]);

  useEffect(() => {
    if (!watchlistsLoaded) return;
    if (lists.length === 0) {
      setWatchlistId("");
      return;
    }
    if (!watchlistId || !lists.some((list) => list.id === watchlistId)) {
      setWatchlistId(lists[0].id);
    }
  }, [watchlistsLoaded, lists, watchlistId]);

  const alreadyOnWatchlist = useMemo(() => {
    if (!watchlistId) return false;
    const list = lists.find((item) => item.id === watchlistId);
    if (!list) return false;
    return list.items.some(
      (item) => item.symbol === upper && item.type === type,
    );
  }, [lists, watchlistId, upper, type]);

  const stats = useMemo(() => {
    if (!quote) return [];
    return buildAnalysisQuoteStats(quote, currency, rates);
  }, [quote, currency, rates]);

  const portfolioHref = primaryPortfolio
    ? `/portfolio/${primaryPortfolio.id}`
    : portfolios[0]
      ? `/portfolio/${portfolios[0].id}`
      : "/portfolio";

  function handleAddToWatchlist() {
    if (lists.length === 0) {
      setWatchlistMessage("Create a watchlist first under Invest → Watchlist.");
      return;
    }
    if (!watchlistId) {
      setWatchlistMessage("Select a watchlist to continue.");
      return;
    }
    if (alreadyOnWatchlist) {
      setWatchlistAdded(true);
      setWatchlistMessage("Already on this watchlist.");
      return;
    }

    addTicker(watchlistId, {
      symbol: upper,
      name: quote?.name ?? nameHint ?? upper,
      type,
      priceId: quote?.priceId ?? priceId,
      logoUrl: quote?.logoUrl,
    });
    setWatchlistAdded(true);
    setWatchlistMessage("Added to watchlist.");
  }

  if (isLoading && !quote) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading analysis…
      </div>
    );
  }

  if (!quote || (error && quote.price == null)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertCircle className="size-5" />
        </div>
        <div className="space-y-1">
          <p className="text-lg font-semibold">Ticker unavailable</p>
          <p className="max-w-md text-sm text-muted-foreground">
            {error ??
              `We could not load market data for ${upper}. Check the symbol or try again.`}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" render={<Link href="/analysis" />}>
            <ArrowLeft className="size-4" />
            Back to Analysis
          </Button>
          <Button variant="outline" onClick={() => void load(range)}>
            <RefreshCw className="size-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const changeLabel = type === "crypto" ? "24h change" : "Day change";

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div className="page-header !items-start">
        <div className="space-y-4">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 w-fit gap-1.5 text-muted-foreground"
            render={<Link href="/analysis" />}
          >
            <ArrowLeft className="size-4" />
            All analysis
          </Button>

          <div className="flex items-start gap-4">
            <AssetLogo
              symbol={quote.symbol}
              name={quote.name}
              type={quote.type}
              logoUrl={quote.logoUrl}
              priceId={quote.priceId}
              size="md"
            />
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="page-title">{quote.symbol}</h1>
                <Badge
                  variant="outline"
                  className="border-border/70 bg-muted/30 px-2 py-0.5 text-[10px] font-normal uppercase tracking-wide text-muted-foreground"
                >
                  {quote.type}
                </Badge>
              </div>
              <p className="page-description">{quote.name}</p>
              <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
                <p className="text-2xl font-semibold tabular-nums tracking-tight">
                  {quote.price != null
                    ? formatPrice(quote.price, quote.type, currency, rates)
                    : "—"}
                </p>
                {quote.change != null && quote.changePercent != null && (
                  <p
                    className={cn(
                      "pb-0.5 text-sm font-medium tabular-nums",
                      profitLossClass(quote.changePercent),
                    )}
                  >
                    {quote.change >= 0 ? "+" : ""}
                    {formatDisplayMoney(quote.change, currency, rates)} ·{" "}
                    {formatPercent(quote.changePercent)}
                    <span className="ml-1 text-muted-foreground">
                      {changeLabel}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button
              variant="outline"
              size="icon"
              className="size-10 rounded-xl"
              onClick={() => void load(range)}
              disabled={isLoading}
              title="Refresh analysis"
            >
              <RefreshCw
                className={cn("size-4", isLoading && "animate-spin")}
              />
            </Button>
            {lists.length > 1 && (
              <Select
                value={watchlistId || undefined}
                onValueChange={(value) => {
                  if (value) {
                    setWatchlistId(value);
                    setWatchlistMessage(null);
                    setWatchlistAdded(false);
                  }
                }}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Watchlist" />
                </SelectTrigger>
                <SelectContent>
                  {lists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleAddToWatchlist}
            >
              {watchlistAdded || alreadyOnWatchlist ? (
                <Check className="size-4 text-primary" />
              ) : (
                <Eye className="size-4" />
              )}
              {alreadyOnWatchlist || watchlistAdded
                ? "On watchlist"
                : "Add to Watchlist"}
            </Button>
            <Button
              className="gap-2"
              render={<Link href={portfolioHref} />}
            >
              <PieChart className="size-4" />
              Add in Portfolio
            </Button>
          </div>
          {watchlistMessage && (
            <p
              className={cn(
                "text-xs sm:text-right",
                watchlistAdded || alreadyOnWatchlist
                  ? "text-primary"
                  : "text-amber-700 dark:text-amber-400",
              )}
            >
              {watchlistMessage}
            </p>
          )}
        </div>
      </div>

      {(error || fxError) && quote.price != null && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <AlertCircle className="size-4 shrink-0" />
          {error ?? fxError}
          {isFxLoading ? " · Loading FX…" : null}
        </div>
      )}

      <AnalysisRatingSection rating={rating} isLoading={isLoading} />

      <AnalyticsChartCard
        title="Price chart"
        description="Historical closes for context — signals live in Technical detail above"
      >
        <div className="mb-4 flex flex-wrap gap-1.5">
          {ANALYSIS_CHART_RANGES.map((item) => (
            <Button
              key={item}
              type="button"
              size="sm"
              variant={range === item ? "default" : "outline"}
              className="h-8 min-w-10 px-2.5 text-xs"
              onClick={() => setRange(item)}
              disabled={isChartLoading}
            >
              {item}
            </Button>
          ))}
        </div>
        {isChartLoading ? (
          <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Updating chart…
          </div>
        ) : (
          <AnalysisPriceChart
            points={chartPoints}
            assetType={quote.type}
            currency={currency}
            rates={rates}
          />
        )}
      </AnalyticsChartCard>

      {stats.length > 0 && (
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-medium">Market snapshot</h2>
            <p className="text-xs text-muted-foreground">
              Context not scored separately in the rating breakdown
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <StatCard key={stat.id} label={stat.label} value={stat.value} />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => router.push("/market")}>
          Browse Market
        </Button>
        <Button variant="outline" onClick={() => router.push("/watchlist")}>
          Open Watchlist
        </Button>
      </div>
    </div>
  );
}
