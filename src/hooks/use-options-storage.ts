"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { importLegacyLocalDataOnce } from "@/lib/portfolio/legacy-import";
import {
  loadOptionsFromCloud,
  saveOptionsToCloud,
} from "@/lib/supabase/user-data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { calculateOptionsCost } from "@/types/options";
import type {
  AddOptionsTransactionInput,
  OptionsPosition,
  UpdateOptionsPositionInput,
} from "@/types/options";

const SAVE_DEBOUNCE_MS = 500;

function normalizePositions(positions: OptionsPosition[]): OptionsPosition[] {
  return positions.map((position) => ({
    ...position,
    ticker: position.ticker.toUpperCase(),
  }));
}

export function useOptionsStorage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [positions, setPositions] = useState<OptionsPosition[]>([]);
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
          setPositions([]);
          setIsLoaded(true);
        }
        return;
      }

      try {
        await importLegacyLocalDataOnce(user.id);
        const remote = await loadOptionsFromCloud(user.id);
        if (!cancelled && version === loadVersionRef.current) {
          setPositions(normalizePositions(remote ?? []));
        }
      } catch (error) {
        if (!cancelled && version === loadVersionRef.current) {
          setSyncError(
            error instanceof Error
              ? error.message
              : "Failed to load options from cloud.",
          );
          setPositions([]);
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
        await saveOptionsToCloud(user.id, positions);
        setSyncError(null);
      } catch (error) {
        setSyncError(
          error instanceof Error
            ? error.message
            : "Failed to save options to cloud.",
        );
      }
    }, SAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [positions, isLoaded, isAuthLoading, user]);

  const addPosition = useCallback((input: AddOptionsTransactionInput) => {
    const ticker = input.ticker.toUpperCase();
    const cost = calculateOptionsCost(
      input.contracts,
      input.premiumPerContract,
    );

    const position: OptionsPosition = {
      id: crypto.randomUUID(),
      ticker,
      name: input.name,
      optionType: input.optionType,
      txDate: input.txDate,
      expiryDate: input.expiryDate,
      strikePrice: input.strikePrice,
      contracts: input.contracts,
      premiumPerContract: input.premiumPerContract,
      cost,
      status: "active",
      logoUrl: input.logoUrl,
      createdAt: new Date().toISOString(),
    };

    setPositions((prev) => [position, ...prev]);
  }, []);

  const updatePosition = useCallback(
    (id: string, input: UpdateOptionsPositionInput) => {
      setPositions((prev) =>
        prev.map((position) => {
          if (position.id !== id) return position;

          const updated: OptionsPosition = {
            ...position,
            ...input,
            ticker: input.ticker?.toUpperCase() ?? position.ticker,
            realizedPl:
              input.realizedPl === null ? undefined : input.realizedPl,
          };

          if (
            input.contracts !== undefined ||
            input.premiumPerContract !== undefined
          ) {
            updated.cost = calculateOptionsCost(
              updated.contracts,
              updated.premiumPerContract,
            );
          }

          if (input.status === "active") {
            updated.status = "active";
            updated.realizedPl = undefined;
          }

          return updated;
        }),
      );
    },
    [],
  );

  const removePosition = useCallback((id: string) => {
    setPositions((prev) => prev.filter((position) => position.id !== id));
  }, []);

  return {
    positions,
    addPosition,
    updatePosition,
    removePosition,
    isLoaded,
    syncError,
    isCloudSynced: Boolean(user && isSupabaseConfigured()),
  };
}
