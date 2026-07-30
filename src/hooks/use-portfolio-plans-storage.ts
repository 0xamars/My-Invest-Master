"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useUserPlan } from "@/hooks/use-user-preferences";
import {
  hasLegacyPortfolioData,
  importLegacyLocalDataOnce,
  clearStaleLegacyPortfolioKeys,
} from "@/lib/portfolio/legacy-import";
import { resolveHoldingSector } from "@/lib/portfolio/sectors";
import {
  canCreateLimitedResource,
  PlanLimitError,
  resolvePlanForCreateGate,
} from "@/lib/plans/access";
import {
  deletePortfolioPlanFromCloud,
  loadOrMigratePortfolioPlans,
  savePortfolioPlanToCloud,
} from "@/lib/supabase/user-data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  createTransaction,
  migrateHoldingToTransactions,
  syncHoldingFromTransactions,
  validateTransactionQuantity,
} from "@/lib/portfolio/transactions";
import {
  createEmptyPortfolio,
  getCashCurrency,
  toPortfolioSummary,
  type AddTransactionInput,
  type PortfolioHolding,
  type UpdateHoldingInput,
  type UserPortfolio,
} from "@/types/portfolio";

const SAVE_DEBOUNCE_MS = 500;
const ACTIVE_PORTFOLIO_KEY = "investsalsa-active-portfolio-id";

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

function normalizeLoadedPortfolios(
  portfolios: UserPortfolio[],
): UserPortfolio[] {
  return portfolios.map((portfolio) => ({
    ...portfolio,
    holdings: processHoldings(portfolio.holdings),
  }));
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

function readStoredActiveId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ACTIVE_PORTFOLIO_KEY);
  } catch {
    return null;
  }
}

function writeStoredActiveId(id: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ACTIVE_PORTFOLIO_KEY, id);
  } catch {
    // ignore quota / private mode
  }
}

function resolveActiveId(
  portfolios: UserPortfolio[],
  preferredId: string | null,
): string | null {
  if (portfolios.length === 0) return null;
  if (preferredId && portfolios.some((p) => p.id === preferredId)) {
    return preferredId;
  }
  const primary = portfolios.find((p) => p.isPrimary);
  return primary?.id ?? portfolios[0].id;
}

function withUpdatedHoldings(
  portfolio: UserPortfolio,
  holdings: PortfolioHolding[],
): UserPortfolio {
  return {
    ...portfolio,
    holdings,
    updatedAt: new Date().toISOString(),
  };
}

