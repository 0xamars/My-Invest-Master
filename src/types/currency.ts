/**
 * Display currencies backed by Frankfurter FX (major world currencies).
 * USD is the app's storage/canonical unit; others convert at display time.
 */
export const DISPLAY_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "CAD",
  "AUD",
  "CHF",
  "CNY",
  "INR",
  "HKD",
  "SGD",
  "NZD",
  "SEK",
  "NOK",
  "DKK",
  "KRW",
  "MXN",
  "BRL",
  "ZAR",
  "TRY",
  "PLN",
  "CZK",
  "HUF",
  "ILS",
  "THB",
  "MYR",
  "PHP",
  "IDR",
  "RON",
  "ISK",
] as const;

export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

/** Pinned near the top of the currency picker for quick access. */
export const FEATURED_DISPLAY_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "CAD",
  "AUD",
  "CHF",
  "CNY",
  "INR",
] as const satisfies readonly DisplayCurrency[];

export type CurrencyMeta = {
  code: DisplayCurrency;
  name: string;
};

export const CURRENCY_META: Record<DisplayCurrency, CurrencyMeta> = {
  USD: { code: "USD", name: "US Dollar" },
  EUR: { code: "EUR", name: "Euro" },
  GBP: { code: "GBP", name: "British Pound" },
  JPY: { code: "JPY", name: "Japanese Yen" },
  CAD: { code: "CAD", name: "Canadian Dollar" },
  AUD: { code: "AUD", name: "Australian Dollar" },
  CHF: { code: "CHF", name: "Swiss Franc" },
  CNY: { code: "CNY", name: "Chinese Yuan" },
  INR: { code: "INR", name: "Indian Rupee" },
  HKD: { code: "HKD", name: "Hong Kong Dollar" },
  SGD: { code: "SGD", name: "Singapore Dollar" },
  NZD: { code: "NZD", name: "New Zealand Dollar" },
  SEK: { code: "SEK", name: "Swedish Krona" },
  NOK: { code: "NOK", name: "Norwegian Krone" },
  DKK: { code: "DKK", name: "Danish Krone" },
  KRW: { code: "KRW", name: "South Korean Won" },
  MXN: { code: "MXN", name: "Mexican Peso" },
  BRL: { code: "BRL", name: "Brazilian Real" },
  ZAR: { code: "ZAR", name: "South African Rand" },
  TRY: { code: "TRY", name: "Turkish Lira" },
  PLN: { code: "PLN", name: "Polish Złoty" },
  CZK: { code: "CZK", name: "Czech Koruna" },
  HUF: { code: "HUF", name: "Hungarian Forint" },
  ILS: { code: "ILS", name: "Israeli New Shekel" },
  THB: { code: "THB", name: "Thai Baht" },
  MYR: { code: "MYR", name: "Malaysian Ringgit" },
  PHP: { code: "PHP", name: "Philippine Peso" },
  IDR: { code: "IDR", name: "Indonesian Rupiah" },
  RON: { code: "RON", name: "Romanian Leu" },
  ISK: { code: "ISK", name: "Icelandic Króna" },
};

/**
 * Offline / API-failure fallback rates (units of currency per 1 USD).
 * Live rates from Frankfurter replace these when available.
 */
export const DEFAULT_FX_RATES: FxRates = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 150,
  CAD: 1.36,
  AUD: 1.52,
  CHF: 0.88,
  CNY: 7.25,
  INR: 83,
  HKD: 7.8,
  SGD: 1.34,
  NZD: 1.65,
  SEK: 10.5,
  NOK: 10.6,
  DKK: 6.9,
  KRW: 1350,
  MXN: 17.2,
  BRL: 5.1,
  ZAR: 18.2,
  TRY: 32.5,
  PLN: 4.0,
  CZK: 23.2,
  HUF: 360,
  ILS: 3.7,
  THB: 35.5,
  MYR: 4.7,
  PHP: 56.5,
  IDR: 15800,
  RON: 4.6,
  ISK: 138,
  fetchedAt: new Date(0).toISOString(),
};

export type FxRates = { USD: 1; fetchedAt: string } & {
  [K in Exclude<DisplayCurrency, "USD">]: number;
};

export function isDisplayCurrency(value: string): value is DisplayCurrency {
  return (DISPLAY_CURRENCIES as readonly string[]).includes(value);
}

export function parseDisplayCurrency(
  value: string | null | undefined,
  fallback: DisplayCurrency = "USD",
): DisplayCurrency {
  if (value && isDisplayCurrency(value)) return value;
  return fallback;
}

export function getCurrencyMeta(code: DisplayCurrency): CurrencyMeta {
  return CURRENCY_META[code];
}

/** Narrow symbol via Intl (e.g. $, €, ¥). Falls back to the code. */
export function getCurrencySymbol(currency: DisplayCurrency): string {
  try {
    const parts = new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    }).formatToParts(0);
    return parts.find((part) => part.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}

export function listDisplayCurrencies(): CurrencyMeta[] {
  return DISPLAY_CURRENCIES.map((code) => CURRENCY_META[code]);
}
