"use client";

import { useCallback, useEffect, useState } from "react";
import type { AddAssetInput, PortfolioHolding, UpdateHoldingInput } from "@/types/portfolio";
import { getCashCurrency } from "@/types/portfolio";
import type { DisplayCurrency } from "@/types/currency";

const STORAGE_KEY = "my-invest-master-portfolio";

function loadHoldings(): PortfolioHolding[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as PortfolioHolding[]) : [];
    return parsed.map((holding) => ({
      ...holding,
      symbol: holding.symbol.toUpperCase(),
      cashCurrency:
        holding.type === "cash"
          ? (holding.cashCurrency ?? "USD")
          : holding.cashCurrency,
    }));
  } catch {
    return [];
  }
}

function saveHoldings(holdings: PortfolioHolding[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings));
}

function isSameCashHolding(a: PortfolioHolding, b: AddAssetInput): boolean {
  return (
    a.type === "cash" &&
    b.asset.type === "cash" &&
    getCashCurrency(a) === (b.cashCurrency ?? "USD")
  );
}

function mergeHoldings(
  existing: PortfolioHolding,
  input: AddAssetInput,
): PortfolioHolding {
  const totalQty = existing.quantity + input.quantity;
  const weightedCost =
    (existing.costPrice * existing.quantity +
      input.costPrice * input.quantity) /
    totalQty;

  const merged: PortfolioHolding = {
    ...existing,
    quantity: totalQty,
    costPrice: weightedCost,
    logoUrl: existing.logoUrl ?? input.asset.logoUrl,
  };

  if (existing.type === "custom" && input.manualCurrentPrice !== undefined) {
    const existingManual =
      existing.manualCurrentPrice ?? input.manualCurrentPrice;
    merged.manualCurrentPrice =
      (existingManual * existing.quantity +
        input.manualCurrentPrice * input.quantity) /
      totalQty;
  }

  return merged;
}

export function usePortfolioStorage() {
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setHoldings(loadHoldings());
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    saveHoldings(holdings);
  }, [holdings, isLoaded]);

  const addHolding = useCallback((input: AddAssetInput) => {
    setHoldings((prev) => {
      const symbol = input.asset.symbol.toUpperCase();
      const existing = prev.find((h) => {
        if (h.type === "cash" && input.asset.type === "cash") {
          return isSameCashHolding(h, input);
        }
        return h.symbol === symbol && h.type === input.asset.type;
      });

      if (existing) {
        return prev.map((h) => {
          if (h.type === "cash" && input.asset.type === "cash") {
            return isSameCashHolding(h, input) ? mergeHoldings(h, input) : h;
          }
          return h.symbol === symbol && h.type === input.asset.type
            ? mergeHoldings(h, input)
            : h;
        });
      }

      const cashCurrency = input.cashCurrency ?? "USD";
      const holding: PortfolioHolding = {
        id: crypto.randomUUID(),
        symbol,
        name:
          input.asset.type === "cash"
            ? `Cash (${cashCurrency})`
            : input.asset.name,
        type: input.asset.type,
        category: input.asset.category,
        subCategory: input.asset.subCategory,
        costPrice: input.costPrice,
        quantity: input.quantity,
        addedAt: new Date().toISOString(),
        priceId: input.asset.priceId,
        manualCurrentPrice: input.manualCurrentPrice,
        logoUrl: input.asset.logoUrl,
        cashCurrency:
          input.asset.type === "cash" ? cashCurrency : undefined,
      };

      return [...prev, holding];
    });
  }, []);

  const removeHolding = useCallback((id: string) => {
    setHoldings((prev) => prev.filter((h) => h.id !== id));
  }, []);

  const updateHolding = useCallback((id: string, input: UpdateHoldingInput) => {
    setHoldings((prev) =>
      prev.map((holding) => {
        if (holding.id !== id) return holding;

        const updated: PortfolioHolding = { ...holding, ...input };

        if (holding.type === "cash") {
          const currency = input.cashCurrency ?? getCashCurrency(holding);
          updated.cashCurrency = currency;
          updated.name = `Cash (${currency})`;
          updated.costPrice = 1;
          if (input.quantity !== undefined) {
            updated.quantity = input.quantity;
          }
        }

        if (holding.type === "custom" && input.manualCurrentPrice !== undefined) {
          updated.manualCurrentPrice = input.manualCurrentPrice;
        }

        return updated;
      }),
    );
  }, []);

  return { holdings, addHolding, updateHolding, removeHolding, isLoaded };
}
