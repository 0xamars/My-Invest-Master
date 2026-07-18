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
    <Card className={cn("glass-panel overflow-hidden", className)}>
      <CardHeader className="border-b border-white/10 px-5 py-4">
        <CardTitle className="text-base font-semibold tracking-tight">
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className={cn("px-4 py-5", contentClassName)}>
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
    <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/10 px-6 py-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
