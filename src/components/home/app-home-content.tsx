"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
import { HomeDashboard } from "@/components/home/home-dashboard";
import { MarketNewsSection } from "@/components/home/market-news-section";
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
    <div className="flex flex-1 flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="page-title">Home</h1>
          <p className="page-description">
            Your InvestSalsa overview across Budget, Invest, and Retire.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="premium-cta" render={<Link href="/invest" />}>
            Open Invest
          </Button>
          <Button variant="outline" onClick={() => void handleSignOut()}>
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>
      </div>

      <HomeDashboard />
      <MarketNewsSection />
    </div>
  );
}
