"use client";

import { useEffect, useState } from "react";
import { TickerReadView } from "@/components/ticker/ticker-read-view";
import { TickerSkeleton } from "@/components/ticker/ticker-skeleton";
import { TickerLookup } from "@/components/ticker/ticker-lookup";
import { INVEST_PATH } from "@/lib/chrome/nav";
import type { TickerSnapshot } from "@/lib/ticker/types";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export function TickerReadScreen({
  symbol,
  initial,
}: {
  symbol: string;
  initial: TickerSnapshot | null;
}) {
  const [snapshot, setSnapshot] = useState<TickerSnapshot | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initial);

  useEffect(() => {
    setSnapshot(initial);
    setError(null);
    setLoading(!initial);
  }, [symbol, initial]);

  useEffect(() => {
    if (initial) return;
    let cancelled = false;
    setLoading(true);
    void fetch(`/api/analysis/ticker?symbol=${encodeURIComponent(symbol)}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to load ticker");
        }
        return (await response.json()) as TickerSnapshot;
      })
      .then((next) => {
        if (!cancelled) {
          setSnapshot(next);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Unable to load this ticker from Financial Modeling Prep.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, initial]);

  if (snapshot) {
    return <TickerReadView snapshot={snapshot} />;
  }

  if (loading) {
    return <TickerSkeleton symbol={symbol} />;
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit gap-1.5 text-muted-foreground"
        render={<Link href={INVEST_PATH} />}
      >
        <ArrowLeft className="size-4" />
        Invest
      </Button>
      <TickerLookup />
      <p className="text-sm text-muted-foreground">
        {error ?? `No read for ${symbol}.`}
      </p>
    </div>
  );
}
