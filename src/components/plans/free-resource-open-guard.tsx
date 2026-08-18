"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useUserPlan } from "@/hooks/use-user-preferences";
import type { PlanLimitedResource } from "@/types/plan";

type FreeResourceOpenGuardProps = {
  resource: PlanLimitedResource;
  /** Resource records finished loading (plans/portfolios). */
  isResourceLoaded: boolean;
  /** Kept so a cap can return later. Caps are not enforced. */
  canOpen: boolean;
  listHref: string;
  listLabel: string;
  children: ReactNode;
};

/**
 * Detail-page load wrapper. Caps are off — never block or toast an upgrade.
 */
export function FreeResourceOpenGuard({
  isResourceLoaded,
  children,
}: FreeResourceOpenGuardProps) {
  const { isLoaded: isPlanLoaded } = useUserPlan();
  const ready = isResourceLoaded && isPlanLoaded;

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
