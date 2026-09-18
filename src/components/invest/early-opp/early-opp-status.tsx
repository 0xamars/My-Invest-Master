import { statusLabel } from "@/lib/analysis/early-opp/format";
import type { EarlyOppStatus } from "@/lib/analysis/early-opp/types";
import { cn } from "@/lib/utils";

const TONE: Record<EarlyOppStatus, string> = {
  pass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  soft: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  fail: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  unknown: "border-border bg-muted/40 text-muted-foreground",
};

export function EarlyOppStatusChip({
  status,
  className,
}: {
  status: EarlyOppStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-semibold tracking-wide uppercase",
        TONE[status],
        className,
      )}
    >
      {statusLabel(status)}
    </span>
  );
}
