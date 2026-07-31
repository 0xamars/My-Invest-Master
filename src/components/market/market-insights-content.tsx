"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Compass,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { CategoryPageHeader } from "@/components/category/category-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildAnalysisHref } from "@/lib/analysis/types";
import { cn } from "@/lib/utils";
import {
  CUSTOM_THEME_CATALOG,
  MARKET_INSIGHTS_DISCLAIMER,
  type CustomThemePayload,
  type MarketSentiment,
  type MarketStockQuality,
  type MarketTheme,
  type MarketThemeStock,
  type MarketThemesPayload,
} from "@/types/market-themes";

function sentimentLabel(sentiment: MarketSentiment): string {
  switch (sentiment) {
    case "positive":
      return "Positive";
    case "rising":
      return "Rising";
    default:
      return "Neutral";
  }
}

function sentimentClass(sentiment: MarketSentiment): string {
  switch (sentiment) {
    case "positive":
      return "border-[var(--brand-green)]/30 bg-[var(--brand-green)]/10 text-[var(--brand-green)]";
    case "rising":
      return "border-[var(--brand-orange)]/35 bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]";
    default:
      return "border-border/70 bg-muted/40 text-muted-foreground";
  }
}

function qualityLabel(quality: MarketStockQuality): string {
  switch (quality) {
    case "strong":
      return "Strong quality";
    case "watch":
      return "Higher risk";
    default:
      return "Balanced";
  }
}

function qualityClass(quality: MarketStockQuality): string {
  switch (quality) {
    case "strong":
      return "bg-[var(--brand-green)]/12 text-[var(--brand-green)]";
    case "watch":
      return "bg-[var(--brand-orange)]/12 text-[var(--brand-orange)]";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function StockRow({ stock }: { stock: MarketThemeStock }) {
  return (
    <Link
      href={buildAnalysisHref(stock.ticker, "stock")}
      className="block rounded-xl border border-border/50 bg-background/30 px-3 py-2.5 transition-colors hover:border-border hover:bg-muted/20"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-semibold tracking-tight text-foreground">
              {stock.ticker}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {stock.name}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-foreground/85">
            {stock.reason}
          </p>
          <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
            {stock.metrics}
            {stock.valuationNote ? ` · ${stock.valuationNote}` : ""}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
            qualityClass(stock.quality),
          )}
        >
          {qualityLabel(stock.quality)}
        </span>
      </div>
    </Link>
  );
}

