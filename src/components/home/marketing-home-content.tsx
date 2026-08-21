"use client";

import { RefreshCw } from "lucide-react";
import { MarketingHomePage } from "@/components/home/marketing-home";
import { useAuth } from "@/hooks/use-auth";
import { APP_HOME_PATH } from "@/lib/routes";

/** Public marketing homepage — shown for both logged-out and logged-in visitors. */
export function MarketingHomeContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-[#16181D]">
        <RefreshCw className="size-5 animate-spin text-white/50" />
      </div>
    );
  }

  return (
    <MarketingHomePage
      isSignedIn={Boolean(user)}
      dashboardHref={APP_HOME_PATH}
    />
  );
}
