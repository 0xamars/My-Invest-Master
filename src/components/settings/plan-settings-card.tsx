"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
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
import type { UserPlan } from "@/types/plan";

export function PlanSettingsCard() {
  const { user } = useAuth();
  const { storedPlan, setStoredPlan, isLoaded } = useUserPlan();
  const [pendingStoredPlan, setPendingStoredPlan] = useState<UserPlan | null>(
    null,
  );

  if (!user || !isLoaded) return null;

  const allowTestSwitch =
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_ALLOW_PLAN_SWITCH === "true";

  function requestStoredPlanChange(next: UserPlan) {
    if (next === storedPlan) return;

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
          <Sparkles className="size-5 text-primary" />
          Your account
        </CardTitle>
        <CardDescription>
          InvestSalsa is one product. Home, Budget, Invest, and Freedom are
          included. Create as many budget, portfolio, and Freedom plans as you
          need.
          Not investment advice.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
              Stored preference only. Caps are not enforced. Changing this never
              deletes plans.{" "}
              <code className="text-[0.7rem]">NEXT_PUBLIC_PLAN_OVERRIDE</code>{" "}
              still wins over this value.
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
              Existing portfolios, Freedom plans, and budget plans are not
              deleted. Caps are not enforced.
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
