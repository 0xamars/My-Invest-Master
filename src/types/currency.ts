export const DISPLAY_CURRENCIES = ["USD", "CAD", "INR"] as const;

export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

export interface FxRates {
  USD: 1;
  CAD: number;
  INR: number;
  fetchedAt: string;
}

export function isDisplayCurrency(value: string): value is DisplayCurrency {
  return DISPLAY_CURRENCIES.includes(value as DisplayCurrency);
}

export const DEFAULT_FX_RATES: FxRates = {
  USD: 1,
  CAD: 1.36,
  INR: 83,
  fetchedAt: new Date().toISOString(),
};
