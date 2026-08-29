import type { ReactNode } from "react";
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
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {typeof title === "string" ? (
            <h1 className="text-[1.45rem] font-semibold tracking-tight text-foreground">
              {title}
            </h1>
          ) : (
            title
          )}
          {titleAddon}
        </div>
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

export function RetirePanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("budget-panel", className)}>{children}</div>;
}

export function RetireEmptyState({
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
      <div className="mb-4 flex size-12 items-center justify-center rounded-[var(--radius)] border border-border bg-muted text-[var(--brand-green)]">
        {icon}
      </div>
      <p className="text-base font-semibold tracking-tight">{title}</p>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {actions ? (
        <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>
      ) : null}
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
        tone === "in" && "text-[var(--brand-green)]",
        tone === "out" && "text-[var(--brand-orange)]",
        tone === "danger" && "text-[var(--brand-red)]",
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
