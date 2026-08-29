"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMonthLabel, shiftMonthKey } from "@/types/budget";

interface BudgetMonthNavProps {
  monthKey: string;
  onMonthChange: (monthKey: string) => void;
}

export function BudgetMonthNav({ monthKey, onMonthChange }: BudgetMonthNavProps) {
  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-muted p-0.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="rounded-md"
        onClick={() => onMonthChange(shiftMonthKey(monthKey, -1))}
        aria-label="Previous month"
      >
        <ChevronLeft className="size-4" />
      </Button>
      <span className="min-w-[9.5rem] px-1 text-center text-sm font-semibold tracking-tight">
        {formatMonthLabel(monthKey)}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="rounded-md"
        onClick={() => onMonthChange(shiftMonthKey(monthKey, 1))}
        aria-label="Next month"
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
