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
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
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
  art,
}: {
  icon?: ReactNode;
  mark?: "budget" | "invest" | "retire";
  title: string;
  description: string;
  actions?: ReactNode;
  art?: ReactNode;
}) {
  return (
    <div className="premium-empty">
      {art ? (
        art
      ) : icon ? (
        <div className="desk-empty-icon">{icon}</div>
      ) : (
        <DeskEmptyMark kind={mark} />
      )}
      <p className="text-base font-semibold tracking-tight">{title}</p>
      <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
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
      ? "warn"
      : status === "overspent" || available < 0
        ? "bad"
        : available === 0
          ? "zero"
          : status === "low"
            ? "warn"
            : "ok";

  const cue =
    tone === "ok"
      ? "Funded"
      : tone === "warn"
        ? "Watch"
        : tone === "bad"
          ? "Overspent"
          : "Zero";

  return (
    <span
      className={cn(
        "budget-available-chip",
        tone === "ok" && "budget-available-chip--ok",
        tone === "warn" && "budget-available-chip--warn",
        tone === "bad" && "budget-available-chip--bad",
        tone === "zero" && "budget-available-chip--zero",
        className,
      )}
    >
      <span className="sr-only">{cue}. </span>
      <AvailableCue tone={tone} />
      {children}
    </span>
  );
}

function AvailableCue({ tone }: { tone: "ok" | "warn" | "bad" | "zero" }) {
  return (
    <span className="available-cue" aria-hidden>
      {tone === "ok" ? (
        <svg viewBox="0 0 12 12" fill="none">
          <path
            d="M2.2 6.2 4.7 8.7 9.8 3.3"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
      {tone === "warn" ? (
        <svg viewBox="0 0 12 12" fill="none">
          <path
            d="M6 2.2 10.2 9.8H1.8L6 2.2Z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <path d="M6 5.2v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      ) : null}
      {tone === "bad" ? (
        <svg viewBox="0 0 12 12" fill="none">
          <circle cx="6" cy="6" r="4.2" stroke="currentColor" strokeWidth="1.3" />
          <path d="M6 3.6v2.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="6" cy="8.5" r="0.6" fill="currentColor" />
        </svg>
      ) : null}
      {tone === "zero" ? (
        <svg viewBox="0 0 12 12" fill="none">
          <path d="M3 6h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      ) : null}
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
