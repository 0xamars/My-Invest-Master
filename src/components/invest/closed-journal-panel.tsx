"use client";

import { useMemo, useState } from "react";
import { BookMarked } from "lucide-react";
import { RetirePanel } from "@/components/retirement/retire-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePortfolioPlans } from "@/contexts/portfolio-plans-context";
import { useVsSpyWindows } from "@/hooks/use-vs-spy-windows";
import {
  closedFillsFromHoldings,
  type ClosedFill,
} from "@/lib/invest/closed-fills";
import { vsSpyFactLine, type VsSpyWindow } from "@/lib/invest/vs-spy";
import { formatPercent, profitLossClass } from "@/lib/portfolio/format";
import type { PortfolioHolding } from "@/types/portfolio";

export function ClosedJournalPanel({
  portfolioId,
  holdings,
}: {
  portfolioId: string | null;
  holdings: PortfolioHolding[];
}) {
  const { updateJournalNotes } = usePortfolioPlans();
  const fills = useMemo(() => closedFillsFromHoldings(holdings), [holdings]);
  const windows = useMemo(
    () =>
      fills.map((fill) => ({
        id: fill.id,
        from: fill.entryDate,
        to: fill.exitDate,
        holdingReturnPercent: fill.returnPercent,
      })),
    [fills],
  );
  const { results } = useVsSpyWindows(windows);

  return (
    <RetirePanel>
      <div className="flex items-start gap-2 border-b border-border/60 px-5 py-4">
        <BookMarked className="mt-0.5 size-4 shrink-0 text-primary" />
        <div>
          <h2 className="text-sm font-semibold">Closed journal</h2>
          <p className="text-xs text-muted-foreground">
            Entry, exit, why, and what we skipped — for names already sold. Not
            a live book return.
          </p>
        </div>
      </div>
      {fills.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted-foreground">
          No closed fills yet. Sells stay on the book here with vs SPY for that
          window.
        </p>
      ) : (
        <ul className="divide-y divide-border/60">
          {fills.map((fill) => (
            <JournalRow
              key={fill.id}
              fill={fill}
              vsSpy={results[fill.id] ?? null}
              disabled={!portfolioId}
              onSave={(notes) => {
                if (!portfolioId) return;
                updateJournalNotes(
                  portfolioId,
                  fill.holdingId,
                  fill.sellTxId,
                  notes,
                );
              }}
            />
          ))}
        </ul>
      )}
    </RetirePanel>
  );
}

function JournalRow({
  fill,
  vsSpy,
  disabled,
  onSave,
}: {
  fill: ClosedFill;
  vsSpy: VsSpyWindow | null;
  disabled: boolean;
  onSave: (notes: { why: string; skipped: string }) => void;
}) {
  const [why, setWhy] = useState(fill.why ?? "");
  const [skipped, setSkipped] = useState(fill.skipped ?? "");
  const dirty =
    why.trim() !== (fill.why ?? "") || skipped.trim() !== (fill.skipped ?? "");

  return (
    <li className="space-y-3 px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm">
          <span className="font-medium">{fill.symbol}</span>
          <span className="text-muted-foreground">
            {" "}
            · {fill.entryDate} → {fill.exitDate} · {fill.quantity} sh
          </span>
        </p>
        {fill.returnPercent != null ? (
          <p className={`text-sm tabular-nums ${profitLossClass(fill.returnPercent)}`}>
            {formatPercent(fill.returnPercent)}
          </p>
        ) : null}
      </div>
      {vsSpy ? (
        <p className="text-xs tabular-nums text-muted-foreground">
          {vsSpyFactLine(vsSpy)}
        </p>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1 text-xs text-muted-foreground">
          Why
          <Input
            value={why}
            onChange={(event) => setWhy(event.target.value)}
            placeholder="Why this exit"
            maxLength={500}
            disabled={disabled}
          />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Skipped
          <Input
            value={skipped}
            onChange={(event) => setSkipped(event.target.value)}
            placeholder="What we skipped"
            maxLength={500}
            disabled={disabled}
          />
        </label>
      </div>
      {dirty ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onSave({ why: why.trim(), skipped: skipped.trim() })}
          disabled={disabled}
        >
          Save notes
        </Button>
      ) : null}
    </li>
  );
}
