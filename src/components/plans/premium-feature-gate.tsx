"use client";

import type { ReactNode } from "react";
import { PremiumUpgradeCallout } from "@/components/plans/premium-upgrade-callout";
import { PremiumUpgradeDialog } from "@/components/plans/premium-upgrade-dialog";
import { usePremiumUpgradePrompt } from "@/hooks/use-premium-upgrade-prompt";
import { useUserPlan } from "@/hooks/use-user-preferences";
import { canAccess } from "@/lib/plans/access";
import type { PlanFeature } from "@/types/plan";

type PremiumFeatureGateProps = {
  feature: PlanFeature;
  children: ReactNode;
  /**
   * When true, Free users see an inline upgrade callout instead of children.
   * When false (default), children stay visible and callers should use
   * `onBlocked` / the returned prompt pattern for action clicks.
   */
  hideWhenBlocked?: boolean;
  /** Rendered for Free users when hideWhenBlocked is true. */
  fallback?: ReactNode;
};

/**
 * Helper for Premium-only surfaces (AI depth, full market, Plaid, etc.).
 * Does not remove Free access unless hideWhenBlocked is set — call
 * `promptFeature` from usePremiumUpgradePrompt when an action is blocked.
 */
export function PremiumFeatureGate({
  feature,
  children,
  hideWhenBlocked = false,
  fallback,
}: PremiumFeatureGateProps) {
  const { plan, isLoaded } = useUserPlan();
  const upgrade = usePremiumUpgradePrompt();
  const allowed = !isLoaded || canAccess(plan, feature);

  if (!allowed && hideWhenBlocked) {
    return (
      <>
        {fallback ?? (
          <PremiumUpgradeCallout
            feature={feature}
            onUpgradeClick={() => upgrade.promptFeature(feature)}
          />
        )}
        <PremiumUpgradeDialog {...upgrade.dialogProps} />
      </>
    );
  }

  return <>{children}</>;
}

/**
 * Run a Premium-only action, or open the shared upgrade prompt for Free users.
 * Returns true when the action was allowed to run.
 */
export function runPremiumAction(
  options: {
    allowed: boolean;
    onAllowed: () => void;
    onBlocked: () => void;
  },
): boolean {
  if (options.allowed) {
    options.onAllowed();
    return true;
  }
  options.onBlocked();
  return false;
}
