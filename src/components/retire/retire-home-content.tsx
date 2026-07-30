import Link from "next/link";
import { ArrowRight, Target } from "lucide-react";
import { CategoryPageHeader } from "@/components/category/category-page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function RetireHomeContent() {
  return (
    <div className="flex flex-1 flex-col gap-8">
      <CategoryPageHeader
        category="retire"
        title="Retire"
        description="Plan for the long term with retirement projections, lifestyle spending models, and asset-level growth scenarios."
      />

      <Card className="surface-card gap-0 py-0 shadow-none">
        <CardHeader className="border-b border-border/60 px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Target className="size-5" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-lg font-semibold">
                Retirement Planning Models
              </CardTitle>
              <CardDescription className="max-w-2xl leading-relaxed">
                Build detailed retirement scenarios with year-by-year projections,
                adjustable CAGR assumptions, inflation-adjusted spending, and
                interactive charts.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 px-6 py-5">
          <Button className="gap-2" render={<Link href="/retire/plans" />}>
            Open planning models
            <ArrowRight className="size-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
