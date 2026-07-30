"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Lock } from "lucide-react";
import { PremiumUpgradeDialog } from "@/components/plans/premium-upgrade-dialog";
import { Button } from "@/components/ui/button";
import { usePremiumUpgradePrompt } from "@/hooks/use-premium-upgrade-prompt";
import { useUserPlan } from "@/hooks/use-user-preferences";
import { PRICING_PATH } from "@/lib/plans/pricing";
import type { PlanLimitedResource } from "@/types/plan";

type FreeResourceOpenGuardProps = {
  resource: PlanLimitedResource;
  /** Resource records finished loading (plans/portfolios). */
  isResourceLoaded: boolean;
  /** True when the current Free/Premium plan allows opening this item. */
  canOpen: boolean;
  listHref: string;
  listLabel: string;
  children: ReactNode;
};

/**
 * Blocks Free users from viewing Premium-locked detail pages.
 * Shows the shared upgrade dialog and a safe back-to-list fallback.
 * Never deletes data.
 */
export function FreeResourceOpenGuard({
  resource,
  isResourceLoaded,
  canOpen,
  listHref,
  listLabel,
  children,
}: FreeResourceOpenGuardProps) {
  const router = useRouter();
  const { isLoaded: isPlanLoaded } = useUserPlan();
  const upgrade = usePremiumUpgradePrompt();
  const promptedRef = useRef(false);

  const ready = isResourceLoaded && isPlanLoaded;
  const blocked = ready && !canOpen;

  useEffect(() => {
    if (!blocked) {
      promptedRef.current = false;
      return;
    }
    if (promptedRef.current) return;
    promptedRef.current = true;
    upgrade.promptOpen(resource);
  }, [blocked, resource, upgrade.promptOpen]);

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading…
      </div>
    );
  }

  if (blocked) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Lock className="size-5" />
        </div>
        <div className="space-y-1">
          <p className="text-lg font-semibold">Premium required to open</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Free can actively use only one of these. Extras stay available in the
            list so you can delete them, or upgrade to Premium to open them.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            variant="outline"
            className="gap-2"
            render={<Link href={listHref} />}
          >
            <ArrowLeft className="size-4" />
            {listLabel}
          </Button>
          <Button
            className="gap-2"
            render={<Link href={PRICING_PATH} />}
          >
            <Lock className="size-4" />
            Upgrade to Premium
          </Button>
        </div>
        <PremiumUpgradeDialog
          open={upgrade.dialogProps.open}
          reason={upgrade.dialogProps.reason}
          onOpenChange={(open) => {
            upgrade.dialogProps.onOpenChange(open);
            if (!open) router.replace(listHref);
          }}
        />
      </div>
    );
  }

  return <>{children}</>;
}
