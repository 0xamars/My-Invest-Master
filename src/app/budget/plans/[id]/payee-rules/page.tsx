import { Suspense } from "react";
import { BudgetPayeeRulesContent } from "@/components/budget/budget-payee-rules-content";

export default function BudgetPayeeRulesPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading payee rules…</div>}>
      <BudgetPayeeRulesContent />
    </Suspense>
  );
}
