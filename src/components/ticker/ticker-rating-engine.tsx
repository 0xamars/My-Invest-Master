"use client";

import { AnalysisRatingSection } from "@/components/analysis/analysis-rating-section";
import { useAnalysisRating } from "@/hooks/use-analysis-rating";

export function TickerRatingEngine({
  symbol,
  price,
  name,
  description,
}: {
  symbol: string;
  price?: number | null;
  name?: string | null;
  description?: string | null;
}) {
  const {
    rating,
    forecast,
    price: ratedPrice,
    name: ratedName,
    description: ratedDescription,
    recentEvents,
    isLoading,
    error,
  } = useAnalysisRating(symbol);

  return (
    <section data-ticker-rating-engine="1" className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Rating Engine</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          House scores for Financial Strength, Profitability, Growth, Valuation,
          and Price Action. Missing inputs stay blank — not zero. Not a buy
          signal.
        </p>
      </div>
      {error && !rating ? (
        <p className="text-sm text-muted-foreground">{error}</p>
      ) : (
        <AnalysisRatingSection
          rating={rating}
          symbol={symbol}
          name={ratedName ?? name}
          description={ratedDescription ?? description}
          recentEvents={recentEvents}
          forecast={forecast}
          price={ratedPrice ?? price}
          isLoading={isLoading}
          includeNarrative
        />
      )}
    </section>
  );
}
