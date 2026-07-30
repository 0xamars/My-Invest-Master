"use client";

import { useCallback, useState } from "react";
import type { PlanFeature, PlanLimitedResource } from "@/types/plan";
import type { PremiumUpgradeReason } from "@/lib/plans/upgrade-copy";

/**
 * Shared Free → Premium upgrade prompt. Call prompt* when a Free user
 * attempts a gated action so the upgrade dialog always appears
 * (never fail silently).
 */
export function usePremiumUpgradePrompt() {
  const [reason, setReason] = useState<PremiumUpgradeReason | null>(null);

  const promptLimit = useCallback((resource: PlanLimitedResource) => {
    setReason({ type: "limit", resource });
  }, []);

  const promptOpen = useCallback((resource: PlanLimitedResource) => {
    setReason({ type: "open", resource });
  }, []);

  const promptFeature = useCallback((feature: PlanFeature) => {
    setReason({ type: "feature", feature });
  }, []);

  const close = useCallback(() => {
    setReason(null);
  }, []);

  return {
    reason,
    isOpen: reason !== null,
    promptLimit,
    promptOpen,
    promptFeature,
    close,
    dialogProps: {
      open: reason !== null,
      onOpenChange: (open: boolean) => {
        if (!open) setReason(null);
      },
      reason,
    },
  };
}
