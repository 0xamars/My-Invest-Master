"use client";

import { createContext, useContext, type ReactNode } from "react";
import { usePortfolioPlansStorage } from "@/hooks/use-portfolio-plans-storage";

type PortfolioPlansContextValue = ReturnType<typeof usePortfolioPlansStorage>;

const PortfolioPlansContext = createContext<PortfolioPlansContextValue | null>(
  null,
);

export function PortfolioPlansProvider({ children }: { children: ReactNode }) {
  const value = usePortfolioPlansStorage();
  return (
    <PortfolioPlansContext.Provider value={value}>
      {children}
    </PortfolioPlansContext.Provider>
  );
}

export function usePortfolioPlans() {
  const context = useContext(PortfolioPlansContext);
  if (!context) {
    throw new Error(
      "usePortfolioPlans must be used within PortfolioPlansProvider",
    );
  }
  return context;
}
