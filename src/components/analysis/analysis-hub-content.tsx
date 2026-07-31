"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bitcoin, Loader2, Search, TrendingUp } from "lucide-react";
import { AssetLogo } from "@/components/portfolio/asset-logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAssetSearch } from "@/hooks/use-asset-search";
import {
  buildAnalysisHref,
  type AnalysisAssetType,
} from "@/lib/analysis/types";
import { isWatchlistAssetType } from "@/types/watchlist";
import type { AssetCatalogItem } from "@/types/portfolio";

export function AnalysisHubContent() {
  const router = useRouter();
  const [mode, setMode] = useState<AnalysisAssetType>("stock");
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);

  const { results, isSearching, error } = useAssetSearch(query, mode, true);

  useEffect(() => {
    setQuery("");
    setShowResults(false);
  }, [mode]);

  function openTicker(asset: AssetCatalogItem) {
    if (!isWatchlistAssetType(asset.type)) return;
    router.push(buildAnalysisHref(asset.symbol, asset.type, asset.priceId));
  }

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Analysis</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Research stocks and crypto before you buy. Search a ticker to open a
          due-diligence workspace — ratings and deeper modules arrive later.
        </p>
      </div>

      <Card className="surface-card relative z-10 overflow-visible shadow-none">
        <CardHeader className="border-b border-border/60">
          <CardTitle className="text-base">Find a ticker</CardTitle>
          <CardDescription>
            Start from Market ideas, your Watchlist, or search here.
          </CardDescription>
        </CardHeader>
        <CardContent className="relative space-y-4 overflow-visible pt-6">
          <Tabs
            value={mode}
            onValueChange={(value) => {
              if (value === "stock" || value === "crypto") setMode(value);
            }}
          >
            <TabsList className="grid w-full max-w-sm grid-cols-2">
              <TabsTrigger value="stock" className="gap-1.5">
                <TrendingUp className="size-3.5" />
                Stocks
              </TabsTrigger>
              <TabsTrigger value="crypto" className="gap-1.5">
                <Bitcoin className="size-3.5" />
                Crypto
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative z-20 max-w-xl space-y-1.5">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-11 pl-9"
                placeholder={
                  mode === "stock"
                    ? "Search AAPL, NVDA, MSFT…"
                    : "Search BTC, ETH…"
                }
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setShowResults(true);
                }}
                onFocus={() => setShowResults(true)}
                autoFocus
              />
              {isSearching && (
                <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>

            {showResults && query.trim().length > 0 && (
              <div className="absolute top-full right-0 left-0 z-50 mt-1 max-h-72 overflow-auto rounded-xl border border-border bg-popover shadow-lg">
                {results.length === 0 && !isSearching ? (
                  <p className="px-3 py-4 text-sm text-muted-foreground">
                    {error ?? "No matches found."}
                  </p>
                ) : (
                  results.map((asset) => (
                    <button
                      key={`${asset.symbol}-${asset.type}-${asset.priceId ?? ""}`}
                      type="button"
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted"
                      onClick={() => openTicker(asset)}
                    >
                      <AssetLogo
                        symbol={asset.symbol}
                        name={asset.name}
                        type={asset.type}
                        logoUrl={asset.logoUrl}
                        priceId={asset.priceId}
                        size="sm"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold tracking-wide">
                          {asset.symbol}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {asset.name}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            title: "From Market",
            body: "Spot themes and ideas, then open Analysis for due diligence.",
            href: "/market",
            label: "Browse Market",
          },
          {
            title: "From Watchlist",
            body: "Click a ticker on any watchlist to research it here.",
            href: "/watchlist",
            label: "Open Watchlist",
          },
          {
            title: "From Portfolio",
            body: "Open a holding’s insight panel and choose View analysis.",
            href: "/portfolio",
            label: "Open Portfolio",
          },
        ].map((item) => (
          <Card key={item.title} className="surface-card shadow-none">
            <CardHeader>
              <CardTitle className="text-base">{item.title}</CardTitle>
              <CardDescription>{item.body}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                size="sm"
                render={<Link href={item.href} />}
              >
                {item.label}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
