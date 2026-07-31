import type { AssetType } from "@/types/portfolio";

export type WatchlistAssetType = Extract<AssetType, "stock" | "crypto">;

export interface WatchlistItem {
  id: string;
  symbol: string;
  name: string;
  type: WatchlistAssetType;
  priceId?: string;
  logoUrl?: string;
  addedAt: string;
}

export interface WatchlistItemWithPrices extends WatchlistItem {
  currentPrice: number | null;
  change: number | null;
  changePercent: number | null;
  isPriceLoading: boolean;
}

export interface UserWatchlist {
  id: string;
  name: string;
  items: WatchlistItem[];
  createdAt: string;
  updatedAt: string;
}

export interface WatchlistSummary {
  id: string;
  name: string;
  itemCount: number;
  updatedAt: string;
}

export function createEmptyWatchlist(name: string): UserWatchlist {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: name.trim() || "Watchlist",
    items: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createWatchlistItem(
  input: Omit<WatchlistItem, "id" | "addedAt"> & { id?: string },
): WatchlistItem {
  return {
    id: input.id ?? crypto.randomUUID(),
    symbol: input.symbol.toUpperCase(),
    name: input.name,
    type: input.type,
    priceId: input.priceId,
    logoUrl: input.logoUrl,
    addedAt: new Date().toISOString(),
  };
}

export function toWatchlistSummary(list: UserWatchlist): WatchlistSummary {
  return {
    id: list.id,
    name: list.name,
    itemCount: list.items.length,
    updatedAt: list.updatedAt,
  };
}

export function isWatchlistAssetType(type: string): type is WatchlistAssetType {
  return type === "stock" || type === "crypto";
}
