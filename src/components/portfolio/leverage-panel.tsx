"use client";

import { useState } from "react";
import { Scale } from "lucide-react";
import { LeverageUtilChip } from "@/components/invest/risk-chip";
import { RetirePanel } from "@/components/retirement/retire-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  computeLeverageUtilization,
  parseStoredLeverage,
  type PortfolioLeverage,
} from "@/lib/portfolio/leverage";
import { formatDisplayMoney } from "@/lib/portfolio/format";

function optionalNumberToInput(value: number | null): string {
  return value == null ? "" : String(value);
}

function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

export function LeveragePanel({
  leverage,
  cashValue,
  currency,
  rates,
  onSave,
}: {
  leverage: PortfolioLeverage | undefined;
  cashValue: number;
  currency: Parameters<typeof formatDisplayMoney>[1];
  rates: Parameters<typeof formatDisplayMoney>[2];
  onSave: (next: PortfolioLeverage) => void;
}) {
  const stored = parseStoredLeverage(leverage);
  const [draft, setDraft] = useState({
    broker: stored.broker ?? "",
    marginUsed: optionalNumberToInput(stored.marginUsed),
    equity: optionalNumberToInput(stored.equity),
    buyingPower: optionalNumberToInput(stored.buyingPower),
  });
  const [saved, setSaved] = useState(false);

  const preview = computeLeverageUtilization({
    marginUsed: parseOptionalNumber(draft.marginUsed),
    equity: parseOptionalNumber(draft.equity),
    cashValue,
  });

  return (
    <RetirePanel>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
        <div className="flex min-w-0 items-start gap-2">
          <Scale className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <h2 className="text-sm font-semibold">Leverage / margin</h2>
            <p className="text-xs text-muted-foreground">
              Type figures from IBKR or Wealthsimple. Utilization is margin used
              ÷ (margin used + equity, or book cash if equity is blank). 50%
              caution, 70% high. No broker sync.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LeverageUtilChip flag={preview.flag} />
          <Button
            size="sm"
            onClick={() => {
              onSave(
                parseStoredLeverage({
                  broker: draft.broker,
                  marginUsed: parseOptionalNumber(draft.marginUsed),
                  equity: parseOptionalNumber(draft.equity),
                  buyingPower: parseOptionalNumber(draft.buyingPower),
                }),
              );
              setSaved(true);
            }}
          >
            {saved ? "Saved" : "Save"}
          </Button>
        </div>
      </div>
      <div className="grid gap-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1.5 text-xs text-muted-foreground">
          Broker
          <Input
            value={draft.broker}
            placeholder="IBKR"
            onChange={(event) => {
              setDraft((prev) => ({ ...prev, broker: event.target.value }));
              setSaved(false);
            }}
          />
        </label>
        <label className="space-y-1.5 text-xs text-muted-foreground">
          Margin used
          <Input
            type="number"
            min={0}
            step="0.01"
            value={draft.marginUsed}
            placeholder="—"
            onChange={(event) => {
              setDraft((prev) => ({ ...prev, marginUsed: event.target.value }));
              setSaved(false);
            }}
          />
        </label>
        <label className="space-y-1.5 text-xs text-muted-foreground">
          Equity / net liq.
          <Input
            type="number"
            min={0}
            step="0.01"
            value={draft.equity}
            placeholder="—"
            onChange={(event) => {
              setDraft((prev) => ({ ...prev, equity: event.target.value }));
              setSaved(false);
            }}
          />
        </label>
        <label className="space-y-1.5 text-xs text-muted-foreground">
          Buying power
          <Input
            type="number"
            min={0}
            step="0.01"
            value={draft.buyingPower}
            placeholder="—"
            onChange={(event) => {
              setDraft((prev) => ({
                ...prev,
                buyingPower: event.target.value,
              }));
              setSaved(false);
            }}
          />
        </label>
      </div>
      <div className="border-t border-border/60 px-5 py-3 text-xs text-muted-foreground">
        {preview.utilizationPercent == null ? (
          "Add margin used and equity (or hold cash in the book) to see utilization."
        ) : (
          <>
            {preview.utilizationPercent.toFixed(1)}% utilized
            {preview.cushionSource === "equity"
              ? " vs typed equity"
              : " vs cash in the book"}
            {preview.cushion != null
              ? ` · cushion ${formatDisplayMoney(preview.cushion, currency, rates)}`
              : ""}
            . Flags only — no auto-trades.
          </>
        )}
      </div>
    </RetirePanel>
  );
}
