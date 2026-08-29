import { Suspense } from "react";
import { BudgetPlansListContent } from "@/components/budget/budget-plans-list-content";
import { PillarLearnDo } from "@/components/journey/pillar-learn-do";

function LearnDoFallback() {
  return (
    <div className="flex flex-1 items-center justify-center py-16 text-sm text-muted-foreground">
      Opening Budget…
    </div>
  );
}

export default function BudgetPage() {
  return (
    <Suspense fallback={<LearnDoFallback />}>
      <PillarLearnDo pillar="budget">
        <BudgetPlansListContent />
      </PillarLearnDo>
    </Suspense>
  );
}
