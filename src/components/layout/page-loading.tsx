const DEFAULT_CARDS = ["Watchlist", "Holdings", "Analysis"];

export function PageLoading({
  label,
  layout = "stack",
  cards = DEFAULT_CARDS,
}: {
  label: string;
  layout?: "stack" | "cards";
  cards?: string[];
}) {
  const title = label.replace(/…$/, "");

  return (
    <div className="flex flex-1 flex-col gap-3" role="status" aria-live="polite">
      <div>
        <p className="text-base font-semibold tracking-tight">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Still loading. No figures yet.
        </p>
      </div>
      {layout === "cards" ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {cards.map((name) => (
            <div key={name} className="budget-panel px-4 py-3.5">
              <p className="text-xs font-semibold">{name}</p>
              <div className="desk-skeleton mt-3 w-3/5" />
              <div className="desk-skeleton mt-2 w-2/5" />
            </div>
          ))}
        </div>
      ) : (
        <div className="budget-panel space-y-2.5 px-4 py-4">
          <div className="desk-skeleton w-1/3" />
          <div className="desk-skeleton w-full" />
          <div className="desk-skeleton w-11/12" />
          <div className="desk-skeleton w-4/5" />
        </div>
      )}
    </div>
  );
}

export function InvestShelf() {
  return (
    <div className="grid gap-3 sm:grid-cols-3" aria-label="Invest sections">
      {DEFAULT_CARDS.map((name) => (
        <div key={name} className="budget-panel px-4 py-3.5">
          <p className="text-xs font-semibold">{name}</p>
          <p className="mt-1 text-xs text-muted-foreground">Empty until you add a name.</p>
          <div className="desk-skeleton mt-3 w-3/5" aria-hidden />
          <div className="desk-skeleton mt-2 w-2/5" aria-hidden />
        </div>
      ))}
    </div>
  );
}
