"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BUDGET_PLAN_CONFLICT_MESSAGE } from "@/lib/budget/plan-version";

export function BudgetSyncError({
  message,
  tone = "brand",
}: {
  message: string;
  tone?: "brand" | "destructive";
}) {
  const conflict = message === BUDGET_PLAN_CONFLICT_MESSAGE;
  const toneClass =
    tone === "brand"
      ? "border-[var(--brand-red)]/30 bg-[var(--brand-red)]/10 text-[var(--brand-red)]"
      : "border-destructive/25 bg-destructive/5 text-destructive";

  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-xl border px-4 py-3 text-sm ${toneClass}`}
      role="alert"
    >
      <AlertCircle className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">{message}</span>
      {conflict ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => window.location.reload()}
        >
          Reload
        </Button>
      ) : null}
    </div>
  );
}
