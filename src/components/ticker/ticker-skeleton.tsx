export function TickerSkeleton({ symbol }: { symbol: string }) {
  return (
    <div className="flex flex-1 flex-col gap-5" data-ticker-skeleton="1">
      <div>
        <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
        <p className="page-description mt-2">{symbol}</p>
        <p className="mt-4 text-sm text-muted-foreground">
          Loading Financial Modeling Prep…
        </p>
        <div className="mt-3 h-10 w-40 animate-pulse rounded-md bg-muted/70" />
      </div>
    </div>
  );
}
