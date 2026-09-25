import type { ReactNode } from "react";
import { DeskEmptyMark } from "@/components/layout/desk-empty-mark";
import { cn } from "@/lib/utils";

export function BudgetPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h1 className="page-title">
          {title}
        </h1>
        {description ? (
          <p className="page-description mt-0">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function BudgetPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("budget-panel", className)}>{children}</div>;
}

export function BudgetEmptyState({
  icon,
  mark = "budget",
  title,
  description,
  actions,
}: {
  icon?: ReactNode;
  mark?: "budget" | "invest" | "retire";
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="premium-empty">
      {icon ? (
        <div className="desk-empty-icon">{icon}</div>
      ) : (
        <DeskEmptyMark kind={mark} />
      )}
      <p className="text-base font-semibold tracking-tight">{title}</p>
      <p className="mt-1 max-w-sm text-sm leading-snug text-muted-foreground">
        {description}
      </p>
      {actions ? <div className="mt-3.5 flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function BudgetKindBadge({
  kind,
}: {
  kind: "transfer" | "split" | "scheduled" | "inbox" | "matched";
}) {
  const label =
    kind === "transfer"
      ? "Transfer"
      : kind === "split"
        ? "Split"
        : kind === "scheduled"
          ? "Scheduled"
          : kind === "matched"
            ? "Matched"
            : "Inbox";
  return (
    <span className={cn("budget-kind", `budget-kind--${kind}`)}>{label}</span>
  );
}

export function BudgetMoney({
  value,
  prefix,
  tone = "neutral",
  className,
}: {
  value: string;
  prefix?: string;
  tone?: "in" | "out" | "danger" | "neutral";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "tabular-nums tracking-tight",
        tone === "in" && "text-[var(--brand-green-text)]",
        tone === "out" && "text-[var(--brand-orange-text)]",
        tone === "danger" && "text-[var(--fg-danger-text)]",
        className,
      )}
    >
      {prefix}
      {value}
    </span>
  );
}

export function BudgetAvailableChip({
  status,
  available,
  children,
  className,
}: {
  status: "healthy" | "low" | "overspent" | "credit-overspent";
  available: number;
  children: ReactNode;
  className?: string;
}) {
  const tone =
    status === "credit-overspent"
      ? "credit"
      : status === "overspent" || available < 0
        ? "cash"
        : available === 0
          ? "zero"
          : status === "low"
            ? "low"
            : "healthy";

  return (
    <span
      className={cn(
        "budget-available-chip",
        tone === "cash" && "budget-available-chip--cash",
        tone === "credit" && "budget-available-chip--credit",
        tone === "low" && "budget-available-chip--low",
        tone === "healthy" && "budget-available-chip--healthy",
        tone === "zero" && "budget-available-chip--zero",
        className,
      )}
    >
      {tone === "credit" ? <span className="sr-only">Credit overspent. </span> : null}
      {tone === "cash" ? <span className="sr-only">Overspent. </span> : null}
      {children}
    </span>
  );
}

export function BudgetGoalBar({
  assigned,
  needed,
  onTrack,
}: {
  assigned: number;
  needed: number;
  onTrack: boolean;
}) {
  const ratio = needed <= 0 ? 1 : Math.min(1, Math.max(0, assigned / needed));
  return (
    <div
      className="budget-goal-bar"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={Math.max(needed, 0)}
      aria-valuenow={Math.max(0, assigned)}
      aria-label={onTrack ? "Goal on track" : "Goal underfunded"}
    >
      <span
        className={cn(
          "budget-goal-bar-fill",
          onTrack ? "budget-goal-bar-fill--ok" : "budget-goal-bar-fill--low",
        )}
        style={{ width: `${Math.round(ratio * 100)}%` }}
      />
    </div>
  );
}