function ThemeCard({ theme, index }: { theme: MarketTheme; index: number }) {
  return (
    <Card className="surface-card gap-0 overflow-hidden py-0 shadow-none">
      <CardHeader className="space-y-3 border-b border-border/50 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-md bg-muted text-[11px] font-semibold tabular-nums text-muted-foreground">
                {index}
              </span>
              <CardTitle className="truncate text-base font-semibold tracking-tight">
                {theme.name}
              </CardTitle>
            </div>
            <CardDescription className="text-xs leading-relaxed">
              {theme.description}
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className={cn("shrink-0 gap-1 font-medium", sentimentClass(theme.sentiment))}
          >
            {theme.sentiment === "rising" ? (
              <TrendingUp className="size-3" />
            ) : (
              <Sparkles className="size-3" />
            )}
            {sentimentLabel(theme.sentiment)}
          </Badge>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {theme.popularityReason}
        </p>
      </CardHeader>
      <CardContent className="space-y-2 px-5 py-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Top 5 stocks
        </p>
        <div className="space-y-2">
          {theme.stocks.map((stock) => (
            <StockRow key={`${theme.id}-${stock.ticker}`} stock={stock} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CustomThemeExplorer({
  theme,
  isLoading,
  selectedId,
  onSelect,
}: {
  theme: MarketTheme | null;
  isLoading: boolean;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <Card className="surface-card gap-0 overflow-hidden border-[var(--brand-green)]/25 py-0 shadow-none">
      <CardHeader className="space-y-3 border-b border-border/50 bg-[linear-gradient(135deg,color-mix(in_oklch,var(--brand-green)_12%,transparent),color-mix(in_oklch,var(--brand-orange)_8%,transparent))] px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-green)]/15 text-[var(--brand-green)]">
            <Compass className="size-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base font-semibold tracking-tight">
              Custom Theme Explorer
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Pick a theme to screen Top 5 stocks for financial strength, fair
              valuation, and growth potential.
            </CardDescription>
          </div>
        </div>

        <Select
          value={selectedId}
          onValueChange={(value) => value && onSelect(value)}
        >
          <SelectTrigger className="bg-background/60">
            <SelectValue placeholder="Select a theme" />
          </SelectTrigger>
          <SelectContent>
            {CUSTOM_THEME_CATALOG.map((entry) => (
              <SelectItem key={entry.id} value={entry.id}>
                {entry.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>

      <CardContent className="space-y-3 px-5 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-[var(--brand-green)]" />
            Screening stocks…
          </div>
        ) : theme ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">{theme.name}</p>
              <Badge
                variant="outline"
                className={cn("gap-1", sentimentClass(theme.sentiment))}
              >
                {sentimentLabel(theme.sentiment)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{theme.description}</p>
            <div className="space-y-2 pt-1">
              {theme.stocks.map((stock) => (
                <StockRow key={`custom-${stock.ticker}`} stock={stock} />
              ))}
            </div>
          </>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Choose a theme to explore quality names.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function MarketInsightsContent() {
  const [popular, setPopular] = useState<MarketThemesPayload | null>(null);
  const [custom, setCustom] = useState<CustomThemePayload | null>(null);
  const [selectedThemeId, setSelectedThemeId] = useState(
    CUSTOM_THEME_CATALOG[0]?.id ?? "ai-infrastructure",
  );
  const [isLoadingPopular, setIsLoadingPopular] = useState(true);
  const [isLoadingCustom, setIsLoadingCustom] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPopular = useCallback(async (refresh = false) => {
    setError(null);
    if (refresh) setIsRefreshing(true);
    else setIsLoadingPopular(true);

    try {
      const query = refresh ? "?mode=popular&refresh=1" : "?mode=popular";
      const response = await fetch(`/api/market/themes${query}`);
      const payload = (await response.json()) as MarketThemesPayload & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load themes.");
      }
      setPopular(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load themes.");
    } finally {
      setIsLoadingPopular(false);
      setIsRefreshing(false);
    }
  }, []);

  const loadCustom = useCallback(async (themeId: string) => {
    setIsLoadingCustom(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/market/themes?mode=custom&themeId=${encodeURIComponent(themeId)}`,
      );
      const payload = (await response.json()) as CustomThemePayload & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load theme.");
      }
      setCustom(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load theme.");
    } finally {
      setIsLoadingCustom(false);
    }
  }, []);

  useEffect(() => {
    void loadPopular(false);
  }, [loadPopular]);

  useEffect(() => {
    void loadCustom(selectedThemeId);
  }, [selectedThemeId, loadCustom]);

  return (
    <div className="flex flex-1 flex-col gap-8">
      <CategoryPageHeader
        category="invest"
        title="Market"
        description="AI + sentiment-aware themes with quality-screened stocks — educational insights only."
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={isRefreshing || isLoadingPopular}
            onClick={() => void loadPopular(true)}
          >
            {isRefreshing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Refresh themes
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-[var(--brand-green)]" />
          Powered by InvestSalsa AI insights
        </span>
        {popular && (
          <>
            <span aria-hidden>·</span>
            <span>
              Source: {popular.source}
              {popular.provider ? ` (${popular.provider})` : ""}
            </span>
            <span aria-hidden>·</span>
            <span>
              Updated{" "}
              {new Date(popular.generatedAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Popular themes
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Five themes capturing current investor attention, each with Top 5
              quality-screened stocks.
            </p>
          </div>
        </div>

        {isLoadingPopular && !popular ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 py-20 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-[var(--brand-green)]" />
            Analyzing themes…
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {popular?.themes.map((theme, index) => (
              <ThemeCard key={theme.id} theme={theme} index={index + 1} />
            ))}
            <CustomThemeExplorer
              theme={custom?.theme ?? null}
              isLoading={isLoadingCustom}
              selectedId={selectedThemeId}
              onSelect={setSelectedThemeId}
            />
          </div>
        )}
      </section>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-[var(--brand-orange)]" />
        {MARKET_INSIGHTS_DISCLAIMER} Themes synthesize AI trend analysis with
        social/news interest heuristics. Stock lists emphasize financial
        strength, valuation discipline, and growth potential — not buy/sell
        recommendations. Architecture is ready for live market and sentiment
        feeds.
      </p>
    </div>
  );
}