export function usePortfolioPlansStorage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { plan: userPlan, prefsLoadSucceeded, isLoaded: isPlanLoaded } =
    useUserPlan();
  const [portfolios, setPortfolios] = useState<UserPortfolio[]>([]);
  const [activePortfolioId, setActivePortfolioIdState] = useState<string | null>(
    null,
  );
  const [isLoaded, setIsLoaded] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const loadVersionRef = useRef(0);
  const pendingSaveRef = useRef<Map<string, UserPortfolio>>(new Map());
  const hasCompletedInitialLoadRef = useRef(false);
  const userMutatedRef = useRef(false);
  const activePortfolioIdRef = useRef<string | null>(null);
  activePortfolioIdRef.current = activePortfolioId;

  const setActivePortfolioId = useCallback((id: string) => {
    setActivePortfolioIdState(id);
    writeStoredActiveId(id);
  }, []);

  const loadFromCloud = useCallback(async () => {
    if (!user || !isSupabaseConfigured()) {
      setPortfolios([]);
      setActivePortfolioIdState(null);
      setIsLoaded(true);
      hasCompletedInitialLoadRef.current = true;
      return;
    }

    const version = ++loadVersionRef.current;
    setIsLoaded(false);
    setSyncError(null);

    try {
      await importLegacyLocalDataOnce(user.id);
      const remote = await loadOrMigratePortfolioPlans(user.id);
      if (version !== loadVersionRef.current) return;

      // Cloud load succeeded — discard any leftover single-portfolio browser keys
      // so the restore banner cannot stick incorrectly.
      clearStaleLegacyPortfolioKeys();

      // Never auto-delete portfolios on load. Free max-1 is enforced at create.
      const normalized = normalizeLoadedPortfolios(remote);
      const nextActive = resolveActiveId(normalized, readStoredActiveId());

      setPortfolios(normalized);
      setActivePortfolioIdState(nextActive);
      if (nextActive) writeStoredActiveId(nextActive);
      hasCompletedInitialLoadRef.current = true;
      userMutatedRef.current = false;
    } catch (error) {
      if (version !== loadVersionRef.current) return;

      setSyncError(
        error instanceof Error
          ? error.message
          : "Failed to load portfolios from cloud.",
      );
      setPortfolios([]);
      setActivePortfolioIdState(null);
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

    if (pendingSaveRef.current.size === 0) return;

    const timer = window.setTimeout(async () => {
      const toSave = new Map(pendingSaveRef.current);
      pendingSaveRef.current.clear();

      for (const portfolio of toSave.values()) {
        try {
          await savePortfolioPlanToCloud(user.id, portfolio);
          setSyncError(null);
        } catch (error) {
          setSyncError(
            error instanceof Error
              ? error.message
              : "Failed to save portfolio.",
          );
        }
      }
    }, SAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [portfolios, isLoaded, isAuthLoading, user]);

  const queueSave = useCallback((portfolio: UserPortfolio) => {
    pendingSaveRef.current.set(portfolio.id, portfolio);
  }, []);

  const updateActiveHoldings = useCallback(
    (updater: (holdings: PortfolioHolding[]) => PortfolioHolding[]) => {
      const activeId = activePortfolioIdRef.current;
      if (!activeId) return;

      userMutatedRef.current = true;
      setPortfolios((prev) => {
        const index = prev.findIndex((portfolio) => portfolio.id === activeId);
        if (index === -1) return prev;

        const current = prev[index];
        const nextHoldings = updater(current.holdings);
        const updated = withUpdatedHoldings(current, nextHoldings);
        const next = [...prev];
        next[index] = updated;
        queueSave(updated);
        return next;
      });
    },
    [queueSave],
  );

  const addTransaction = useCallback(
    (input: AddTransactionInput) => {
      updateActiveHoldings((prev) => {
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
    },
    [updateActiveHoldings],
  );

  const removeHolding = useCallback(
    (id: string) => {
      updateActiveHoldings((prev) => prev.filter((h) => h.id !== id));
    },
    [updateActiveHoldings],
  );

  const updateHolding = useCallback(
    (id: string, input: UpdateHoldingInput) => {
      updateActiveHoldings((prev) =>
        prev.map((holding) => {
          if (holding.id !== id) return holding;

          const updated: PortfolioHolding = { ...holding, ...input };

          if (holding.type === "cash" && input.cashCurrency !== undefined) {
            updated.cashCurrency = input.cashCurrency;
            updated.name = `Cash (${input.cashCurrency})`;
          }

          if (
            holding.type === "custom" &&
            input.manualCurrentPrice !== undefined
          ) {
            updated.manualCurrentPrice = input.manualCurrentPrice;
          }

          if (input.sector !== undefined) {
            updated.sector = input.sector;
          }

          return updated;
        }),
      );
    },
    [updateActiveHoldings],
  );

  const createPortfolio = useCallback(
    async (name: string): Promise<UserPortfolio> => {
      const trimmed = name.trim();
      if (!trimmed) {
        throw new Error("Portfolio name is required.");
      }

      // Fail safe: wait for prefs; if load failed, treat as Free for creates only.
      const effectivePlan = resolvePlanForCreateGate(userPlan, {
        isPlanLoaded,
        prefsLoadSucceeded,
      });
      if (!effectivePlan) {
        throw new Error(
          "Plan preferences are still loading. Try again in a moment.",
        );
      }

      if (
        !canCreateLimitedResource(effectivePlan, "portfolio", portfolios.length)
      ) {
        throw new PlanLimitError("portfolio");
      }

      const portfolio = createEmptyPortfolio(trimmed, {
        isPrimary: portfolios.length === 0,
      });

      setPortfolios((prev) => [portfolio, ...prev]);
      setActivePortfolioId(portfolio.id);
      queueSave(portfolio);

      if (user && isSupabaseConfigured()) {
        try {
          await savePortfolioPlanToCloud(user.id, portfolio);
          setSyncError(null);
        } catch (error) {
          setSyncError(
            error instanceof Error
              ? error.message
              : "Failed to save portfolio.",
          );
        }
      }

      return portfolio;
    },
    [user, userPlan, isPlanLoaded, prefsLoadSucceeded, portfolios.length, queueSave, setActivePortfolioId],
  );

  const renamePortfolio = useCallback(
    (id: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;

      setPortfolios((prev) => {
        const index = prev.findIndex((portfolio) => portfolio.id === id);
        if (index === -1) return prev;

        const updated: UserPortfolio = {
          ...prev[index],
          name: trimmed,
          updatedAt: new Date().toISOString(),
        };
        const next = [...prev];
        next[index] = updated;
        queueSave(updated);
        return next;
      });
    },
    [queueSave],
  );

  const setPrimaryPortfolio = useCallback(
    (id: string) => {
      setPortfolios((prev) => {
        if (!prev.some((portfolio) => portfolio.id === id)) return prev;

        const next = prev.map((portfolio) => {
          const updated: UserPortfolio = {
            ...portfolio,
            isPrimary: portfolio.id === id,
            updatedAt:
              portfolio.id === id || portfolio.isPrimary
                ? new Date().toISOString()
                : portfolio.updatedAt,
          };
          if (updated.isPrimary !== portfolio.isPrimary) {
            queueSave(updated);
          }
          return updated;
        });
        return next;
      });
    },
    [queueSave],
  );

  const deletePortfolio = useCallback(
    async (id: string) => {
      if (portfolios.length <= 1) {
        throw new Error("You must keep at least one portfolio.");
      }

      const remaining = portfolios.filter((portfolio) => portfolio.id !== id);
      if (remaining.length === 0) {
        throw new Error("You must keep at least one portfolio.");
      }

      const deleted = portfolios.find((portfolio) => portfolio.id === id);
      let next = remaining;

      if (deleted?.isPrimary) {
        const [first, ...rest] = remaining;
        const promoted: UserPortfolio = {
          ...first,
          isPrimary: true,
          updatedAt: new Date().toISOString(),
        };
        next = [promoted, ...rest];
        queueSave(promoted);
      }

      setPortfolios(next);
      pendingSaveRef.current.delete(id);

      if (activePortfolioIdRef.current === id) {
        const nextActive = resolveActiveId(next, null);
        if (nextActive) setActivePortfolioId(nextActive);
      }

      if (!user || !isSupabaseConfigured()) return;

      try {
        await deletePortfolioPlanFromCloud(id);
        setSyncError(null);
      } catch (error) {
        setSyncError(
          error instanceof Error
            ? error.message
            : "Failed to delete portfolio.",
        );
      }
    },
    [portfolios, queueSave, setActivePortfolioId, user],
  );

  const activePortfolio =
    portfolios.find((portfolio) => portfolio.id === activePortfolioId) ??
    null;

  const primaryPortfolio =
    portfolios.find((portfolio) => portfolio.isPrimary) ??
    portfolios[0] ??
    null;

  const holdings = activePortfolio?.holdings ?? [];

  const summaries = portfolios.map(toPortfolioSummary);

  return {
    portfolios,
    summaries,
    activePortfolio,
    activePortfolioId,
    primaryPortfolio,
    setActivePortfolioId,
    holdings,
    addTransaction,
    updateHolding,
    removeHolding,
    createPortfolio,
    renamePortfolio,
    setPrimaryPortfolio,
    deletePortfolio,
    isLoaded,
    syncError,
    isCloudSynced: Boolean(user && isSupabaseConfigured()),
    hasLegacyPortfolioBackup: hasLegacyPortfolioData(),
    reloadFromCloud: loadFromCloud,
    importLegacyPortfolio: loadFromCloud,
  };
}
