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

function holdingMatchKey(symbol: string, type: string): string {
  return `${symbol.trim().toUpperCase()}::${type}`;
}

/**
 * Update qty/price for assets that match portfolio holdings by symbol.
 * Keeps custom CAGR and unmatched (including custom) assets. Does not add
 * new holdings or write back to Invest.
 */
export function refreshAssetsFromPortfolio(
  existing: RetirementPlanAsset[],
  holdings: PortfolioHolding[],
  livePrices: Record<string, number>,
): RetirementPlanAsset[] {
  const bySymbolType = new Map<string, PortfolioHolding>();
  const bySymbol = new Map<string, PortfolioHolding[]>();

  for (const holding of holdings) {
    bySymbolType.set(holdingMatchKey(holding.symbol, holding.type), holding);
    const symbolKey = holding.symbol.trim().toUpperCase();
    const list = bySymbol.get(symbolKey) ?? [];
    list.push(holding);
    bySymbol.set(symbolKey, list);
  }

  return existing.map((asset) => {
    const exact = bySymbolType.get(holdingMatchKey(asset.symbol, asset.type));
    const symbolMatches = bySymbol.get(asset.symbol.trim().toUpperCase()) ?? [];
    const holding = exact ?? (symbolMatches.length === 1 ? symbolMatches[0] : undefined);
    if (!holding) return asset;

    return {
      ...asset,
      name: holding.name || asset.name,
      priceId: holding.priceId ?? asset.priceId,
      logoUrl: holding.logoUrl ?? asset.logoUrl,
      quantity: holding.quantity,
      unitPrice: resolveHoldingUnitPrice(holding, livePrices),
    };
  });
}
