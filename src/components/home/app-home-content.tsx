"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
import { HomeDashboard } from "@/components/home/home-dashboard";
import { LeftoverAction } from "@/components/invest/leftover-action";
import { RefreshRetireAction } from "@/components/invest/refresh-retire-action";
import { MarketNewsSection } from "@/components/home/market-news-section";
import { RetirePageHeader } from "@/components/retirement/retire-ui";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useGoToMarketingHome } from "@/lib/navigation/marketing-home";

/** Logged-in account overview (not the public marketing homepage). */
export function AppHomeContent() {
  const { user, signOut } = useAuth();
  const goToMarketingHome = useGoToMarketingHome();

  if (!user) return null;

  async function handleSignOut() {
    await signOut();
    goToMarketingHome();
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      <RetirePageHeader
        title="Home"
        description="Whether retirement is on track — leftover and the book sit underneath. Not investment advice."
        action={
          <Button variant="outline" onClick={() => void handleSignOut()}>
            <LogOut className="size-4" />
            Sign out
          </Button>
        }
      />

      <HomeDashboard />

      <LeftoverAction />
      <RefreshRetireAction />

      <div className="space-y-2">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Market</h2>
            <p className="text-xs text-muted-foreground">
              Headlines only — heatmap and themes live under Market.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            render={<Link href="/market" />}
          >
            Open Market
          </Button>
        </div>
        <MarketNewsSection />
      </div>
    </div>
  );
}
