"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DisplayCurrency, FxRates } from "@/types/currency";
import { getFxRateLabel } from "@/lib/portfolio/prices/fx";
import { cn } from "@/lib/utils";

interface CurrencyToggleProps {
  currency: DisplayCurrency;
  onChange: (currency: DisplayCurrency) => void;
  rates: FxRates;
  isLoading?: boolean;
}

export function CurrencyToggle({
  currency,
  onChange,
  rates,
  isLoading,
}: CurrencyToggleProps) {
  const rateLabel = getFxRateLabel(currency, rates);

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Tabs
        value={currency}
        onValueChange={(value) => onChange(value as DisplayCurrency)}
      >
        <TabsList className="h-10 rounded-xl border border-border/70 bg-card p-1 shadow-sm">
          {(["USD", "CAD", "INR"] as const).map((code) => (
            <TabsTrigger
              key={code}
              value={code}
              className={cn(
                "rounded-lg px-3.5 text-xs font-medium transition-all",
                "data-active:bg-muted data-active:text-foreground data-active:shadow-sm",
              )}
            >
              {code}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {currency !== "USD" && (
        <p className="text-[11px] text-muted-foreground">
          {isLoading ? "Loading FX…" : rateLabel}
        </p>
      )}
    </div>
  );
}
