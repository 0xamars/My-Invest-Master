"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw } from "lucide-react";
import { AssessNoteView } from "@/components/invest/assess/assess-note-view";
import { AssessTickerBar } from "@/components/invest/assess/assess-ticker-bar";
import { TapeView } from "@/components/invest/assess/tape-view";
import { InvestToolsNav } from "@/components/layout/invest-tools-nav";
import { RetirePageHeader, RetirePanel } from "@/components/retirement/retire-ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { usePortfolioPlans } from "@/contexts/portfolio-plans-context";
import { useBudgetPlans } from "@/contexts/budget-plans-context";
import { leftoverPresenceFromBudgetPlans } from "@/lib/invest/leftover";
import type { AssessPayload } from "@/lib/invest/assess/types";
import { buildBookRows } from "@/lib/ticker/book";
import { useBookTickerQuotes } from "@/hooks/use-book-ticker-quotes";
import { isHoldingVisible } from "@/lib/portfolio/transactions";
import { INVEST_ASSESS_PATH } from "@/lib/invest/assess/paths";

export function AssessScreen({ symbol }: { symbol: string }) {
  const [payload, setPayload] = useState<AssessPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { primaryPortfolio } = usePortfolioPlans();
  const { plans: budgetPlans } = useBudgetPlans();

  const holdings = useMemo(
    () => (primaryPortfolio?.holdings ?? []).filter(isHoldingVisible),
    [primaryPortfolio],
  );
  const stockSymbols = useMemo(
    () => holdings.filter((h) => h.type === "stock").map((h) => h.symbol),
    [holdings],
  );
  const { quotes } = useBookTickerQuotes(stockSymbols);
  const rows = useMemo(() => buildBookRows(holdings, quotes), [holdings, quotes]);
  const row = rows.find(
    (item) => item.ticker.toUpperCase() === symbol.toUpperCase() && item.type === "stock",
  );

  const leftoverPresence = leftoverPresenceFromBudgetPlans(budgetPlans);
  const leftoverLine =
    leftoverPresence.status === "present"
      ? `Budget leftover (Ready to Assign): ${leftoverPresence.amount.toLocaleString("en-US", { style: "currency", currency: leftoverPresence.currency })}.`
      : leftoverPresence.status === "none"
        ? "Budget leftover: none this month."
        : null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/invest/assess?symbol=${encodeURIComponent(symbol)}&type=stock`,
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to load assess workspace");
      }
      const data = (await response.json()) as AssessPayload;
      setPayload(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load assess workspace");
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !payload) {
    return (
      <div className="flex min-h-[16rem] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !payload) {
    return (
      <div className="space-y-4">
        <RetirePageHeader title="Assess" description="Fundamental tape and one-note assessment." />
        <RetirePanel className="p-6">
          <p className="text-sm text-destructive">{error}</p>
          <Button className="mt-4" variant="secondary" onClick={() => void load()}>
            <RefreshCw className="size-4" />
            Retry
          </Button>
        </RetirePanel>
      </div>
    );
  }

  if (!payload) return null;

  const moveContext = {
    owned: Boolean(row),
    portfolioPercent: row?.weight ?? null,
    positionValue: row?.value ?? null,
    leftoverLine,
  };

  return (
    <div className="flex flex-1 flex-col gap-5">
      <InvestToolsNav />
      <RetirePageHeader
        title="Assess"
        description="One-note assessment and annual cash-and-earnings tape."
        action={
          <Link
            href={INVEST_ASSESS_PATH}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            New ticker
          </Link>
        }
      />

      <RetirePanel className="p-4 sm:p-6">
        <AssessTickerBar
          quote={payload.quote}
          analysisHref={payload.meta.analysisHref}
        />

        <Tabs defaultValue="assess" className="mt-5">
          <TabsList>
            <TabsTrigger value="assess">Assess</TabsTrigger>
            <TabsTrigger value="tape">Tape</TabsTrigger>
          </TabsList>
          <TabsContent value="assess" className="mt-5">
            <AssessNoteView
              note={payload.note}
              rating={payload.rating}
              tape={payload.tape}
              moveContext={moveContext}
            />
          </TabsContent>
          <TabsContent value="tape" className="mt-5">
            <TapeView tape={payload.tape} />
          </TabsContent>
        </Tabs>
      </RetirePanel>
    </div>
  );
}
