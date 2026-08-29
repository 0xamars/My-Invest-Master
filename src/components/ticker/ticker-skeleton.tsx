export function TickerSkeleton({ symbol }: { symbol: string }) {
  return (
    <div className="flex flex-1 flex-col gap-5" data-ticker-skeleton="1">
      <div className="space-y-2">
        <div className="h-3 w-24 animate-pulse rounded bg-muted/70" />
        <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-64 animate-pulse rounded bg-muted/70" />
      </div>
      <div className="budget-hero px-5 py-5 sm:px-7 sm:py-6">
        <p className="text-xs text-muted-foreground">{symbol}</p>
        <p className="mt-3 text-sm text-muted-foreground">
          Loading Financial Modeling Prep…
        </p>
        <div className="mt-4 h-10 w-48 animate-pulse rounded-md bg-white/10" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="budget-panel h-20 animate-pulse bg-muted/30"
          />
        ))}
      </div>
      <div className="budget-panel h-48 animate-pulse bg-muted/20" />
    </div>
  );
}
