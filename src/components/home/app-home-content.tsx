"use client";

import { LogOut } from "lucide-react";
import { HomeDashboard } from "@/components/home/home-dashboard";
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
        description="Morning scoreboard — leftover, the book, and whether Freedom is on track. Not investment advice."
        action={
          <Button variant="outline" onClick={() => void handleSignOut()}>
            <LogOut className="size-4" />
            Sign out
          </Button>
        }
      />

      <HomeDashboard />
    </div>
  );
}
