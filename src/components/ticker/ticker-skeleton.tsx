export function TickerSkeleton({ symbol }: { symbol: string }) {
  return (
    <div className="flex flex-1 flex-col gap-5" data-ticker-skeleton="1">
      <div className="space-y-2">
        <div className="h-3 w-24 animate-pulse rounded bg-muted/70" />
        <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-64 animate-pulse rounded bg-muted/70" />
      </div>
      <div className="budget-panel px-5 py-5 sm:px-6 sm:py-6">
        <p className="budget-metric-label">{symbol}</p>
        <p className="mt-3 text-sm text-muted-foreground">
          Loading Financial Modeling Prep…
        </p>
        <div className="mt-4 h-10 w-48 animate-pulse rounded-md bg-white/10" />
      </div>
      <div className="budget-panel h-56 animate-pulse bg-muted/20" />
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="budget-panel h-28 animate-pulse bg-muted/30"
          />
        ))}
      </div>
    </div>
  );
}
