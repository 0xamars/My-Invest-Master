export type OptionType = "buy_call" | "sell_call" | "buy_put" | "sell_put";

export type OptionStatus = "active" | "closed" | "expired" | "exercised";

export interface OptionsPosition {
  id: string;
  ticker: string;
  name: string;
  optionType: OptionType;
  /** ISO date YYYY-MM-DD */
  txDate: string;
  /** ISO date YYYY-MM-DD */
  expiryDate: string;
  strikePrice: number;
  contracts: number;
  /** Premium per share (one contract = 100 shares) */
  premiumPerContract: number;
  /** Total premium: contracts × premium × 100 */
  cost: number;
  status: OptionStatus;
  logoUrl?: string;
  /** Realized P/L when closed early */
  realizedPl?: number;
  createdAt: string;
}

export interface OptionsPositionWithMetrics extends OptionsPosition {
  displayStatus: OptionStatus;
  currentStockPrice: number | null;
  /** Current stock price minus strike */
  priceChange: number | null;
  dte: number | null;
  unrealizedPl: number | null;
  isPriceLoading: boolean;
}

export interface AddOptionsTransactionInput {
  ticker: string;
  name: string;
  optionType: OptionType;
  txDate: string;
  expiryDate: string;
  strikePrice: number;
  contracts: number;
  premiumPerContract: number;
  logoUrl?: string;
}

export interface UpdateOptionsPositionInput {
  ticker?: string;
  name?: string;
  optionType?: OptionType;
  txDate?: string;
  expiryDate?: string;
  strikePrice?: number;
  contracts?: number;
  premiumPerContract?: number;
  cost?: number;
  logoUrl?: string;
  status?: OptionStatus;
  realizedPl?: number | null;
}

export const OPTION_TYPE_LABELS: Record<OptionType, string> = {
  buy_call: "Buy Call",
  sell_call: "Sell Call",
  buy_put: "Buy Put",
  sell_put: "Sell Put",
};

export const OPTION_STATUS_LABELS: Record<OptionStatus, string> = {
  active: "Active",
  closed: "Closed",
  expired: "Expired",
  exercised: "Exercised",
};

export function isPremiumReceived(optionType: OptionType): boolean {
  return optionType === "sell_call" || optionType === "sell_put";
}

export function calculateOptionsCost(
  contracts: number,
  premiumPerContract: number,
): number {
  return contracts * premiumPerContract * 100;
}
