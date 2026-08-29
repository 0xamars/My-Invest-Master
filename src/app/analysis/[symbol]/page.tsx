import type { Metadata } from "next";
import { after } from "next/server";
import { RequireAuth } from "@/components/auth/require-auth";
import { TickerLookup } from "@/components/ticker/ticker-lookup";
import { TickerReadScreen } from "@/components/ticker/ticker-read-screen";
import {
  getTickerSnapshot,
  peekTickerSnapshot,
} from "@/lib/ticker/get-snapshot";
import { normalizeTickerSymbol } from "@/lib/ticker/symbol";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string }>;
}): Promise<Metadata> {
  const { symbol: raw } = await params;
  const symbol = normalizeTickerSymbol(raw);
  return {
    title: symbol ? `${symbol} · Invest` : "Ticker · Invest",
  };
}

export default async function AnalysisTickerPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol: raw } = await params;
  const symbol = normalizeTickerSymbol(raw);

  if (!symbol) {
    return (
      <RequireAuth
        title="Sign in to open a ticker"
        description="Public-stock reads are tied to your account."
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Enter a public ticker to open a Financial Modeling Prep read.
          </p>
          <TickerLookup />
        </div>
      </RequireAuth>
    );
  }

  const initial = await peekTickerSnapshot(symbol);
  if (initial?.cache.status === "stale") {
    try {
      after(() => {
        void getTickerSnapshot(symbol).catch(() => undefined);
      });
    } catch {
      // Request context without after() — the next get() will refresh.
    }
  }

  return (
    <RequireAuth
      title="Sign in to open a ticker"
      description="Public-stock reads are tied to your account."
    >
      <TickerReadScreen symbol={symbol} initial={initial} />
    </RequireAuth>
  );
}
