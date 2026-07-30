"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useBudgetPlansStorage } from "@/hooks/use-budget-plans-storage";

type BudgetPlansContextValue = ReturnType<typeof useBudgetPlansStorage>;

const BudgetPlansContext = createContext<BudgetPlansContextValue | null>(null);

export function BudgetPlansProvider({ children }: { children: ReactNode }) {
  const value = useBudgetPlansStorage();
  return (
    <BudgetPlansContext.Provider value={value}>
      {children}
    </BudgetPlansContext.Provider>
  );
}

export function useBudgetPlans() {
  const context = useContext(BudgetPlansContext);
  if (!context) {
    throw new Error("useBudgetPlans must be used within BudgetPlansProvider");
  }
  return context;
}
