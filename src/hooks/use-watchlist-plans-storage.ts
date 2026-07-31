"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useUserPlan } from "@/hooks/use-user-preferences";
import {
  canCreateLimitedResource,
  PlanLimitError,
  resolvePlanForCreateGate,
} from "@/lib/plans/access";
import {
  deleteWatchlistPlanFromCloud,
  loadWatchlistPlansFromCloud,
  saveWatchlistPlanToCloud,
} from "@/lib/supabase/user-data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  createEmptyWatchlist,
  createWatchlistItem,
  toWatchlistSummary,
  type UserWatchlist,
  type WatchlistAssetType,
  type WatchlistItem,
} from "@/types/watchlist";

const SAVE_DEBOUNCE_MS = 500;

export type AddWatchlistTickerInput = {
  symbol: string;
  name: string;
  type: WatchlistAssetType;
  priceId?: string;
  logoUrl?: string;
};

export function useWatchlistPlansStorage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const {
    plan: userPlan,
    isLoaded: isPlanLoaded,
    prefsLoadSucceeded,
  } = useUserPlan();
  const [lists, setLists] = useState<UserWatchlist[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const loadVersionRef = useRef(0);
  const pendingSaveRef = useRef<Map<string, UserWatchlist>>(new Map());

  const assertCanCreate = useCallback(() => {
    const effectivePlan = resolvePlanForCreateGate(userPlan, {
      isPlanLoaded,
      prefsLoadSucceeded,
    });
    if (!effectivePlan) {
      throw new Error(
        "Plan preferences are still loading. Try again in a moment.",
      );
    }
    if (!canCreateLimitedResource(effectivePlan, "watchlist", lists.length)) {
      throw new PlanLimitError("watchlist");
    }
  }, [userPlan, isPlanLoaded, prefsLoadSucceeded, lists.length]);

  useEffect(() => {
    if (isAuthLoading) return;

    const version = ++loadVersionRef.current;
    let cancelled = false;

    async function load() {
      setIsLoaded(false);
      setSyncError(null);

      if (!user || !isSupabaseConfigured()) {
        if (!cancelled && version === loadVersionRef.current) {
          setLists([]);
          setIsLoaded(true);
        }
        return;
      }

      try {
        const remote = await loadWatchlistPlansFromCloud(user.id);
        if (!cancelled && version === loadVersionRef.current) {
          setLists(remote);
        }
      } catch (error) {
        if (!cancelled && version === loadVersionRef.current) {
          setSyncError(
            error instanceof Error
              ? error.message
              : "Failed to load watchlists.",
          );
          setLists([]);
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

    if (pendingSaveRef.current.size === 0) return;

    const timer = window.setTimeout(async () => {
      const toSave = new Map(pendingSaveRef.current);
      pendingSaveRef.current.clear();

      for (const list of toSave.values()) {
        try {
          await saveWatchlistPlanToCloud(user.id, list);
          setSyncError(null);
        } catch (error) {
          setSyncError(
            error instanceof Error
              ? error.message
              : "Failed to save watchlist.",
          );
        }
      }
    }, SAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [lists, isLoaded, isAuthLoading, user]);

  const queueSave = useCallback((list: UserWatchlist) => {
    pendingSaveRef.current.set(list.id, list);
  }, []);

  const createWatchlistAndSave = useCallback(
    async (name: string): Promise<UserWatchlist> => {
      const trimmed = name.trim();
      if (!trimmed) {
        throw new Error("Watchlist name is required.");
      }

      assertCanCreate();

      const list = createEmptyWatchlist(trimmed);
      setLists((prev) => [list, ...prev]);

      if (user && isSupabaseConfigured()) {
        try {
          await saveWatchlistPlanToCloud(user.id, list);
          setSyncError(null);
        } catch (error) {
          setSyncError(
            error instanceof Error
              ? error.message
              : "Failed to save watchlist.",
          );
        }
      }

      return list;
    },
    [user, assertCanCreate],
  );

  const updateList = useCallback(
    (id: string, updater: (list: UserWatchlist) => UserWatchlist) => {
      setLists((prev) => {
        const index = prev.findIndex((list) => list.id === id);
        if (index === -1) return prev;

        const updated = {
          ...updater(prev[index]),
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

  const renameWatchlist = useCallback(
    (id: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      updateList(id, (list) => ({ ...list, name: trimmed }));
    },
    [updateList],
  );

  const deleteWatchlist = useCallback(
    async (id: string) => {
      setLists((prev) => prev.filter((list) => list.id !== id));
      pendingSaveRef.current.delete(id);

      if (!user || !isSupabaseConfigured()) return;

      try {
        await deleteWatchlistPlanFromCloud(id);
        setSyncError(null);
      } catch (error) {
        setSyncError(
          error instanceof Error
            ? error.message
            : "Failed to delete watchlist.",
        );
      }
    },
    [user],
  );

  const addTicker = useCallback(
    (listId: string, input: AddWatchlistTickerInput): WatchlistItem => {
      const symbol = input.symbol.toUpperCase();
      const item = createWatchlistItem({
        symbol,
        name: input.name,
        type: input.type,
        priceId: input.priceId,
        logoUrl: input.logoUrl,
      });

      updateList(listId, (list) => {
        const exists = list.items.some(
          (existing) =>
            existing.symbol === symbol && existing.type === input.type,
        );
        if (exists) return list;
        return { ...list, items: [...list.items, item] };
      });

      return item;
    },
    [updateList],
  );

  const removeTicker = useCallback(
    (listId: string, itemId: string) => {
      updateList(listId, (list) => ({
        ...list,
        items: list.items.filter((item) => item.id !== itemId),
      }));
    },
    [updateList],
  );

  const getWatchlist = useCallback(
    (id: string) => lists.find((list) => list.id === id),
    [lists],
  );

  const summaries = lists.map(toWatchlistSummary);

  return {
    lists,
    summaries,
    createWatchlistAndSave,
    renameWatchlist,
    deleteWatchlist,
    addTicker,
    removeTicker,
    getWatchlist,
    isLoaded,
    syncError,
    isCloudSynced: Boolean(user && isSupabaseConfigured()),
    isPlanReady: isPlanLoaded,
  };
}
