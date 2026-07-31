import { RequireAuth } from "@/components/auth/require-auth";
import { AnalysisTickerContent } from "@/components/analysis/analysis-ticker-content";
import { parseAnalysisAssetType } from "@/lib/analysis/types";

interface AnalysisTickerPageProps {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{
    type?: string;
    priceId?: string;
    name?: string;
  }>;
}

export default async function AnalysisTickerPage({
  params,
  searchParams,
}: AnalysisTickerPageProps) {
  const { symbol: rawSymbol } = await params;
  const query = await searchParams;
  const symbol = decodeURIComponent(rawSymbol).trim().toUpperCase();
  const type = parseAnalysisAssetType(query.type);
  const priceId = query.priceId?.trim() || undefined;
  const nameHint = query.name?.trim() || undefined;

  return (
    <RequireAuth>
      <AnalysisTickerContent
        symbol={symbol}
        type={type}
        priceId={priceId}
        nameHint={nameHint}
      />
    </RequireAuth>
  );
}
