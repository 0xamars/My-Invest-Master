"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { resolveHoldingSector } from "@/lib/portfolio/sectors";
import { importLegacyLocalDataOnce } from "@/lib/portfolio/legacy-import";
import {
  loadPortfolioFromCloud,
  savePortfolioToCloud,
} from "@/lib/supabase/user-data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  createTransaction,
  migrateHoldingToTransactions,
  syncHoldingFromTransactions,
  validateTransactionQuantity,
} from "@/lib/portfolio/transactions";
import type {
  AddTransactionInput,
  PortfolioHolding,
  UpdateHoldingInput,
} from "@/types/portfolio";
import { getCashCurrency } from "@/types/portfolio";

const SAVE_DEBOUNCE_MS = 500;

function processHoldings(raw: PortfolioHolding[]): PortfolioHolding[] {
  return raw.map((holding) => {
    try {
      return migrateHoldingToTransactions({
        ...holding,
        symbol: holding.symbol.toUpperCase(),
        sector: resolveHoldingSector(holding),
        cashCurrency:
          holding.type === "cash"
            ? (holding.cashCurrency ?? "USD")
            : holding.cashCurrency,
      });
    } catch {
      return holding;
    }
  });
}

function isSameCashHolding(
  holding: PortfolioHolding,
  input: AddTransactionInput,
): boolean {
  return (
    holding.type === "cash" &&
    input.asset.type === "cash" &&
    getCashCurrency(holding) === (input.cashCurrency ?? "USD")
  );
}

function findMatchingHolding(
  holdings: PortfolioHolding[],
  input: AddTransactionInput,
): PortfolioHolding | undefined {
  const symbol = input.asset.symbol.toUpperCase();

  return holdings.find((holding) => {
    if (holding.type === "cash" && input.asset.type === "cash") {
      return isSameCashHolding(holding, input);
    }
    return holding.symbol === symbol && holding.type === input.asset.type;
  });
}

function appendTransaction(
  holding: PortfolioHolding,
  input: AddTransactionInput,
): PortfolioHolding {
  const pricePerUnit = holding.type === "cash" ? 1 : input.pricePerUnit;

  const next = syncHoldingFromTransactions({
    ...holding,
    transactions: [
      ...holding.transactions,
      createTransaction(
        input.type,
        input.quantity,
        pricePerUnit,
        input.date,
      ),
    ],
    logoUrl: holding.logoUrl ?? input.asset.logoUrl,
  });

  if (holding.type === "custom" && input.manualCurrentPrice !== undefined) {
    next.manualCurrentPrice = input.manualCurrentPrice;
  }

  return next;
}

export function usePortfolioStorage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const loadVersionRef = useRef(0);

  useEffect(() => {
    if (isAuthLoading) return;

    const version = ++loadVersionRef.current;
    let cancelled = false;

    async function load() {
      setIsLoaded(false);
      setSyncError(null);

      if (!user || !isSupabaseConfigured()) {
        if (!cancelled && version === loadVersionRef.current) {
          setHoldings([]);
          setIsLoaded(true);
        }
        return;
      }

      try {
        await importLegacyLocalDataOnce(user.id);
        const remote = await loadPortfolioFromCloud(user.id);
        if (!cancelled && version === loadVersionRef.current) {
          setHoldings(processHoldings(remote ?? []));
        }
      } catch (error) {
        if (!cancelled && version === loadVersionRef.current) {
          setSyncError(
            error instanceof Error
              ? error.message
              : "Failed to load portfolio from cloud.",
          );
          setHoldings([]);
        }
      } finally {
        if (!cancelled && version === loadVersionRef.current) {
          setIsLoaded(true);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [user, isAuthLoading]);

  useEffect(() => {
    if (!isLoaded || isAuthLoading || !user || !isSupabaseConfigured()) {
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        await savePortfolioToCloud(user.id, holdings);
        setSyncError(null);
      } catch (error) {
        setSyncError(
          error instanceof Error
            ? error.message
            : "Failed to save portfolio to cloud.",
        );
      }
    }, SAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [holdings, isLoaded, isAuthLoading, user]);

  const addTransaction = useCallback((input: AddTransactionInput) => {
    setHoldings((prev) => {
      const symbol = input.asset.symbol.toUpperCase();
      const existing = findMatchingHolding(prev, input);
      const quantityError = validateTransactionQuantity(
        existing,
        input.type,
        input.quantity,
      );

      if (quantityError) {
        console.warn(quantityError);
        return prev;
      }

      if (existing) {
        return prev.map((holding) => {
          if (holding.type === "cash" && input.asset.type === "cash") {
            return isSameCashHolding(holding, input)
              ? appendTransaction(holding, input)
              : holding;
          }
          return holding.symbol === symbol && holding.type === input.asset.type
            ? appendTransaction(holding, input)
            : holding;
        });
      }

      if (input.type === "sell") {
        console.warn("Cannot sell an asset that is not in the portfolio.");
        return prev;
      }

      if (!input.sector) {
        console.warn("Sector is required when adding a new holding.");
        return prev;
      }

      const cashCurrency = input.cashCurrency ?? "USD";
      const holding: PortfolioHolding = syncHoldingFromTransactions({
        id: crypto.randomUUID(),
        symbol,
        name:
          input.asset.type === "cash"
            ? `Cash (${cashCurrency})`
            : input.asset.name,
        type: input.asset.type,
        sector: input.sector,
        category: input.asset.category,
        subCategory: input.asset.subCategory,
        costPrice: input.asset.type === "cash" ? 1 : input.pricePerUnit,
        quantity: 0,
        addedAt: new Date(`${input.date}T12:00:00`).toISOString(),
        transactions: [],
        priceId: input.asset.priceId,
        manualCurrentPrice: input.manualCurrentPrice,
        logoUrl: input.asset.logoUrl,
        cashCurrency:
          input.asset.type === "cash" ? cashCurrency : undefined,
      });

      return [...prev, appendTransaction(holding, input)];
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

        if (holding.type === "cash" && input.cashCurrency !== undefined) {
          updated.cashCurrency = input.cashCurrency;
          updated.name = `Cash (${input.cashCurrency})`;
        }

        if (holding.type === "custom" && input.manualCurrentPrice !== undefined) {
          updated.manualCurrentPrice = input.manualCurrentPrice;
        }

        if (input.sector !== undefined) {
          updated.sector = input.sector;
        }

        return updated;
      }),
    );
  }, []);

  return {
    holdings,
    addTransaction,
    updateHolding,
    removeHolding,
    isLoaded,
    syncError,
    isCloudSynced: Boolean(user && isSupabaseConfigured()),
  };
}
