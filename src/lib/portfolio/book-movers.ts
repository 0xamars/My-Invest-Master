import type { PortfolioHoldingWithPrices } from "@/types/portfolio";

export type BookMover = {
  id: string;
  symbol: string;
  name: string;
  type: PortfolioHoldingWithPrices["type"];
  change: number;
  changePercent: number;
};

export function ownedNameMovers(
  holdings: Array<
    Pick<
      PortfolioHoldingWithPrices,
      "id" | "symbol" | "name" | "type" | "quantity"
    >
  >,
  changes: Record<string, { change: number; changePercent: number }>,
  limit = 5,
): BookMover[] {
  const movers: BookMover[] = [];
  for (const holding of holdings) {
    if (holding.type === "cash") continue;
    if (holding.quantity <= 0) continue;
    const quote = changes[holding.symbol];
    if (!quote || !Number.isFinite(quote.changePercent)) continue;
    movers.push({
      id: holding.id,
      symbol: holding.symbol,
      name: holding.name,
      type: holding.type,
      change: quote.change,
      changePercent: quote.changePercent,
    });
  }
  return movers
    .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
    .slice(0, limit);
}

export function bookSymbols(
  holdings: Array<Pick<PortfolioHoldingWithPrices, "symbol" | "type" | "quantity">>,
): string[] {
  const symbols = new Set<string>();
  for (const holding of holdings) {
    if (holding.quantity <= 0) continue;
    if (holding.type !== "stock" && holding.type !== "crypto") continue;
    symbols.add(holding.symbol.toUpperCase());
  }
  return [...symbols];
}
