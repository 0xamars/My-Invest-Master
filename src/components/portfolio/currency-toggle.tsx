"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DisplayCurrency, FxRates } from "@/types/currency";
import { getFxRateLabel } from "@/lib/portfolio/prices/fx";

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
    <div className="flex flex-col items-end gap-1">
      <Tabs
        value={currency}
        onValueChange={(value) => onChange(value as DisplayCurrency)}
      >
        <TabsList>
          <TabsTrigger value="USD">USD</TabsTrigger>
          <TabsTrigger value="CAD">CAD</TabsTrigger>
          <TabsTrigger value="INR">INR</TabsTrigger>
        </TabsList>
      </Tabs>
      {currency !== "USD" && (
        <p className="text-xs text-muted-foreground">
          {isLoading ? "Loading FX rate…" : rateLabel}
        </p>
      )}
    </div>
  );
}
