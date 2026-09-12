"use client";

import { Loader2 } from "lucide-react";
import { CurrencyToggle } from "@/components/portfolio/currency-toggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useDisplayCurrency } from "@/hooks/use-display-currency";
import { useFxRate } from "@/hooks/use-fx-rate";

export function DisplayCurrencyCard() {
  const { currency, setCurrency, isLoaded } = useDisplayCurrency();
  const { rates, isLoading, error } = useFxRate();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Display currency</CardTitle>
        <CardDescription>
          Used on Invest and Retire screens. Budget keeps the currency already
          set on that plan. Amounts are not invented.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!isLoaded ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin" />
            Loading currency…
          </p>
        ) : (
          <CurrencyToggle
            currency={currency}
            onChange={setCurrency}
            rates={rates}
            isLoading={isLoading}
            error={error}
          />
        )}
      </CardContent>
    </Card>
  );
}
