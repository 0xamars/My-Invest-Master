import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AnalyticsChartCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export function AnalyticsChartCard({
  title,
  description,
  children,
  className,
  contentClassName,
}: AnalyticsChartCardProps) {
  return (
    <Card className={cn("surface-card gap-0 py-0 shadow-none", className)}>
      <CardHeader className="border-b border-border/60 px-6 py-5">
        <CardTitle className="text-base font-semibold tracking-tight">
          {title}
        </CardTitle>
        {description && (
          <CardDescription className="text-sm leading-relaxed">
            {description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className={cn("px-6 py-6", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}

export function AnalyticsChartEmpty({
  message = "No data to display yet.",
}: {
  message?: string;
}) {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/15 px-6 py-10 text-center text-sm leading-relaxed text-muted-foreground">
      {message}
    </div>
  );
}
