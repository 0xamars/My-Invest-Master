import { RETIRE_DISCLAIMER } from "@/lib/retirement/assumptions";
import { cn } from "@/lib/utils";

export function RetirementDisclaimer({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs leading-relaxed text-muted-foreground", className)}>
      {RETIRE_DISCLAIMER}
    </p>
  );
}
