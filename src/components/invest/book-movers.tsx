"use client";

import { ownedNameMovers, type BookMover } from "@/lib/portfolio/book-movers";
import { formatPercent, profitLossClass } from "@/lib/portfolio/format";
import { cn } from "@/lib/utils";
import type { PortfolioHoldingWithPrices } from "@/types/portfolio";

export function BookMovers({
  holdings,
  changes,
  onSelect,
}: {
  holdings: PortfolioHoldingWithPrices[];
  changes: Record<string, { change: number; changePercent: number }>;
  onSelect?: (holdingId: string) => void;
}) {
  const movers = ownedNameMovers(holdings, changes, 5);
  if (movers.length === 0) return null;

  return (
    <div>
      <p className="budget-metric-label">Owned movers</p>
      <ul className="mt-2 divide-y divide-border/60">
        {movers.map((mover) => (
          <MoverRow key={mover.id} mover={mover} onSelect={onSelect} />
        ))}
      </ul>
    </div>
  );
}

function MoverRow({
  mover,
  onSelect,
}: {
  mover: BookMover;
  onSelect?: (holdingId: string) => void;
}) {
  const body = (
    <>
      <span className="font-medium">{mover.symbol}</span>
      <span className={cn("tabular-nums", profitLossClass(mover.changePercent))}>
        {formatPercent(mover.changePercent)}
      </span>
    </>
  );

  if (!onSelect) {
    return <li className="flex items-center justify-between py-1.5 text-sm">{body}</li>;
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(mover.id)}
        className="flex w-full items-center justify-between py-1.5 text-sm hover:text-foreground"
      >
        {body}
      </button>
    </li>
  );
}
