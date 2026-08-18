import type { ReactNode } from "react";
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
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h1 className="text-[1.45rem] font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
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
  title,
  description,
  actions,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-[var(--brand-green)]/10 text-[var(--brand-green)]">
        {icon}
      </div>
      <p className="text-base font-semibold tracking-tight">{title}</p>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {actions ? <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div> : null}
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
        tone === "in" && "text-[var(--brand-green)]",
        tone === "out" && "text-[var(--brand-orange)]",
        tone === "danger" && "text-[var(--brand-red)]",
        className,
      )}
    >
      {prefix}
      {value}
    </span>
  );
}
