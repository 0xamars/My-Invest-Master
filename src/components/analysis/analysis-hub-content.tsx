"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bitcoin, TrendingUp } from "lucide-react";
import { TickerSearch } from "@/components/ticker/ticker-search";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildAnalysisHref,
  type AnalysisAssetType,
} from "@/lib/analysis/types";
import { isWatchlistAssetType } from "@/types/watchlist";

export function AnalysisHubContent() {
  const router = useRouter();
  const [mode, setMode] = useState<AnalysisAssetType>("stock");

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

          <div className="relative z-20 max-w-xl">
            <TickerSearch
              key={mode}
              assetType={mode}
              size="lg"
              autoFocus
              clearOnSelect
              placeholder={
                mode === "stock"
                  ? "Search AAPL, NVDA, MSFT…"
                  : "Search BTC, ETH…"
              }
              onSelect={(hit) => {
                if (!isWatchlistAssetType(hit.type)) return;
                router.push(buildAnalysisHref(hit.symbol, hit.type, hit.priceId));
              }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            title: "From Market",
            body: "Spot themes and ideas, then open Analysis for due diligence.",
            href: "/invest",
            label: "Open Invest",
          },
          {
            title: "From Watchlist",
            body: "Click a ticker on any watchlist to research it here.",
            href: "/invest/watchlist",
            label: "Open Watchlist",
          },
          {
            title: "From Portfolio",
            body: "Open a holding’s insight panel and choose View analysis.",
            href: "/invest/portfolio",
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
