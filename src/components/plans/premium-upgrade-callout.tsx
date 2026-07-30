"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getPremiumUpgradeCopy,
  type PremiumUpgradeReason,
} from "@/lib/plans/upgrade-copy";
import { PRICING_PATH } from "@/lib/plans/pricing";
import type { PlanFeature, PlanLimitedResource } from "@/types/plan";

type PremiumUpgradeCalloutProps = {
  resource?: PlanLimitedResource;
  feature?: PlanFeature;
  className?: string;
  compact?: boolean;
  /**
   * Optional click handler. Prefer omitting this so the CTA navigates to
   * Pricing; use only when you need to open the upgrade dialog first.
   */
  onUpgradeClick?: () => void;
};

function resolveReason(
  resource?: PlanLimitedResource,
  feature?: PlanFeature,
): PremiumUpgradeReason {
  if (resource) return { type: "limit", resource };
  if (feature) return { type: "feature", feature };
  return { type: "limit", resource: "portfolio" };
}

export function PremiumUpgradeCallout({
  resource,
  feature,
  className,
  compact = false,
  onUpgradeClick,
}: PremiumUpgradeCalloutProps) {
  const copy = getPremiumUpgradeCopy(resolveReason(resource, feature));

  return (
    <div
      className={cn(
        "rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm",
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">{copy.title}</p>
            {!compact && (
              <p className="text-muted-foreground">{copy.description}</p>
            )}
          </div>
        </div>
        {onUpgradeClick ? (
          <Button
            size="sm"
            className="shrink-0 gap-2"
            type="button"
            onClick={onUpgradeClick}
          >
            <Sparkles className="size-3.5" />
            {copy.ctaLabel}
          </Button>
        ) : (
          <Button
            size="sm"
            className="shrink-0 gap-2"
            render={<Link href={PRICING_PATH} />}
          >
            <Sparkles className="size-3.5" />
            {copy.ctaLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
