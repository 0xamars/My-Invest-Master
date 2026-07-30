import type { PortfolioHolding } from "@/types/portfolio";
import {
  DEFAULT_CAGR_BY_TYPE,
  type RetirementPlanAsset,
} from "@/types/retirement";

export function portfolioHoldingToPlanAsset(
  holding: PortfolioHolding,
  unitPrice: number,
): RetirementPlanAsset {
  return {
    id: crypto.randomUUID(),
    symbol: holding.symbol,
    name: holding.name,
    type: holding.type,
    priceId: holding.priceId,
    logoUrl: holding.logoUrl,
    unitPrice,
    quantity: holding.quantity,
    expectedCagr: DEFAULT_CAGR_BY_TYPE[holding.type],
  };
}

export function resolveHoldingUnitPrice(
  holding: PortfolioHolding,
  livePrices: Record<string, number>,
): number {
  if (holding.type === "cash") return 1;
  if (holding.type === "custom") {
    return holding.manualCurrentPrice ?? holding.costPrice;
  }
  return livePrices[holding.symbol] ?? holding.costPrice;
}
