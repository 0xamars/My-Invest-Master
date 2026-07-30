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
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={() => onMonthChange(shiftMonthKey(monthKey, -1))}
        aria-label="Previous month"
      >
        <ChevronLeft className="size-4" />
      </Button>
      <span className="min-w-[10rem] text-center text-sm font-semibold text-foreground">
        {formatMonthLabel(monthKey)}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={() => onMonthChange(shiftMonthKey(monthKey, 1))}
        aria-label="Next month"
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
