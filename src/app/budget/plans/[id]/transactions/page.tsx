import { Suspense } from "react";
import { BudgetTransactionsContent } from "@/components/budget/budget-transactions-content";

export default function BudgetPlanTransactionsPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading register…</div>}>
      <BudgetTransactionsContent />
    </Suspense>
  );
}
