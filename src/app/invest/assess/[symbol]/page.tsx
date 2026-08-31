import type { Metadata } from "next";
import { RequireAuth } from "@/components/auth/require-auth";
import { AssessScreen } from "@/components/invest/assess/assess-screen";
import { AssessLandingSearch } from "@/components/invest/assess/assess-landing-search";
import { normalizeTickerSymbol } from "@/lib/ticker/symbol";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string }>;
}): Promise<Metadata> {
  const { symbol: raw } = await params;
  const symbol = normalizeTickerSymbol(raw);
  return {
    title: symbol ? `${symbol} · Assess` : "Assess · Invest",
  };
}

export default async function InvestAssessSymbolPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol: raw } = await params;
  const symbol = normalizeTickerSymbol(raw);

  if (!symbol) {
    return (
      <RequireAuth
        title="Sign in to open Assess"
        description="Fundamental tape and one-note assessment are tied to your account."
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Enter a public ticker to open Assess.
          </p>
          <AssessLandingSearch />
        </div>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth
      title="Sign in to open Assess"
      description="Fundamental tape and one-note assessment are tied to your account."
    >
      <AssessScreen symbol={symbol} />
    </RequireAuth>
  );
}
