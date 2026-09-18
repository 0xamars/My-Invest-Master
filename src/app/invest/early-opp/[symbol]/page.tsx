import type { Metadata } from "next";
import { RequireAuth } from "@/components/auth/require-auth";
import { EarlyOppLanding } from "@/components/invest/early-opp/early-opp-landing";
import { EarlyOppScreen } from "@/components/invest/early-opp/early-opp-screen";
import { normalizeTickerSymbol } from "@/lib/ticker/symbol";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string }>;
}): Promise<Metadata> {
  const { symbol: raw } = await params;
  const symbol = normalizeTickerSymbol(raw);
  return {
    title: symbol ? `${symbol} · Early Opp` : "Early Opp · Invest",
  };
}

export default async function InvestEarlyOppSymbolPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol: raw } = await params;
  const symbol = normalizeTickerSymbol(raw);

  if (!symbol) {
    return (
      <RequireAuth
        title="Sign in to open Early Opp"
        description="The 16-step framework is tied to your account."
      >
        <EarlyOppLanding />
      </RequireAuth>
    );
  }

  return (
    <RequireAuth
      title="Sign in to open Early Opp"
      description="The 16-step framework is tied to your account."
    >
      <EarlyOppScreen symbol={symbol} />
    </RequireAuth>
  );
}
