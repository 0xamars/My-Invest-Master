import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { RetirementVerdict } from "@/lib/retirement/dashboard";

export function RetirePageHeader({
  title,
  titleAddon,
  description,
  action,
}: {
  title: ReactNode;
  titleAddon?: ReactNode;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {typeof title === "string" ? (
            <h1 className="page-title">
              {title}
            </h1>
          ) : (
            title
          )}
          {titleAddon}
        </div>
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

export function RetirePanel({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("budget-panel", className)} {...rest}>
      {children}
    </div>
  );
}

export function RetireEmptyState({
  icon,
  title,
  description,
  actions,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="premium-empty">
      {icon ? (
        <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          {icon}
        </div>
      ) : null}
      <p className="text-[0.975rem] font-semibold tracking-tight">{title}</p>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function RetireVerdictChip({
  verdict,
  className,
}: {
  verdict: RetirementVerdict;
  className?: string;
}) {
  const label =
    verdict === "ahead"
      ? "Ahead"
      : verdict === "behind"
        ? "Behind"
        : verdict === "empty"
          ? "Inputs missing"
          : "On track";

  return (
    <span
      className={cn(
        "budget-available-chip justify-center",
        verdict === "ahead" && "budget-available-chip--healthy",
        verdict === "on-track" && "budget-available-chip--healthy",
        verdict === "behind" && "budget-available-chip--low",
        verdict === "empty" && "bg-muted text-muted-foreground",
        className,
      )}
    >
      {label}
    </span>
  );
}

export function RetireMoney({
  value,
  tone = "neutral",
  className,
}: {
  value: string;
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
      {value}
    </span>
  );
}

export function RetireField({
  id,
  label,
  hint,
  children,
}: {
  id?: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="text-xs font-medium text-muted-foreground"
      >
        {label}
      </label>
      {children}
      {hint ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
