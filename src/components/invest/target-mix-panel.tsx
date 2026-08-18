"use client";

import { useState } from "react";
import { Target } from "lucide-react";
import { RetirePanel } from "@/components/retirement/retire-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TARGET_ALLOCATION_TYPES,
  type TargetAllocation,
} from "@/lib/portfolio/allocation-targets";
import type { InvestmentCheckup } from "@/lib/portfolio/checkup";
import { formatDisplayMoney } from "@/lib/portfolio/format";
import type { AssetType } from "@/types/portfolio";

export function TargetMixPanel({
  checkup,
  currency,
  rates,
  portfolioId,
  storedTargets,
  onSave,
}: {
  checkup: InvestmentCheckup;
  currency: Parameters<typeof formatDisplayMoney>[1];
  rates: Parameters<typeof formatDisplayMoney>[2];
  portfolioId: string | null;
  storedTargets: TargetAllocation | undefined;
  onSave: (id: string, targets: TargetAllocation) => void;
}) {
  const [draft, setDraft] = useState<TargetAllocation>(
    () => storedTargets ?? checkup.targets,
  );
  const [saved, setSaved] = useState(false);

  function setType(type: AssetType, raw: string) {
    const parsed = Number(raw);
    setDraft((prev) => ({
      ...prev,
      [type]: Number.isFinite(parsed) ? parsed : 0,
    }));
    setSaved(false);
  }

  return (
    <RetirePanel>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
        <div className="flex min-w-0 items-start gap-2">
          <Target className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <h2 className="text-sm font-semibold">Target mix</h2>
            <p className="text-xs text-muted-foreground">
              {checkup.targetsAreDefault
                ? "Default 80 / 10 / 10 / 0 until you save. Trim / add is a hint — no trades."
                : "Drift vs your saved mix. No auto-trades."}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => {
            if (!portfolioId) return;
            onSave(portfolioId, draft);
            setSaved(true);
          }}
          disabled={!portfolioId}
        >
          {saved ? "Saved" : "Save targets"}
        </Button>
      </div>
      <div className="grid gap-3 px-5 py-4 sm:grid-cols-4">
        {TARGET_ALLOCATION_TYPES.map((type) => (
          <label key={type} className="space-y-1.5 text-xs text-muted-foreground">
            {type === "stock"
              ? "Stocks %"
              : type === "crypto"
                ? "Crypto %"
                : type === "cash"
                  ? "Cash %"
                  : "Custom %"}
            <Input
              type="number"
              min={0}
              max={100}
              step={1}
              value={draft[type]}
              onChange={(event) => setType(type, event.target.value)}
            />
          </label>
        ))}
      </div>
      <div className="divide-y divide-border/60 border-t border-border/60">
        {checkup.drift.map((row) => (
          <div
            key={row.type}
            className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm"
          >
            <div>
              <p className="font-medium">{row.label}</p>
              <p className="text-xs text-muted-foreground">
                {row.actualPercent.toFixed(1)}% now · {row.targetPercent.toFixed(1)}%
                target
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {row.action === "hold" ? (
                "On target"
              ) : row.action === "trim" ? (
                <>
                  Trim{" "}
                  <span className="font-medium text-[var(--brand-orange)]">
                    {formatDisplayMoney(Math.abs(row.dollarDelta), currency, rates)}
                  </span>
                </>
              ) : (
                <>
                  Add{" "}
                  <span className="font-medium text-[var(--brand-green)]">
                    {formatDisplayMoney(Math.abs(row.dollarDelta), currency, rates)}
                  </span>
                </>
              )}
            </p>
          </div>
        ))}
      </div>
    </RetirePanel>
  );
}
