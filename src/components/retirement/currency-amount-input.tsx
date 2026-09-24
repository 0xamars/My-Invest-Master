"use client";

import { useState } from "react";
import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { convertFromUsd, convertToUsd } from "@/lib/portfolio/prices/fx";
import type { DisplayCurrency, FxRates } from "@/types/currency";

function displayFromUsd(
  usd: number,
  currency: DisplayCurrency,
  rates: FxRates,
  digits: number,
): string {
  const value = convertFromUsd(usd, currency, rates);
  if (!Number.isFinite(value)) return "";
  const factor = 10 ** digits;
  const rounded = Math.round(value * factor) / factor;
  return String(rounded);
}

/**
 * Plan amounts are stored in USD and shown in the plan currency.
 * The draft keeps the typed text so FX rounding does not fight the caret.
 * Pass `allowEmpty` when a blank field must stay unset instead of becoming 0.
 */
export function CurrencyAmountInput({
  usdValue,
  currency,
  rates,
  onUsdChange,
  fractionDigits = 0,
  allowEmpty = false,
  onFocus,
  onBlur,
  ...props
}: {
  usdValue: number | null;
  currency: DisplayCurrency;
  rates: FxRates;
  onUsdChange: (usd: number | null) => void;
  fractionDigits?: number;
  allowEmpty?: boolean;
} & Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type">) {
  const formatted =
    usdValue == null
      ? ""
      : displayFromUsd(usdValue, currency, rates, fractionDigits);
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <Input
      {...props}
      type="number"
      inputMode="decimal"
      value={draft ?? formatted}
      onFocus={(event) => {
        setDraft(formatted);
        onFocus?.(event);
      }}
      onChange={(event) => {
        const raw = event.target.value;
        setDraft(raw);
        if (raw.trim() === "" || raw === "-" || raw === "." || raw === "-.") {
          return;
        }
        const next = Number(raw);
        if (!Number.isFinite(next)) return;
        onUsdChange(convertToUsd(next, currency, rates));
      }}
      onBlur={(event) => {
        if (draft != null && draft.trim() === "") {
          onUsdChange(allowEmpty ? null : 0);
        }
        setDraft(null);
        onBlur?.(event);
      }}
    />
  );
}
