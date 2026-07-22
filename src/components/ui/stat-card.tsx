import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  valueClassName?: string;
  isLoading?: boolean;
  className?: string;
}

export function StatCard({
  label,
  value,
  subValue,
  valueClassName,
  isLoading,
  className,
}: StatCardProps) {
  return (
    <div className={cn("stat-card", className)}>
      <p className="stat-label">{label}</p>
      <p
        className={cn(
          "stat-value",
          isLoading && "animate-pulse text-muted-foreground",
          valueClassName,
        )}
      >
        {value}
      </p>
      {subValue && (
        <p className={cn("stat-sub", valueClassName)}>{subValue}</p>
      )}
    </div>
  );
}
