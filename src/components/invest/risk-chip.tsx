import { cn } from "@/lib/utils";
import {
  riskChipLabel,
  type CheckupRiskChip,
} from "@/lib/portfolio/checkup";
import {
  leverageFlagLabel,
  type LeverageFlag,
} from "@/lib/portfolio/leverage";

function riskChipClass(chip: CheckupRiskChip): string {
  if (chip === "concentrated") return "budget-available-chip--cash";
  if (chip === "cash-heavy") return "budget-available-chip--low";
  return "budget-available-chip--healthy";
}

function leverageChipClass(flag: LeverageFlag): string {
  if (flag === "high") return "budget-available-chip--cash";
  if (flag === "caution") return "budget-available-chip--low";
  if (flag === "ok") return "budget-available-chip--healthy";
  return "bg-muted text-muted-foreground";
}

export function InvestRiskChip({
  chip,
  className,
}: {
  chip: CheckupRiskChip;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "budget-available-chip justify-center",
        riskChipClass(chip),
        className,
      )}
    >
      {riskChipLabel(chip)}
    </span>
  );
}

export function LeverageUtilChip({
  flag,
  percent,
  className,
}: {
  flag: LeverageFlag;
  percent?: number | null;
  className?: string;
}) {
  const label =
    percent != null && flag !== "unset"
      ? `${percent.toFixed(0)}% · ${leverageFlagLabel(flag)}`
      : leverageFlagLabel(flag);

  return (
    <span
      className={cn(
        "budget-available-chip justify-center",
        leverageChipClass(flag),
        className,
      )}
    >
      {label}
    </span>
  );
}
