"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  hasLegacyPortfolioData,
  importLegacyPortfolioIfNeeded,
} from "@/lib/portfolio/legacy-import";
import { resolveHoldingSector } from "@/lib/portfolio/sectors";
import {
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
  const hasCompletedInitialLoadRef = useRef(false);
  const userMutatedRef = useRef(false);

  const loadFromCloud = useCallback(async () => {
    if (!user || !isSupabaseConfigured()) {
      setHoldings([]);
      setIsLoaded(true);
      return;
    }

    const version = ++loadVersionRef.current;
    setIsLoaded(false);
    setSyncError(null);

    try {
      const remote = await importLegacyPortfolioIfNeeded(user.id);
      if (version !== loadVersionRef.current) return;

      setHoldings(processHoldings(remote ?? []));
      hasCompletedInitialLoadRef.current = true;
    } catch (error) {
      if (version !== loadVersionRef.current) return;

      setSyncError(
        error instanceof Error
          ? error.message
          : "Failed to load portfolio from cloud.",
      );
      setHoldings([]);
      hasCompletedInitialLoadRef.current = true;
    } finally {
      if (version === loadVersionRef.current) {
        setIsLoaded(true);
      }
    }
  }, [user]);

  useEffect(() => {
    if (isAuthLoading) return;

    hasCompletedInitialLoadRef.current = false;
    userMutatedRef.current = false;
    void loadFromCloud();
  }, [isAuthLoading, loadFromCloud]);

  useEffect(() => {
    if (
      !isLoaded ||
      isAuthLoading ||
      !user ||
      !isSupabaseConfigured() ||
      !hasCompletedInitialLoadRef.current
    ) {
      return;
    }

    if (holdings.length === 0 && !userMutatedRef.current) {
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

  const markMutated = useCallback(() => {
    userMutatedRef.current = true;
  }, []);

  const addTransaction = useCallback((input: AddTransactionInput) => {
    markMutated();
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
  }, [markMutated]);

  const removeHolding = useCallback((id: string) => {
    markMutated();
    setHoldings((prev) => prev.filter((h) => h.id !== id));
  }, [markMutated]);

  const updateHolding = useCallback((id: string, input: UpdateHoldingInput) => {
    markMutated();
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
  }, [markMutated]);

  const importLegacyPortfolio = useCallback(async () => {
    if (!user) return;
    userMutatedRef.current = false;
    hasCompletedInitialLoadRef.current = false;
    await loadFromCloud();
  }, [loadFromCloud, user]);

  return {
    holdings,
    addTransaction,
    updateHolding,
    removeHolding,
    isLoaded,
    syncError,
    isCloudSynced: Boolean(user && isSupabaseConfigured()),
    hasLegacyPortfolioBackup: hasLegacyPortfolioData(),
    reloadFromCloud: loadFromCloud,
    importLegacyPortfolio,
  };
}
