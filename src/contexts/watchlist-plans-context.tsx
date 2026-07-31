"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useWatchlistPlansStorage } from "@/hooks/use-watchlist-plans-storage";

type WatchlistPlansContextValue = ReturnType<typeof useWatchlistPlansStorage>;

const WatchlistPlansContext = createContext<WatchlistPlansContextValue | null>(
  null,
);

export function WatchlistPlansProvider({ children }: { children: ReactNode }) {
  const value = useWatchlistPlansStorage();
  return (
    <WatchlistPlansContext.Provider value={value}>
      {children}
    </WatchlistPlansContext.Provider>
  );
}

export function useWatchlistPlans() {
  const context = useContext(WatchlistPlansContext);
  if (!context) {
    throw new Error(
      "useWatchlistPlans must be used within WatchlistPlansProvider",
    );
  }
  return context;
}
