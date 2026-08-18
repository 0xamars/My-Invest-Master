"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Crown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useUserPlan } from "@/hooks/use-user-preferences";
import { planDisplayName } from "@/lib/plans/access";
import {
  FREE_PLAN_FEATURES,
  PREMIUM_PLAN_FEATURES,
  PRICING_PATH,
} from "@/lib/plans/pricing";
import type { UserPlan } from "@/types/plan";

export function PlanSettingsCard() {
  const { user } = useAuth();
  const { plan, storedPlan, setStoredPlan, isPremium, isLoaded } = useUserPlan();
  const [pendingStoredPlan, setPendingStoredPlan] = useState<UserPlan | null>(
    null,
  );

  if (!user || !isLoaded) return null;

  const allowTestSwitch =
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_ALLOW_PLAN_SWITCH === "true";

  function requestStoredPlanChange(next: UserPlan) {
    if (next === storedPlan) return;

    // Downgrading stored plan to Free can change create limits — confirm first.
    // Existing portfolios are never deleted automatically.
    if (next === "free" && storedPlan === "premium") {
      setPendingStoredPlan("free");
      return;
    }

    setStoredPlan(next);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          {isPremium ? (
            <Crown className="size-5 text-primary" />
          ) : (
            <Sparkles className="size-5 text-primary" />
          )}
          Plan
        </CardTitle>
        <CardDescription>
          You are on the{" "}
          <span className="font-medium text-foreground">
            {planDisplayName(plan)}
          </span>{" "}
          plan.
          {plan !== storedPlan && (
            <span className="block pt-1 text-xs">
              Stored preference: {planDisplayName(storedPlan)} (overridden for
              this account).
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isPremium ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Premium unlocks unlimited portfolios, retirement plans, and budget
              plans, plus create-from-portfolio.
            </p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {PREMIUM_PLAN_FEATURES.slice(0, 4).map((item) => (
                <li key={item} className="flex gap-2">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              render={<Link href={PRICING_PATH} />}
            >
              <Crown className="size-4" />
              View Premium plans
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Free includes 1 portfolio, 1 retirement plan, and 1 budget plan.
              Upgrade to Premium for unlimited plans and retire-from-portfolio.
            </p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {FREE_PLAN_FEATURES.slice(0, 3).map((item) => (
                <li key={item} className="flex gap-2">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="gap-2"
                render={<Link href={PRICING_PATH} />}
              >
                <Crown className="size-4" />
                Upgrade to Premium
              </Button>
              <Button
                type="button"
                variant="outline"
                render={<Link href={PRICING_PATH} />}
              >
                View Premium plans
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Self-serve billing is not enabled yet. See Pricing for early-access
              details.
            </p>
          </div>
        )}

        {allowTestSwitch && (
          <div className="rounded-lg border border-dashed border-border px-3 py-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Testing override (stored plan)
            </p>
            <div className="flex flex-wrap gap-2">
              {(["free", "premium"] as UserPlan[]).map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={storedPlan === value ? "default" : "outline"}
                  onClick={() => requestStoredPlanChange(value)}
                >
                  Set {planDisplayName(value)}
                </Button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Changing the stored plan never deletes portfolios. Free only
              blocks creating more than one and opening extras. Admin emails and{" "}
              <code className="text-[0.7rem]">NEXT_PUBLIC_PLAN_OVERRIDE</code>{" "}
              still win over this value for access checks.
            </p>
          </div>
        )}
      </CardContent>

      <Dialog
        open={pendingStoredPlan !== null}
        onOpenChange={(open) => {
          if (!open) setPendingStoredPlan(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Switch stored plan to Free?</DialogTitle>
            <DialogDescription>
              This only updates the stored plan preference used for testing.
              Existing portfolios, retirement plans, and budget plans are not
              deleted. Free will block creating more than one of each and opening
              extras going forward.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingStoredPlan(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (pendingStoredPlan) setStoredPlan(pendingStoredPlan);
                setPendingStoredPlan(null);
              }}
            >
              Switch to Free
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
